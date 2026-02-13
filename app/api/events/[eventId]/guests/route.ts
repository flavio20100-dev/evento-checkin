import { NextRequest, NextResponse } from 'next/server';
import { getFirestoreClient } from '@/lib/firestore/client';
import { validateEventAccess } from '@/lib/auth/permissions';

/**
 * GET /api/events/[eventId]/guests
 * Lista invitati per evento
 * Richiede header X-Event-Code (hostess) o session auth (admin)
 *
 * FIRESTORE VERSION:
 * - Lettura da Firestore (molto più veloce)
 * - No sovraccarico Google Sheets API
 * - Sync a Sheets in background via Cron
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { eventId: string } }
) {
  const eventCode = req.headers.get('X-Event-Code');

  if (!eventCode) {
    return NextResponse.json(
      { error: 'Event code richiesto (header X-Event-Code)' },
      { status: 401 }
    );
  }

  try {
    // Valida event code
    const event = await validateEventAccess(eventCode);

    if (!event || event.eventId !== params.eventId) {
      return NextResponse.json(
        { error: 'Event code non valido per questo evento' },
        { status: 403 }
      );
    }

    // FIRESTORE: Fetch guests (molto più veloce di Sheets)
    const firestoreClient = getFirestoreClient();
    const guests = await firestoreClient.getGuests(params.eventId);

    return NextResponse.json(guests);
  } catch (error: any) {
    console.error('[GetGuests] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Impossibile recuperare lista' },
      { status: 500 }
    );
  }
}
