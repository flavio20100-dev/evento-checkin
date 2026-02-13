import { getSheetsClient } from './client';
import type { Event } from '@/types/event';
import type { CheckInData, CheckInResult, Guest } from '@/types/guest';

/**
 * Custom error per conflitti check-in
 */
export class ConflictError extends Error {
  constructor(
    public code: 'ALREADY_CHECKED_IN' | 'CONCURRENT_UPDATE',
    message: string,
    public checkinTime?: string
  ) {
    super(message);
    this.name = 'ConflictError';
  }
}

/**
 * Esegue check-in di un invitato con lock ottimistico
 *
 * Flow:
 * 1. READ: Leggi stato corrente + row number
 * 2. CHECK: Verifica non già checked-in
 * 3. WRITE: Conditional update (fallisce se valore cambiato)
 * 4. VERIFY: Re-read per confermare
 *
 * @throws ConflictError se invitato già checked-in o race condition detected
 */
export async function performCheckIn(
  event: Event,
  guestId: string,
  data: CheckInData = {}
): Promise<CheckInResult> {
  const sheetsClient = getSheetsClient();

  // 1. READ: Trova invitato con row index
  const result = await sheetsClient.findGuestByIdWithRow(event, guestId);

  if (!result) {
    throw new Error('Invitato non trovato');
  }

  const { guest, rowIndex } = result;

  // 2. CHECK: Già fatto check-in?
  if (guest.checkin) {
    throw new ConflictError(
      'ALREADY_CHECKED_IN',
      'Invitato già registrato',
      guest.checkinTime
    );
  }

  // 3. WRITE: Conditional update
  const timestamp = new Date().toISOString();

  const success = await sheetsClient.conditionalUpdate({
    event,
    rowIndex,
    expectedCurrentValue: guest.checkin,
    newValues: {
      checkin: 'SI',
      checkinTime: timestamp,
      entrance: data.entrance,
      checkedInBy: data.checkedInBy,
    },
  });

  if (!success) {
    // Race condition detected - un altro device ha fatto check-in nel frattempo
    throw new ConflictError(
      'CONCURRENT_UPDATE',
      'Operazione concorrente rilevata, riprova'
    );
  }

  // 4. VERIFY: Re-leggi per confermare e ottenere stato aggiornato
  const updatedResult = await sheetsClient.findGuestByIdWithRow(event, guestId);

  if (!updatedResult || !updatedResult.guest.checkin) {
    throw new Error('Verifica check-in fallita');
  }

  return {
    success: true,
    guest: updatedResult.guest,
    timestamp,
  };
}

/**
 * Annulla check-in di un invitato
 */
export async function undoCheckIn(
  event: Event,
  guestId: string
): Promise<{ success: boolean; guest: Guest }> {
  const sheetsClient = getSheetsClient();

  // 1. READ: Trova invitato con row index
  const result = await sheetsClient.findGuestByIdWithRow(event, guestId);

  if (!result) {
    throw new Error('Invitato non trovato');
  }

  const { guest, rowIndex } = result;

  // 2. CHECK: È stato fatto check-in?
  if (!guest.checkin) {
    throw new Error('Invitato non ha fatto check-in');
  }

  // 3. WRITE: Reset check-in fields
  const success = await sheetsClient.undoCheckInUpdate({
    event,
    rowIndex,
  });

  if (!success) {
    throw new Error('Annullamento check-in fallito');
  }

  // 4. VERIFY: Re-leggi per confermare
  const updatedResult = await sheetsClient.findGuestByIdWithRow(event, guestId);

  if (!updatedResult || updatedResult.guest.checkin) {
    throw new Error('Verifica annullamento fallita');
  }

  return {
    success: true,
    guest: updatedResult.guest,
  };
}

/**
 * Verifica se un invitato è già checked-in
 */
export async function isGuestCheckedIn(
  event: Event,
  guestId: string
): Promise<boolean> {
  const sheetsClient = getSheetsClient();
  const result = await sheetsClient.findGuestByIdWithRow(event, guestId);

  return result?.guest.checkin || false;
}

/**
 * Ottiene statistiche check-in per un evento
 */
export async function getCheckInStats(event: Event) {
  const sheetsClient = getSheetsClient();
  const guests = await sheetsClient.getGuests(event);

  const totalGuests = guests.length;
  const checkedIn = guests.filter((g) => g.checkin).length;

  // Conta check-in ultimi 10 minuti
  const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
  const recentCheckIns = guests.filter((g) => {
    if (!g.checkin || !g.checkinTime) return false;
    const checkinDate = new Date(g.checkinTime);
    return checkinDate.getTime() > tenMinutesAgo;
  }).length;

  // Ultimo check-in
  const checkedInGuests = guests
    .filter((g) => g.checkin && g.checkinTime)
    .sort((a, b) => {
      const dateA = new Date(a.checkinTime!).getTime();
      const dateB = new Date(b.checkinTime!).getTime();
      return dateB - dateA;
    });

  const lastCheckInTime = checkedInGuests[0]?.checkinTime;

  return {
    totalGuests,
    checkedIn,
    recentCheckIns,
    lastCheckInTime,
  };
}
