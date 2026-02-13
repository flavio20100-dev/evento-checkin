import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/nextauth';
import { getSheetsClient } from '@/lib/sheets/client';
import { CreateEventSchema } from '@/lib/validation/schemas';

/**
 * GET /api/events
 * Lista eventi (admin auth required)
 * Query param ?code=ABC123 per validare event code (hostess, no auth)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const eventCode = searchParams.get('code');

  // Se c'è event code, è richiesta hostess (no auth)
  if (eventCode) {
    try {
      const sheetsClient = getSheetsClient();
      const event = await sheetsClient.getEventByCode(eventCode.toUpperCase());

      if (!event) {
        return NextResponse.json(
          { error: 'Codice evento non valido' },
          { status: 404 }
        );
      }

      return NextResponse.json([event]); // Array per compatibilità
    } catch (error) {
      console.error('Error validating event code:', error);
      return NextResponse.json(
        { error: 'Errore validazione codice' },
        { status: 500 }
      );
    }
  }

  // Altrimenti è richiesta admin (auth required)
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sheetsClient = getSheetsClient();
    const events = await sheetsClient.getEvents();

    return NextResponse.json(events);
  } catch (error) {
    console.error('Error fetching events:', error);
    return NextResponse.json(
      { error: 'Impossibile recuperare eventi' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/events
 * Crea nuovo evento (admin auth required)
 */
export async function POST(req: NextRequest) {
  const session = await auth();

  if (!session || !session.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();

    // Validate input
    const result = CreateEventSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Dati non validi', details: result.error.flatten() },
        { status: 400 }
      );
    }

    const sheetsClient = getSheetsClient();
    const event = await sheetsClient.createEvent(
      result.data,
      session.user.email
    );

    return NextResponse.json(event, { status: 201 });
  } catch (error: any) {
    console.error('Error creating event:', error);
    return NextResponse.json(
      { error: error.message || 'Impossibile creare evento' },
      { status: 500 }
    );
  }
}
