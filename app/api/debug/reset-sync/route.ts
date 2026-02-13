import { NextRequest, NextResponse } from 'next/server';
import { getFirestoreClient } from '@/lib/firestore/client';

/**
 * DEBUG: Reset _syncedToSheets flag per tutti i guest checked-in
 *
 * Usa questo quando hai cancellato manualmente i check-in dallo sheet
 * e vuoi che il sync li risincronizzi
 */
export async function POST(req: NextRequest) {
  try {
    const { eventId } = await req.json();

    if (!eventId) {
      return NextResponse.json(
        { error: 'eventId required' },
        { status: 400 }
      );
    }

    const firestoreClient = getFirestoreClient();
    const db = (firestoreClient as any).getDb();

    // Get all checked-in guests
    const snapshot = await db
      .collection('events')
      .doc(eventId)
      .collection('guests')
      .where('checkin', '==', true)
      .get();

    console.log(`[ResetSync] Found ${snapshot.size} checked-in guests`);

    // Reset _syncedToSheets flag in batch
    const batch = db.batch();

    snapshot.docs.forEach((doc: any) => {
      batch.update(doc.ref, {
        _syncedToSheets: false,
      });
    });

    await batch.commit();

    console.log(`[ResetSync] ✅ Reset ${snapshot.size} guests`);

    return NextResponse.json({
      success: true,
      guestsReset: snapshot.size,
      message: `Reset _syncedToSheets flag for ${snapshot.size} guests`,
    });
  } catch (error: any) {
    console.error('[ResetSync] Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
