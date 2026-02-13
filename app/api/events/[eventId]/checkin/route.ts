import { NextRequest, NextResponse } from 'next/server';
import { validateEventAccess } from '@/lib/auth/permissions';
import { performCheckIn, undoCheckIn, ConflictError } from '@/lib/sheets/checkin';
import { CheckInSchema } from '@/lib/validation/schemas';

/**
 * POST /api/events/[eventId]/checkin
 * Check-in invitato (hostess con event code)
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

    // Perform check-in con lock ottimistico
    const checkInResult = await performCheckIn(event, result.data.guestId, {
      entrance: result.data.entrance,
      checkedInBy: result.data.checkedInBy,
    });

    return NextResponse.json(checkInResult);
  } catch (error: any) {
    console.error('Check-in error:', error);

    // Gestione ConflictError
    if (error instanceof ConflictError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          checkinTime: error.checkinTime,
        },
        { status: 409 }
      );
    }

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
