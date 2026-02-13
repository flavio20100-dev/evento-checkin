import { getFirestore, FieldValue, Firestore } from 'firebase-admin/firestore';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import type { Event } from '@/types/event';
import type { Guest } from '@/types/guest';

/**
 * Custom error per conflitti check-in
 */
export class ConflictError extends Error {
  constructor(
    public code: 'ALREADY_CHECKED_IN' | 'CONCURRENT_UPDATE',
    message: string,
    public checkinTime?: string
  ) {
    super(message);
    this.name = 'ConflictError';
  }
}

/**
 * Firestore Client Singleton
 * Gestisce connessione Firebase e transazioni atomiche
 */
class FirestoreClient {
  private db: Firestore | null = null;

  /**
   * Inizializza Firebase Admin SDK (lazy init)
   */
  private getDb(): Firestore {
    if (this.db) {
      return this.db;
    }

    // Initialize Firebase Admin solo se non già fatto
    if (getApps().length === 0) {
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

      if (!projectId || !serviceAccountKey) {
        throw new Error(
          'Missing Firebase credentials. Set FIREBASE_PROJECT_ID and FIREBASE_SERVICE_ACCOUNT_KEY'
        );
      }

      let serviceAccount;
      try {
        serviceAccount = JSON.parse(serviceAccountKey);
      } catch (error) {
        throw new Error('Invalid FIREBASE_SERVICE_ACCOUNT_KEY JSON');
      }

      initializeApp({
        credential: cert(serviceAccount),
        projectId,
      });
    }

    // Get Firestore instance
    const db = getFirestore();

    // Ignora campi undefined (alcuni guests non hanno email, ecc.)
    // IMPORTANTE: settings() può essere chiamato solo UNA VOLTA globalmente
    try {
      db.settings({ ignoreUndefinedProperties: true });
    } catch (error: any) {
      // Ignora errore se settings() già chiamato (Firestore singleton)
      if (!error.message?.includes('already been initialized')) {
        throw error;
      }
    }

    this.db = db;
    return this.db;
  }

