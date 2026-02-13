import { NextRequest, NextResponse } from 'next/server';
import { getFirestoreClient } from '@/lib/firestore/client';

/**
 * DEBUG ENDPOINT: Verifica _rowIndex in Firestore
 *
 * GET /api/debug/row-index?eventId=evt_Wz9qUpLTz7
 */
export async function GET(req: NextRequest) {
  try {
    const eventId =
      req.nextUrl.searchParams.get('eventId') || 'evt_Wz9qUpLTz7';

    const firestoreClient = getFirestoreClient();
    const guests = await firestoreClient.getGuests(eventId);

    const checkedInGuests = guests
      .filter((g) => g.checkin)
      .map((g) => ({
        guestId: g.guestId,
        nome: g.nome,
        cognome: g.cognome,
        _rowIndex: (g as any)._rowIndex,
        _rowIndexType: typeof (g as any)._rowIndex,
        checkinTime: g.checkinTime,
      }));

    const firstTen = guests.slice(0, 10).map((g) => ({
      guestId: g.guestId,
      nome: g.nome,
      cognome: g.cognome,
      checkin: g.checkin,
      _rowIndex: (g as any)._rowIndex,
      _rowIndexType: typeof (g as any)._rowIndex,
    }));

    return NextResponse.json({
      eventId,
      totalGuests: guests.length,
      checkedInCount: checkedInGuests.length,
      checkedInGuests,
      firstTenGuests: firstTen,
    });
  } catch (error: any) {
    console.error('[Debug] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
