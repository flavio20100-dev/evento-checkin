import { getFirestoreClient } from './client';
import { getSheetsClient } from '@/lib/sheets/client';
import type { Event } from '@/types/event';
import type { Guest } from '@/types/guest';

/**
 * Sync Service: Firestore → Google Sheets
 *
 * GARANZIE:
 * - Retry automatico su fallimento (max 3 tentativi)
 * - Sync batch (max 100 guests per volta)
 * - Dead letter queue per sync falliti definitivamente
 * - Idempotente (safe ri-eseguire)
 */
export class SyncService {
  private firestoreClient = getFirestoreClient();
  private sheetsClient = getSheetsClient();

  /**
   * Sincronizza un evento da Firestore a Google Sheets
   *
   * Flow:
   * 1. Get unsynced guests da Firestore
   * 2. Update Sheets in batch (max 100)
   * 3. Mark as synced solo se Sheets update succeeded
   * 4. Update last sync timestamp
   *
   * @param eventId ID evento da sincronizzare
   */
  async syncEventToSheets(eventId: string): Promise<{
    success: boolean;
    guestsSynced: number;
    error?: string;
  }> {
    const MAX_RETRIES = 3;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        // 1. Get event metadata
        const eventMetadata = await this.firestoreClient.getEventMetadata(
          eventId
        );

        if (!eventMetadata) {
          throw new Error(`Event ${eventId} metadata non trovato in Firestore`);
        }

        // 2. Get unsynced guests
        const unsyncedGuests = await this.firestoreClient.getUnsyncedGuests(
          eventId
        );

        if (unsyncedGuests.length === 0) {
          console.log(`[Sync] ✅ ${eventId}: Nessun guest da sincronizzare`);
          return { success: true, guestsSynced: 0 };
        }

        console.log(
          `[Sync] 🔄 ${eventId}: Sincronizzazione ${unsyncedGuests.length} guests (attempt ${attempt}/${MAX_RETRIES})`
        );

        // 3. Sync batch to Sheets (max 100 per batch)
        const batches = this.chunkArray(unsyncedGuests, 100);

        for (const batch of batches) {
          await this.syncBatchToSheets(eventMetadata, batch);
        }

        // 4. Mark as synced ONLY se Sheets update succeeded
        const syncedGuestIds = unsyncedGuests.map((g) => g.guestId);
        await this.firestoreClient.markAsSynced(eventId, syncedGuestIds);

        // 5. Update last sync timestamp
        await this.firestoreClient.updateLastSyncTimestamp(eventId);

        console.log(
          `[Sync] ✅ ${eventId}: ${unsyncedGuests.length} guests sincronizzati`
        );

        return { success: true, guestsSynced: unsyncedGuests.length };
      } catch (error: any) {
        console.error(
          `[Sync] ❌ Attempt ${attempt}/${MAX_RETRIES} fallito:`,
          error.message
        );

        // Ultimo tentativo fallito → dead letter queue
        if (attempt === MAX_RETRIES) {
          await this.firestoreClient.logToDeadLetterQueue(
            eventId,
            'syncEventToSheets',
            error,
            { attempts: attempt }
          );

          return {
            success: false,
            guestsSynced: 0,
            error: error.message || 'Sync fallito definitivamente',
          };
        }

        // Retry con backoff
        const backoffMs = 5000 * attempt; // 5s, 10s, 15s
        console.log(`[Sync] ⚠️ Retry dopo ${backoffMs}ms...`);
        await sleep(backoffMs);
      }
    }

    // Questo non dovrebbe mai essere raggiunto
    return { success: false, guestsSynced: 0, error: 'Max retry superati' };
  }

  /**
   * Sincronizza batch di guests a Google Sheets
   *
   * Usa batchUpdate per performance (1 API call per batch)
   */
  private async syncBatchToSheets(
    event: Event,
    guests: Guest[]
  ): Promise<void> {
    // Build batch update: per ogni guest trova row e aggiorna
    const updates: Array<{
      rowIndex: number;
      values: {
        checkin?: string;
        checkinTime?: string;
        entrance?: string;
        checkedInBy?: string;
      };
    }> = [];

    for (const guest of guests) {
      // Usa rowIndex salvato in Firestore (no bisogno di leggere da Sheets)
      const rowIndex = (guest as any)._rowIndex;

      if (!rowIndex) {
        console.warn(
          `[Sync] ⚠️ Guest ${guest.guestId} senza _rowIndex, skip`
        );
        continue;
      }

      updates.push({
        rowIndex,
        values: {
          checkin: guest.checkin ? 'SI' : '',
          checkinTime: guest.checkinTime || '',
          entrance: guest.entrance || '',
          checkedInBy: guest.checkedInBy || '',
        },
      });

      console.log(
        `[Sync] 📝 ${guest.cognome} ${guest.nome} → Sheet row ${rowIndex}`
      );
    }

    if (updates.length === 0) {
      console.log(`[Sync] ⚠️ Nessun guest da aggiornare in Sheets`);
      return;
    }

    // Batch update a Sheets
    await this.sheetsClient.batchUpdateGuests(event, updates);

    console.log(
      `[Sync] ✅ Batch update: ${updates.length} guests aggiornati in Sheets`
    );
  }

  /**
   * Sincronizza tutti gli eventi attivi
   */
  async syncAllActiveEvents(): Promise<{
    total: number;
    successful: number;
    failed: number;
    results: Array<{ eventId: string; status: string; error?: string }>;
  }> {
    // Get all active events (da Firestore o da Sheets master list)
    const events = await this.getActiveEvents();

    const results = [];
    let successful = 0;
    let failed = 0;

    for (const event of events) {
      try {
        const syncResult = await this.syncEventToSheets(event.eventId);

        if (syncResult.success) {
          successful++;
          results.push({
            eventId: event.eventId,
            status: 'success',
            guestsSynced: syncResult.guestsSynced,
          });
        } else {
          failed++;
          results.push({
            eventId: event.eventId,
            status: 'error',
            error: syncResult.error,
          });
        }
      } catch (error: any) {
        failed++;
        results.push({
          eventId: event.eventId,
          status: 'error',
          error: error.message,
        });
      }
    }

    console.log(
      `[Sync] 📊 Sync completato: ${successful} success, ${failed} failed (total: ${events.length})`
    );

    return {
      total: events.length,
      successful,
      failed,
      results,
    };
  }

  /**
   * Get lista eventi attivi
   *
   * TODO: Implementare logica per determinare eventi attivi
   * Per ora usa lista hardcoded o da Sheets master
   */
  private async getActiveEvents(): Promise<Event[]> {
    // Opzione 1: Query Firestore per eventi con status='active'
    // Opzione 2: Lista hardcoded di eventId
    // Opzione 3: Leggi da Sheets master list

    // Per ora usiamo approccio semplice: get da Sheets master list
    // (Mantiene compatibilità con sistema esistente)
    const events = await this.sheetsClient.getEvents();

    // Filtra solo eventi attivi (se hai un campo status)
    // return events.filter(e => e.status === 'active');

    // Per ora ritorna tutti
    return events;
  }

  /**
   * Carica evento da Sheets a Firestore (initial load)
   *
   * Usa questo per popolare Firestore la prima volta
   */
  async loadEventFromSheetsToFirestore(eventCode: string): Promise<{
    success: boolean;
    guestsLoaded: number;
    error?: string;
  }> {
    try {
      // 1. Get event da Sheets
      const event = await this.sheetsClient.getEventByCode(eventCode);

      if (!event) {
        throw new Error(`Event con code ${eventCode} non trovato in Sheets`);
      }

      console.log(`[InitialLoad] 🔄 Loading event ${event.eventId} to Firestore...`);

      // 2. Get tutti gli invitati da Sheets
      const guests = await this.sheetsClient.getGuests(event);

      // 3. Crea event metadata in Firestore
      const firestoreClient = getFirestoreClient();
      const db = (firestoreClient as any).getDb(); // Access private method

      // Create event metadata document
      await db
        .collection('events')
        .doc(event.eventId)
        .collection('metadata')
        .doc('data')
        .set({
          eventId: event.eventId,
          name: event.name,
          sheetId: event.sheetId,
          tabName: event.tabName, // IMPORTANTE: serve per sync a Sheets
          eventCode: event.eventCode,
          status: 'active',
          lastSyncedAt: new Date(),
          stats: {
            totalGuests: guests.length,
            checkedIn: guests.filter((g) => g.checkin).length,
            lastCheckInAt: null,
          },
        });

      // 4. Batch write guests (500 per batch, limite Firestore)
      const batches = this.chunkArray(guests, 500);

      for (const batch of batches) {
        const firestoreBatch = db.batch();

        for (const guest of batch) {
          const guestRef = db
            .collection('events')
            .doc(event.eventId)
            .collection('guests')
            .doc(guest.guestId);

          // Check se il document esiste già
          const existingDoc = await guestRef.get();

          if (existingDoc.exists) {
            // Document esiste: fai MERGE per non sovrascrivere check-in
            const existingData = existingDoc.data();
            firestoreBatch.set(
              guestRef,
              {
                // Aggiorna solo dati anagrafici (non check-in)
                nome: guest.nome,
                cognome: guest.cognome,
                azienda: guest.azienda || '',
                _sheetRowIndex: (guest as any)._rowIndex,
                _lastModified: new Date(),
                // NON toccare: checkin, checkinTime, entrance, checkedInBy
                // Se il guest ha già fatto check-in, mantieni quello!
              },
              { merge: true }
            );
          } else {
            // Document nuovo: crea normalmente
            firestoreBatch.set(guestRef, {
              ...guest,
              _syncedToSheets: true, // Già sincronizzato (viene da Sheets)
              _lastModified: new Date(),
              _version: 1,
            });
          }
        }

        await firestoreBatch.commit();
      }

      console.log(
        `[InitialLoad] ✅ Event ${event.eventId}: ${guests.length} guests caricati in Firestore`
      );

      return { success: true, guestsLoaded: guests.length };
    } catch (error: any) {
      console.error(`[InitialLoad] ❌ Error:`, error);
      return { success: false, guestsLoaded: 0, error: error.message };
    }
  }

  /**
   * Utility: chunk array in batches
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

// Singleton instance
let syncService: SyncService | null = null;

/**
 * Get Sync Service singleton
 */
export function getSyncService(): SyncService {
  if (!syncService) {
    syncService = new SyncService();
  }
  return syncService;
}

// Utility
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