  /**
   * Esegue check-in con transazione atomica + retry automatico
   *
   * GARANZIE:
   * - Solo 1 transazione vince (atomicità Firestore)
   * - Retry automatico su errori transienti (max 5 tentativi)
   * - Exponential backoff tra retry
   * - Impossibile doppio check-in
   *
   * @throws ConflictError se invitato già checked-in
   * @throws Error se fallisce definitivamente dopo 5 tentativi
   */
  async performCheckIn(
    eventId: string,
    guestId: string,
    data: { entrance?: string; checkedInBy?: string } = {}
  ): Promise<{ success: true; guest: Guest; timestamp: string }> {
    const MAX_RETRIES = 5;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const db = this.getDb();

        // TRANSAZIONE ATOMICA (solo 1 vince su concurrent updates)
        const result = await db.runTransaction(async (transaction) => {
          // 1. READ: Leggi guest corrente
          const guestRef = db
            .collection('events')
            .doc(eventId)
            .collection('guests')
            .doc(guestId);

          const guestDoc = await transaction.get(guestRef);

          if (!guestDoc.exists) {
            throw new Error('Guest non trovato');
          }

          const guest = guestDoc.data() as Guest;

          // 2. CHECK: Già checked-in?
          if (guest.checkin) {
            throw new ConflictError(
              'ALREADY_CHECKED_IN',
              'Invitato già registrato',
              guest.checkinTime
            );
          }

          // 3. WRITE: Update atomico (solo questa transazione vince)
          const timestamp = new Date().toISOString();

          transaction.update(guestRef, {
            checkin: true,
            checkinTime: timestamp,
            entrance: data.entrance || null,
            checkedInBy: data.checkedInBy || null,
            _lastModified: FieldValue.serverTimestamp(),
            _syncedToSheets: false,
            _version: FieldValue.increment(1),
          });

          // 4. UPDATE: Event stats
          const eventRef = db
            .collection('events')
            .doc(eventId)
            .collection('metadata')
            .doc('data');

          transaction.update(eventRef, {
            'stats.checkedIn': FieldValue.increment(1),
            'stats.lastCheckInAt': FieldValue.serverTimestamp(),
          });

          return {
            success: true as const,
            guest: { ...guest, checkin: true, checkinTime: timestamp },
            timestamp,
          };
        });

        // Successo!
        console.log(`[Firestore] ✅ Check-in: ${guestId} (attempt ${attempt})`);
        return result;
      } catch (error: any) {
        // ConflictError non è retriable (invitato già checked-in)
        if (error instanceof ConflictError) {
          throw error;
        }

        // Retry su errori transienti
        if (attempt < MAX_RETRIES && this.isRetryableError(error)) {
          const backoffMs = Math.pow(2, attempt) * 100; // 200ms, 400ms, 800ms, 1600ms, 3200ms
          console.warn(
            `[Firestore] ⚠️ Retry ${attempt}/${MAX_RETRIES} dopo ${backoffMs}ms:`,
            error.message
          );
          await sleep(backoffMs);
          continue;
        }

        // Fallimento definitivo
        console.error(
          `[Firestore] ❌ Check-in fallito definitivamente dopo ${attempt} tentativi:`,
          error
        );
        throw new Error(
          `Check-in fallito: ${error.message || 'Errore sconosciuto'}`
        );
      }
    }

    // Questo punto non dovrebbe mai essere raggiunto
    throw new Error('Check-in fallito: max retry superati');
  }

  /**
   * Annulla check-in con transazione atomica
   */
  async undoCheckIn(
    eventId: string,
    guestId: string
  ): Promise<{ success: boolean; guest: Guest }> {
    const db = this.getDb();

    const result = await db.runTransaction(async (transaction) => {
      // 1. READ
      const guestRef = db
        .collection('events')
        .doc(eventId)
        .collection('guests')
        .doc(guestId);

      const guestDoc = await transaction.get(guestRef);

      if (!guestDoc.exists) {
        throw new Error('Guest non trovato');
      }

      const guest = guestDoc.data() as Guest;

      // 2. CHECK
      if (!guest.checkin) {
        throw new Error('Invitato non ha fatto check-in');
      }

      // 3. WRITE: Reset check-in fields
      transaction.update(guestRef, {
        checkin: false,
        checkinTime: null,
        entrance: null,
        checkedInBy: null,
        _lastModified: FieldValue.serverTimestamp(),
        _syncedToSheets: false,
        _version: FieldValue.increment(1),
      });

      // 4. UPDATE: Event stats
      const eventRef = db
        .collection('events')
        .doc(eventId)
        .collection('metadata')
        .doc('data');

      transaction.update(eventRef, {
        'stats.checkedIn': FieldValue.increment(-1),
      });

      return {
        success: true,
        guest: { ...guest, checkin: false, checkinTime: undefined },
      };
    });

    console.log(`[Firestore] ✅ Undo check-in: ${guestId}`);
    return result;
  }

  /**
   * Get tutti gli invitati per un evento
   */
  async getGuests(eventId: string): Promise<Guest[]> {
    const db = this.getDb();

    const snapshot = await db
      .collection('events')
      .doc(eventId)
      .collection('guests')
      .orderBy('cognome')
      .get();

    return snapshot.docs.map((doc) => doc.data() as Guest);
  }

  /**
   * Get invitati non ancora sincronizzati con Sheets
   */
  async getUnsyncedGuests(eventId: string): Promise<Guest[]> {
    const db = this.getDb();

    const snapshot = await db
      .collection('events')
      .doc(eventId)
      .collection('guests')
      .where('_syncedToSheets', '==', false)
      .orderBy('_lastModified', 'asc')
      .limit(100) // Max 100 per batch
      .get();

    return snapshot.docs.map((doc) => doc.data() as Guest);
  }

  /**
   * Marca invitati come sincronizzati
   */
  async markAsSynced(eventId: string, guestIds: string[]): Promise<void> {
    const db = this.getDb();
    const batch = db.batch();

    for (const guestId of guestIds) {
      const guestRef = db
        .collection('events')
        .doc(eventId)
        .collection('guests')
        .doc(guestId);

      batch.update(guestRef, {
        _syncedToSheets: true,
      });
    }

    await batch.commit();
    console.log(`[Firestore] ✅ Marked ${guestIds.length} guests as synced`);
  }

  /**
   * Get event metadata
   */
  async getEventMetadata(eventId: string): Promise<Event | null> {
    const db = this.getDb();

    const doc = await db
      .collection('events')
      .doc(eventId)
      .collection('metadata')
      .doc('data')
      .get();

    if (!doc.exists) {
      return null;
    }

    return doc.data() as Event;
  }

  /**
   * Update last sync timestamp
   */
  async updateLastSyncTimestamp(eventId: string): Promise<void> {
    const db = this.getDb();

    await db
      .collection('events')
      .doc(eventId)
      .collection('metadata')
      .doc('data')
      .update({
        lastSyncedAt: FieldValue.serverTimestamp(),
      });
  }

  /**
   * Log operazione fallita a dead letter queue
   */
  async logToDeadLetterQueue(
    eventId: string,
    operation: string,
    error: any,
    details?: any
  ): Promise<void> {
    const db = this.getDb();

    await db.collection('_deadLetterQueue').add({
      eventId,
      operation,
      error: error.message || String(error),
      errorStack: error.stack,
      details: details || null,
      timestamp: FieldValue.serverTimestamp(),
      status: 'pending_manual_review',
    });

    console.error(
      `[Firestore] 💀 Dead letter queue: ${operation} for ${eventId}`
    );
  }

  /**
   * Verifica se errore è retriable (transient)
   */
  private isRetryableError(error: any): boolean {
    // Firestore transient errors
    const retriableCodes = [
      'ABORTED',
      'UNAVAILABLE',
      'DEADLINE_EXCEEDED',
      'RESOURCE_EXHAUSTED',
      'INTERNAL',
    ];

    return retriableCodes.includes(error.code);
  }
}

// Singleton instance
let firestoreClient: FirestoreClient | null = null;

/**
 * Get Firestore client singleton
 */
export function getFirestoreClient(): FirestoreClient {
  if (!firestoreClient) {
    firestoreClient = new FirestoreClient();
  }
  return firestoreClient;
}

// Utility
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
