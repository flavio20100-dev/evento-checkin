import { NextRequest, NextResponse } from 'next/server';
import { getSheetsClient } from '@/lib/sheets/client';
import { validateEventAccess } from '@/lib/auth/permissions';

/**
 * GET /api/events/[eventId]/guests
 * Lista invitati per evento
 * Richiede header X-Event-Code (hostess) o session auth (admin)
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

    // Fetch guests
    const sheetsClient = getSheetsClient();
    const guests = await sheetsClient.getGuests(event);

    return NextResponse.json(guests);
  } catch (error: any) {
    console.error('Error fetching guests:', error);
    return NextResponse.json(
      { error: error.message || 'Impossibile recuperare lista' },
      { status: 500 }
    );
  }
}
