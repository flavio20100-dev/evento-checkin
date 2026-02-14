/**
 * Reset _syncedToSheets flags per tutti i guest checked-in
 *
 * Uso: npx tsx scripts/reset-sync-flags.ts
 */

import { getFirestoreClient } from '../lib/firestore/client';

async function resetSyncFlags() {
  const eventId = 'evt_Wz9qUpLTz7';

  console.log(`\n🔄 Resetting _syncedToSheets flags for event ${eventId}...\n`);

  const firestoreClient = getFirestoreClient();
  const db = (firestoreClient as any).getDb();

  // Get all checked-in guests
  const snapshot = await db
    .collection('events')
    .doc(eventId)
    .collection('guests')
    .where('checkin', '==', true)
    .get();

  console.log(`📊 Found ${snapshot.size} checked-in guests\n`);

  if (snapshot.size === 0) {
    console.log('✅ No guests to reset');
    return;
  }

  // Reset _syncedToSheets flag in batch
  const batch = db.batch();

  snapshot.docs.forEach((doc: any) => {
    const guest = doc.data();
    console.log(`  - ${guest.cognome} ${guest.nome} (row ${guest._rowIndex})`);

    batch.update(doc.ref, {
      _syncedToSheets: false,
    });
  });

  await batch.commit();

  console.log(`\n✅ Successfully reset ${snapshot.size} guests!`);
  console.log(`\n💡 Now run: curl -X POST http://localhost:3000/api/sync/manual`);
}

resetSyncFlags()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
