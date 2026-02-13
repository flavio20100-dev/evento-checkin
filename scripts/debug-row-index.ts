/**
 * Script di debug per verificare i _rowIndex in Firestore
 *
 * Uso:
 * npx tsx scripts/debug-row-index.ts
 */

import { getFirestoreClient } from '../lib/firestore/client';

async function debugRowIndexes() {
  const eventId = 'evt_Wz9qUpLTz7'; // Il tuo evento

  const firestoreClient = getFirestoreClient();
  const guests = await firestoreClient.getGuests(eventId);

  console.log(`\n=== DEBUG ROW INDEXES ===`);
  console.log(`Total guests: ${guests.length}`);
  console.log(`\nChecked-in guests with _rowIndex:\n`);

  const checkedInGuests = guests.filter(g => g.checkin);

  for (const guest of checkedInGuests) {
    const rowIndex = (guest as any)._rowIndex;
    console.log(`${guest.cognome} ${guest.nome} → _rowIndex: ${rowIndex} (${typeof rowIndex})`);

    if (typeof rowIndex !== 'number') {
      console.log(`  ⚠️  WARNING: _rowIndex is missing or not a number!`);
    }
  }

  console.log(`\nFirst 10 guests (all) with _rowIndex:\n`);

  for (let i = 0; i < Math.min(10, guests.length); i++) {
    const guest = guests[i];
    const rowIndex = (guest as any)._rowIndex;
    console.log(`${i + 1}. ${guest.cognome} ${guest.nome} → _rowIndex: ${rowIndex}`);
  }
}

debugRowIndexes()
  .then(() => {
    console.log('\n✅ Debug completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
