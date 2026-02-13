import { getSheetsClient } from '@/lib/sheets/client';
import type { Event } from '@/types/event';

/**
 * Check-in Queue System
 * Serializza check-in per evitare sovraccarico Google Sheets API
 */

interface CheckInJob {
  eventId: string;
  guestId: string;
  eventCode: string;
  entrance?: string;
  checkedInBy?: string;
  timestamp: number;
  retries: number;
}

// In-memory queue (una per evento per parallelizzare eventi diversi)
const queues = new Map<string, CheckInJob[]>();
const processing = new Map<string, boolean>();

/**
 * Aggiunge check-in alla queue
 * Risponde immediatamente, processing in background
 */
export async function addCheckInToQueue(
  eventId: string,
  guestId: string,
  eventCode: string,
  data: { entrance?: string; checkedInBy?: string } = {}
): Promise<{ success: true; queued: true }> {
  const job: CheckInJob = {
    eventId,
    guestId,
    eventCode,
    entrance: data.entrance,
    checkedInBy: data.checkedInBy,
    timestamp: Date.now(),
    retries: 0,
  };

  // Aggiungi a queue specifica per evento
  if (!queues.has(eventId)) {
    queues.set(eventId, []);
  }

  queues.get(eventId)!.push(job);

  // Start worker se non già running
  processQueue(eventId);

  return { success: true, queued: true };
}

/**
 * Worker che processa queue per un evento
 * Serializza i check-in (uno alla volta) per evitare race conditions
 */
async function processQueue(eventId: string): Promise<void> {
  // Se già in processing, skip (worker già attivo)
  if (processing.get(eventId)) {
    return;
  }

  processing.set(eventId, true);

  const queue = queues.get(eventId);
  if (!queue) {
    processing.set(eventId, false);
    return;
  }

  while (queue.length > 0) {
    const job = queue.shift()!;

    try {
      await performCheckInOnSheets(job);
      console.log(
        `[Queue] Check-in processato: ${job.guestId} (queue size: ${queue.length})`
      );
    } catch (error: any) {
      console.error(`[Queue] Errore check-in ${job.guestId}:`, error.message);

      // Retry logic: max 3 tentativi
      if (job.retries < 3) {
        job.retries++;
        queue.push(job); // Re-queue
        console.log(
          `[Queue] Re-queued ${job.guestId} (retry ${job.retries}/3)`
        );
      } else {
        console.error(
          `[Queue] Check-in fallito definitivamente: ${job.guestId}`
        );
        // TODO: Salva in dead-letter queue o log per recovery manuale
      }
    }

    // Delay tra check-in per evitare rate limiting
    // 200ms = max 5 check-in/sec = 300 check-in/min (safe per Google Sheets)
    await sleep(200);
  }

  processing.set(eventId, false);
}

/**
 * Esegue check-in su Google Sheets
 * Stesso logic di lib/sheets/checkin.ts ma chiamato da queue
 */
async function performCheckInOnSheets(job: CheckInJob): Promise<void> {
  const sheetsClient = getSheetsClient();

  // 1. Get event metadata
  const event = await sheetsClient.getEventByCode(job.eventCode);

  if (!event || event.eventId !== job.eventId) {
    throw new Error('Evento non trovato o event code non valido');
  }

  // 2. READ: trova guest
  const guestData = await sheetsClient.findGuestByIdWithRow(
    event,
    job.guestId
  );

  if (!guestData) {
    throw new Error(`Guest ${job.guestId} non trovato`);
  }

  const { guest, rowIndex } = guestData;

  // 3. CHECK: già fatto check-in?
  if (guest.checkin) {
    // Già fatto, skip silently (optimistic update già mostrato in UI)
    console.log(`[Queue] ${job.guestId} già checked-in, skip`);
    return;
  }

  // 4. WRITE: conditional update
  const timestamp = new Date().toISOString();
  const success = await sheetsClient.conditionalUpdate(event, rowIndex, {
    expectedCurrentValue: guest.checkin ? 'SI' : '', // Dovrebbe essere vuoto
    guestId: job.guestId,
    checkin: true,
    checkinTime: timestamp,
    entrance: job.entrance,
    checkedInBy: job.checkedInBy,
  });

  if (!success) {
    // Conditional update fallito (race condition o guest già checked-in)
    // Verifica se è perché nel frattempo è stato fatto check-in
    const updatedData = await sheetsClient.findGuestByIdWithRow(
      event,
      job.guestId
    );

    if (updatedData && updatedData.guest.checkin) {
      // Già fatto da qualcun altro, OK
      console.log(`[Queue] ${job.guestId} già checked-in da altro worker`);
      return;
    }

    // Altrimenti è un vero errore
    throw new Error('Conditional update fallito');
  }

  console.log(`[Queue] Check-in completato: ${job.guestId} @ ${timestamp}`);
}

/**
 * Get queue status (per monitoring/debug)
 */
export function getQueueStatus(eventId: string) {
  return {
    queueSize: queues.get(eventId)?.length || 0,
    isProcessing: processing.get(eventId) || false,
  };
}

/**
 * Clear queue (per testing)
 */
export function clearQueue(eventId: string) {
  queues.delete(eventId);
  processing.delete(eventId);
}

// Utility
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
