import { NextRequest, NextResponse } from 'next/server';
import { getFirestoreClient } from '@/lib/firestore/client';
import { FieldValue } from 'firebase-admin/firestore';
import { auth } from '@/lib/auth/nextauth';

/**
 * POST /api/admin/migrate
 * Data migration: fix missing fields in guest documents
 *
 * SECURITY: Richiede autenticazione admin
 */
export async function POST(req: NextRequest) {
  // Check admin authentication
  const session = await auth();

  if (!session) {
    return NextResponse.json(
      { error: 'Non autenticato' },
      { status: 401 }
    );
  }

  try {
    console.log(`[Migration] Started by ${session.user?.email}`);

    const client = getFirestoreClient();
    const db = client.getDb();

    // Get all events
    const eventsSnapshot = await db.collection('events').get();

    let totalMigrated = 0;
    const eventResults: any[] = [];

    for (const eventDoc of eventsSnapshot.docs) {
      const eventId = eventDoc.id;
      console.log(`[Migration] Processing event: ${eventId}`);

      // Get all guests for this event
      const guestsSnapshot = await db
        .collection('events')
        .doc(eventId)
        .collection('guests')
        .get();

      const batch = db.batch();
      let batchCount = 0;
      let eventMigrated = 0;

      for (const guestDoc of guestsSnapshot.docs) {
        const guest = guestDoc.data();
        const updates: any = {};

        // Fix _syncedToSheets: null → false
        if (guest._syncedToSheets === null || guest._syncedToSheets === undefined) {
          updates._syncedToSheets = false;
        }

        // Add missing _lastModified
        if (!guest._lastModified) {
          updates._lastModified = FieldValue.serverTimestamp();
        }

        // Add missing _createdAt
        if (!guest._createdAt) {
          updates._createdAt = FieldValue.serverTimestamp();
        }

        // Add missing _version
        if (!guest._version) {
          updates._version = 1;
        }

        // Ensure all optional fields are explicitly null (not undefined)
        if (guest.checkinTime === undefined) updates.checkinTime = null;
        if (guest.entrance === undefined) updates.entrance = null;
        if (guest.checkedInBy === undefined) updates.checkedInBy = null;
        if (guest.azienda === undefined) updates.azienda = '';

        // Apply updates if any
        if (Object.keys(updates).length > 0) {
          batch.update(guestDoc.ref, updates);
          batchCount++;
          eventMigrated++;
          totalMigrated++;

          console.log(`  - Migrating guest ${guestDoc.id}: ${Object.keys(updates).join(', ')}`);
        }

        // Commit batch every 500 writes (Firestore limit)
        if (batchCount >= 500) {
          await batch.commit();
          console.log(`  ✅ Committed batch of ${batchCount} updates`);
          batchCount = 0;
        }
      }

      // Commit remaining updates
      if (batchCount > 0) {
        await batch.commit();
        console.log(`  ✅ Committed final batch of ${batchCount} updates`);
      }

      eventResults.push({
        eventId,
        totalGuests: guestsSnapshot.size,
        migrated: eventMigrated,
      });

      console.log(`[Migration] Event ${eventId} complete: ${eventMigrated}/${guestsSnapshot.size} guests migrated`);
    }

    console.log(`\n✅ Migration complete! Total guests migrated: ${totalMigrated}`);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      totalEvents: eventsSnapshot.size,
      totalGuestsMigrated: totalMigrated,
      eventResults,
    });
  } catch (error: any) {
    console.error('[Migration] ❌ Failed:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Migration fallita',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
