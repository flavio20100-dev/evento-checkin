import { NextRequest, NextResponse } from 'next/server';
import { getSyncService } from '@/lib/firestore/sync';

/**
 * POST /api/sync/initial-load
 * Carica evento da Google Sheets a Firestore (prima volta)
 *
 * Body: { eventCode: string }
 *
 * IMPORTANTE: Usa questo endpoint solo per initial load.
 * Dopo il primo load, sync automatico gestito da Vercel Cron.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { eventCode } = body;

    if (!eventCode) {
      return NextResponse.json(
        { error: 'eventCode richiesto nel body' },
        { status: 400 }
      );
    }

    console.log(`[InitialLoad] 🔄 Loading event ${eventCode} to Firestore...`);

    const syncService = getSyncService();

    // Load event from Sheets to Firestore
    const result = await syncService.loadEventFromSheetsToFirestore(eventCode);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
        },
        { status: 500 }
      );
    }

    console.log(
      `[InitialLoad] ✅ Event ${eventCode}: ${result.guestsLoaded} guests loaded`
    );

    return NextResponse.json({
      success: true,
      eventCode,
      guestsLoaded: result.guestsLoaded,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[InitialLoad] ❌ Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Initial load fallito',
      },
      { status: 500 }
    );
  }
}
