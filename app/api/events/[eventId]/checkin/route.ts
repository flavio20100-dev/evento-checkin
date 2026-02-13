import { NextRequest, NextResponse } from 'next/server';
import { validateEventAccess } from '@/lib/auth/permissions';
import { getFirestoreClient, ConflictError } from '@/lib/firestore/client';
import { CheckInSchema } from '@/lib/validation/schemas';

/**
 * POST /api/events/[eventId]/checkin
 * Check-in invitato (hostess con event code)
 *
 * FIRESTORE VERSION - A PROVA DI BOMBA:
 * - Transazioni atomiche (impossibile doppio check-in)
 * - Retry automatico (max 5 tentativi)
 * - Persistenza garantita
 * - Sync a Sheets in background (Vercel Cron)
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

    // FIRESTORE: Transazione atomica con retry automatico
    const firestoreClient = getFirestoreClient();

    const checkInResult = await firestoreClient.performCheckIn(
      params.eventId,
      result.data.guestId,
      {
        entrance: result.data.entrance,
        checkedInBy: result.data.checkedInBy,
      }
    );

    // Successo garantito (altrimenti avrebbe fatto throw)
    return NextResponse.json({
      success: true,
      guestId: result.data.guestId,
      timestamp: checkInResult.timestamp,
    });
  } catch (error: any) {
    // ConflictError: invitato già checked-in
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

    console.error('[CheckIn] Error:', error);

    return NextResponse.json(
      { error: error.message || 'Check-in fallito, riprova' },
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

    // FIRESTORE: Undo check-in con transazione atomica
    const firestoreClient = getFirestoreClient();
    const result = await firestoreClient.undoCheckIn(params.eventId, guestId);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[UndoCheckIn] Error:', error);

    return NextResponse.json(
      { error: error.message || 'Annullamento check-in fallito' },
      { status: 500 }
    );
  }
}
