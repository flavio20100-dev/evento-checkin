import { NextRequest, NextResponse } from 'next/server';
import { getSyncService } from '@/lib/firestore/sync';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/nextauth';

/**
 * POST /api/admin/sync
 * Manual sync trigger dall'admin panel
 *
 * SECURITY: Richiede autenticazione admin
 */
export async function POST(req: NextRequest) {
  // Check admin authentication
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json(
      { error: 'Non autenticato' },
      { status: 401 }
    );
  }

  try {
    console.log(`[AdminSync] 🔄 Manual sync triggered by ${session.user?.email}`);

    const syncService = getSyncService();

    // Sync all active events
    const syncResult = await syncService.syncAllActiveEvents();

    console.log(
      `[AdminSync] ✅ Sync completed: ${syncResult.successful}/${syncResult.total} events succeeded`
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
    console.error('[AdminSync] ❌ Sync failed:', error);

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
