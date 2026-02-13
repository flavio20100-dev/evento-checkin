import { getSheetsClient } from '@/lib/sheets/client';
import type { Event } from '@/types/event';

/**
 * Valida event code e ritorna evento se valido
 *
 * Controlla:
 * - Evento esiste
 * - Stato è "active"
 * - Data evento è entro ±24 ore (opzionale per MVP)
 */
export async function validateEventAccess(
  eventCode: string
): Promise<Event | null> {
  if (!eventCode || eventCode.length !== 6) {
    return null;
  }

  const sheetsClient = getSheetsClient();
  const event = await sheetsClient.getEventByCode(eventCode.toUpperCase());

  if (!event || event.status !== 'active') {
    return null;
  }

  // TODO MVP: Skip date validation per ora (verrà aggiunto in Fase 2)
  // Consente accesso a eventi anche se non sono oggi

  return event;
}

/**
 * Verifica se un event code è valido (boolean quick check)
 */
export async function isValidEventCode(eventCode: string): Promise<boolean> {
  const event = await validateEventAccess(eventCode);
  return event !== null;
}
