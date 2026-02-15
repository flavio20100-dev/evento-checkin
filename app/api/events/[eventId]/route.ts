import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/nextauth';
import { getFirestoreClient } from '@/lib/firestore/client';

/**
 * DELETE /api/events/[eventId]
 * Cancella evento da Firestore (admin auth required)
 *
 * NOTA: L'evento rimane in Google Sheets (master data).
 * Per rimuoverlo completamente, cancellalo anche dal Google Sheet manualmente.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { eventId: string } }
) {
  // Check admin authentication
  const session = await auth();

  if (!session || !session.user?.email) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
  }

  try {
    const { eventId } = params;

    console.log(`[DeleteEvent] Cancellazione evento ${eventId} by ${session.user.email}`);

    const firestoreClient = getFirestoreClient();
    const db = (firestoreClient as any).getDb();

    // 1. Cancella tutti i guests per questo evento
    const guestsRef = db
      .collection('events')
      .doc(eventId)
      .collection('guests');

    const guestsSnapshot = await guestsRef.get();

    // Delete in batch (max 500 per batch)
    const batches: any[] = [];
    let batch = db.batch();
    let batchCount = 0;

    for (const guestDoc of guestsSnapshot.docs) {
      batch.delete(guestDoc.ref);
      batchCount++;

      if (batchCount >= 500) {
        batches.push(batch);
        batch = db.batch();
        batchCount = 0;
      }
    }

    if (batchCount > 0) {
      batches.push(batch);
    }

    // Commit all batches
    for (const b of batches) {
      await b.commit();
    }

    console.log(`[DeleteEvent] Cancellati ${guestsSnapshot.size} guests`);

    // 2. Cancella il metadata document
    const metadataRef = db
      .collection('events')
      .doc(eventId)
      .collection('metadata')
      .doc('data');

    const metadataDoc = await metadataRef.get();
    if (metadataDoc.exists) {
      await metadataRef.delete();
      console.log(`[DeleteEvent] Cancellato metadata`);
    }

    console.log(`[DeleteEvent] ✅ Evento ${eventId} cancellato da Firestore`);

    return NextResponse.json({
      success: true,
      eventId,
      guestsDeleted: guestsSnapshot.size,
      message: 'Evento cancellato da Firestore. Rimane in Google Sheets.',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[DeleteEvent] ❌ Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Cancellazione fallita',
      },
      { status: 500 }
    );
  }
}
