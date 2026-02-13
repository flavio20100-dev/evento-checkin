import { NextRequest, NextResponse } from 'next/server';
import { getSyncService } from '@/lib/firestore/sync';

/**
 * POST /api/sync
 * Vercel Cron endpoint per sync Firestore → Google Sheets
 *
 * SECURITY: Richiede Bearer token (CRON_SECRET)
 * FREQUENZA: Ogni 1 minuto (configurato in vercel.json)
 *
 * Flow:
 * 1. Get tutti gli eventi attivi
 * 2. Per ogni evento, sync guests unsynced
 * 3. Mark as synced solo se Sheets update succeeded
 * 4. Log errori a dead letter queue
 */
export async function POST(req: NextRequest) {
  // Security: Vercel Cron secret
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error('[Cron] CRON_SECRET non configurato');
    return NextResponse.json(
      { error: 'Cron secret non configurato' },
      { status: 500 }
    );
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    console.error('[Cron] Unauthorized: invalid or missing Bearer token');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log(`[Cron] 🔄 Starting sync at ${new Date().toISOString()}`);

    const syncService = getSyncService();

    // Sync all active events
    const syncResult = await syncService.syncAllActiveEvents();

    console.log(
      `[Cron] ✅ Sync completed: ${syncResult.successful}/${syncResult.total} events succeeded`
    );

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      totalEvents: syncResult.total,
      successful: syncResult.successful,
      failed: syncResult.failed,
      results: syncResult.results,
    });
  } catch (error: any) {
    console.error('[Cron] ❌ Sync failed:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Sync fallito',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/sync
 * Health check / manual trigger (for testing)
 */
export async function GET() {
  return NextResponse.json({
    status: 'ready',
    message: 'Sync endpoint is ready. Use POST with Bearer token to trigger sync.',
  });
}
