import { NextRequest, NextResponse } from 'next/server';
import { getSheetsClient } from '@/lib/sheets/client';

/**
 * DEBUG: Legge direttamente dallo sheet per verificare i check-in
 */
export async function GET(req: NextRequest) {
  try {
    const eventCode = req.nextUrl.searchParams.get('eventCode') || 'MH5JIN';

    const sheetsClient = getSheetsClient();
    const event = await sheetsClient.getEventByCode(eventCode);

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Leggi le colonne F e G (Checkin e CheckinTime) per le righe 2-31
    const response = await (sheetsClient as any).sheets.spreadsheets.values.get({
      spreadsheetId: event.sheetId,
      range: `${event.tabName}!F2:G31`,
    });

    const values = response.data.values || [];

    // Count check-ins
    const checkIns = values.filter((row: any[]) => row[0] === 'SI' || row[0] === 'si' || row[0]?.toLowerCase() === 'si');

    return NextResponse.json({
      eventCode,
      sheetId: event.sheetId,
      tabName: event.tabName,
      rangeQueried: `${event.tabName}!F2:G31`,
      totalRows: values.length,
      checkInsFound: checkIns.length,
      firstTenRows: values.slice(0, 10).map((row: any[], idx: number) => ({
        row: idx + 2,
        checkin: row[0] || '(vuoto)',
        checkinTime: row[1] || '(vuoto)',
      })),
      allCheckIns: checkIns.map((row: any[], idx: number) => {
        const originalIndex = values.indexOf(row);
        return {
          row: originalIndex + 2,
          checkin: row[0],
          checkinTime: row[1],
        };
      }),
    });
  } catch (error: any) {
    console.error('[Debug] Error:', error);
    return NextResponse.json(
      { error: error.message, stack: error.stack },
      { status: 500 }
    );
  }
}
