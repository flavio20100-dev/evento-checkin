import { NextRequest, NextResponse } from 'next/server';
import { validateEventAccess } from '@/lib/auth/permissions';
import { addCheckInToQueue } from '@/lib/queue/checkin-queue';
import { undoCheckIn, ConflictError } from '@/lib/sheets/checkin';
import { CheckInSchema } from '@/lib/validation/schemas';

/**
 * POST /api/events/[eventId]/checkin
 * Check-in invitato (hostess con event code)
 *
 * NUOVO: Usa queue system per evitare sovraccarico Google Sheets API
 * - Risponde immediatamente (no timeout)
 * - Processing in background
 * - Optimistic UI mostra check-in subito
 */
export async function POST(
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

    // Parse & validate body
    const body = await req.json();
    const result = CheckInSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Dati non validi', details: result.error.flatten() },
        { status: 400 }
      );
    }

    // NUOVO: Aggiungi a queue invece di scrivere immediatamente
    // Risponde subito, processing in background
    const queueResult = await addCheckInToQueue(
      params.eventId,
      result.data.guestId,
      eventCode,
      {
        entrance: result.data.entrance,
        checkedInBy: result.data.checkedInBy,
      }
    );

    // Risposta immediata (optimistic UI già aggiornata)
    return NextResponse.json({
      success: true,
      queued: true,
      guestId: result.data.guestId,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Check-in queue error:', error);

    return NextResponse.json(
      { error: error.message || 'Check-in fallito' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/events/[eventId]/checkin
 * Annulla check-in invitato (hostess con event code)
 */
export async function DELETE(
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

    // Parse body for guestId
    const body = await req.json();
    const { guestId } = body;

    if (!guestId) {
      return NextResponse.json(
        { error: 'guestId richiesto' },
        { status: 400 }
      );
    }

    // Undo check-in
    const result = await undoCheckIn(event, guestId);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Undo check-in error:', error);

    return NextResponse.json(
      { error: error.message || 'Annullamento check-in fallito' },
      { status: 500 }
    );
  }
}
