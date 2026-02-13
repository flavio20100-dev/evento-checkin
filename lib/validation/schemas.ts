import { z } from 'zod';

/**
 * Schema validazione check-in request
 */
export const CheckInSchema = z.object({
  guestId: z.string().min(1, 'Guest ID richiesto'),
  eventId: z.string().min(1, 'Event ID richiesto'),
  entrance: z.string().max(50).optional(),
  checkedInBy: z.string().email().optional(),
});

export type CheckInInput = z.infer<typeof CheckInSchema>;

/**
 * Schema validazione creazione evento
 */
export const CreateEventSchema = z.object({
  name: z.string().min(3, 'Nome evento troppo corto').max(100),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data formato YYYY-MM-DD'),
  sheetId: z.string().min(20, 'Sheet ID non valido'),
  tabName: z.string().min(1, 'Tab name richiesto').max(100),
  eventCode: z.string().length(6, 'Event code deve essere 6 caratteri').optional(),
});

export type CreateEventInput = z.infer<typeof CreateEventSchema>;

/**
 * Schema validazione event code access
 */
export const EventCodeSchema = z.object({
  code: z.string().length(6, 'Event code deve essere 6 caratteri').toUpperCase(),
});

export type EventCodeInput = z.infer<typeof EventCodeSchema>;

/**
 * Schema validazione ricerca guest
 */
export const GuestSearchSchema = z.object({
  query: z.string().min(2, 'Minimo 2 caratteri').max(100),
  eventId: z.string().min(1, 'Event ID richiesto'),
});

export type GuestSearchInput = z.infer<typeof GuestSearchSchema>;
