import { getFirestoreClient } from '@/lib/firestore/client';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * Migrazione per aggiungere field mancanti ai guest documents esistenti
 * Fix per query rotte causate da _syncedToSheets: null e _lastModified assente
 */
async function migrateGuestFields() {
  const client = getFirestoreClient();
  const db = client.getDb();

  // Get all events
  const eventsSnapshot = await db.collection('events').get();

  let totalMigrated = 0;

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

    console.log(`[Migration] Event ${eventId} complete`);
  }

  console.log(`\n✅ Migration complete! Total guests migrated: ${totalMigrated}`);
}

// Execute
migrateGuestFields()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });
