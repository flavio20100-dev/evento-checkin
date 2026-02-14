/**
 * Reset _syncedToSheets flags - Node.js script
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccountKey = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccountKey),
    projectId: process.env.FIREBASE_PROJECT_ID,
  });
}

const db = admin.firestore();

async function resetFlags() {
  const eventId = 'evt_Wz9qUpLTz7';

  console.log('\n🔄 Resetting _syncedToSheets flags...\n');

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

  // Reset in batch
  const batch = db.batch();

  snapshot.docs.forEach((doc) => {
    const guest = doc.data();
    console.log(`  - ${guest.cognome} ${guest.nome} (row ${guest._rowIndex})`);

    batch.update(doc.ref, {
      _syncedToSheets: false,
    });
  });

  await batch.commit();

  console.log(`\n✅ Successfully reset ${snapshot.size} guests!`);
}

resetFlags()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
