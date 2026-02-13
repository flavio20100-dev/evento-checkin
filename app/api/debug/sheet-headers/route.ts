import { NextRequest, NextResponse } from 'next/server';
import { getSheetsClient } from '@/lib/sheets/client';

/**
 * DEBUG: Verifica headers e indici colonne dello sheet
 *
 * GET /api/debug/sheet-headers?eventCode=MH5JIN
 */
export async function GET(req: NextRequest) {
  try {
    const eventCode =
      req.nextUrl.searchParams.get('eventCode') || 'MH5JIN';

    const sheetsClient = getSheetsClient();
    const event = await sheetsClient.getEventByCode(eventCode);

    if (!event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    // Read headers from sheet
    const response = await (sheetsClient as any).sheets.spreadsheets.values.get(
      {
        spreadsheetId: event.sheetId,
        range: `${event.tabName}!1:1`,
      }
    );

    const headers = (response.data.values?.[0] || []).map((h: any) =>
      String(h).toLowerCase()
    );

    const mappings = event.columnMappings || {
      nome: 'nome',
      cognome: 'cognome',
      azienda: 'azienda',
      guestId: 'guestid',
      checkin: 'checkin',
      checkinTime: 'checkintime',
      entrance: 'entrance',
      checkedInBy: 'checkedinby',
    };

    // Calculate column indices
    const colIndexes = {
      nome: headers.indexOf(mappings.nome.toLowerCase()),
      cognome: headers.indexOf(mappings.cognome.toLowerCase()),
      azienda: headers.indexOf(mappings.azienda.toLowerCase()),
      guestId: headers.indexOf(mappings.guestId.toLowerCase()),
      checkin: headers.indexOf(mappings.checkin.toLowerCase()),
      checkinTime: headers.indexOf(mappings.checkinTime.toLowerCase()),
      entrance: mappings.entrance
        ? headers.indexOf(mappings.entrance.toLowerCase())
        : -1,
      checkedInBy: mappings.checkedInBy
        ? headers.indexOf(mappings.checkedInBy.toLowerCase())
        : -1,
    };

    // Convert to letters
    const colToLetter = (col: number) =>
      col >= 0 ? String.fromCharCode(65 + col) : 'NOT_FOUND';

    const colLetters = {
      nome: colToLetter(colIndexes.nome),
      cognome: colToLetter(colIndexes.cognome),
      azienda: colToLetter(colIndexes.azienda),
      guestId: colToLetter(colIndexes.guestId),
      checkin: colToLetter(colIndexes.checkin),
      checkinTime: colToLetter(colIndexes.checkinTime),
      entrance: colToLetter(colIndexes.entrance),
      checkedInBy: colToLetter(colIndexes.checkedInBy),
    };

    return NextResponse.json({
      eventCode,
      eventId: event.eventId,
      tabName: event.tabName,
      sheetId: event.sheetId,
      headersRaw: response.data.values?.[0] || [],
      headersLowercase: headers,
      mappings,
      colIndexes,
      colLetters,
      warnings: {
        missingCheckin: colIndexes.checkin === -1,
        missingCheckinTime: colIndexes.checkinTime === -1,
        missingEntrance: colIndexes.entrance === -1,
        missingCheckedInBy: colIndexes.checkedInBy === -1,
      },
    });
  } catch (error: any) {
    console.error('[Debug] Error:', error);
    return NextResponse.json(
      { error: error.message, stack: error.stack },
      { status: 500 }
    );
  }
}
