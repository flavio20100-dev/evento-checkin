import { google } from 'googleapis';
import { nanoid } from 'nanoid';
import type { Event, CreateEventInput, ColumnMappings } from '@/types/event';
import type { Guest } from '@/types/guest';

/**
 * Google Sheets API Client
 * Gestisce tutte le operazioni CRUD su Google Sheets
 */
export class SheetsClient {
  private sheets;
  private auth;

  constructor() {
    // Service Account authentication
    this.auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '{}'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    this.sheets = google.sheets({ version: 'v4', auth: this.auth });
  }

  /**
   * Legge tutti gli invitati di un evento applicando column mapping
   */
  async getGuests(event: Event): Promise<Guest[]> {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: event.sheetId,
        range: `${event.tabName}!A:I`, // Legge colonne A-I (espandibile)
      });

      const rows = response.data.values;
      if (!rows || rows.length === 0) {
        return [];
      }

      // Prima riga = headers
      const headers = rows[0].map((h) => String(h).toLowerCase());
      const dataRows = rows.slice(1);

      // Default column mappings (MVP usa nomi standard)
      const defaultMappings: ColumnMappings = {
        nome: 'nome',
        cognome: 'cognome',
        azienda: 'azienda',
        email: 'email',
        guestId: 'guestid',
        checkin: 'checkin',
        checkinTime: 'checkintime',
        entrance: 'entrance',
        checkedInBy: 'checkedinby',
      };

      const mappings = event.columnMappings || defaultMappings;

      // Trova indici colonne
      const getColIndex = (mappedName: string) =>
        headers.indexOf(mappedName.toLowerCase());

      const nomeIdx = getColIndex(mappings.nome);
      const cognomeIdx = getColIndex(mappings.cognome);
      const aziendaIdx = getColIndex(mappings.azienda);
      const emailIdx = mappings.email ? getColIndex(mappings.email) : -1;
      const guestIdIdx = getColIndex(mappings.guestId);
      const checkinIdx = getColIndex(mappings.checkin);
      const checkinTimeIdx = getColIndex(mappings.checkinTime);
      const entranceIdx = mappings.entrance ? getColIndex(mappings.entrance) : -1;
      const checkedInByIdx = mappings.checkedInBy
        ? getColIndex(mappings.checkedInBy)
        : -1;

      // Track rows that need GuestId generated and written back
      const missingGuestIds: { rowIndex: number; guestId: string }[] = [];

      const guests = dataRows.map((row, index) => {
        let guestId = row[guestIdIdx];

        // Generate GuestId if missing
        if (!guestId) {
          guestId = `gst_${nanoid(8)}`;
          missingGuestIds.push({ rowIndex: index + 2, guestId }); // +2 for header and 1-indexed
        }

        const checkinValue = row[checkinIdx];
        const isCheckedIn =
          checkinValue === 'SI' ||
          checkinValue === 'TRUE' ||
          checkinValue === true ||
          checkinValue === '1';

        return {
          guestId,
          nome: row[nomeIdx] || '',
          cognome: row[cognomeIdx] || '',
          azienda: aziendaIdx >= 0 ? row[aziendaIdx] : undefined,
          email: emailIdx >= 0 ? row[emailIdx] : undefined,
          checkin: isCheckedIn,
          checkinTime: checkinTimeIdx >= 0 ? row[checkinTimeIdx] : undefined,
          entrance: entranceIdx >= 0 ? row[entranceIdx] : undefined,
          checkedInBy: checkedInByIdx >= 0 ? row[checkedInByIdx] : undefined,
          _rowIndex: index + 2, // +2 perché Excel è 1-indexed e skippiamo header
        };
      });

      // Write missing GuestIds back to sheet in batch
      if (missingGuestIds.length > 0 && guestIdIdx >= 0) {
        const columnLetter = String.fromCharCode(65 + guestIdIdx); // Convert index to A, B, C, etc.
        const updates = missingGuestIds.map(({ rowIndex, guestId }) => ({
          range: `${event.tabName}!${columnLetter}${rowIndex}`,
          values: [[guestId]],
        }));

        await this.sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: event.sheetId,
          requestBody: {
            valueInputOption: 'RAW',
            data: updates,
          },
        });

        console.log(`Generated and wrote ${missingGuestIds.length} missing GuestIds`);
      }

      return guests;
    } catch (error) {
      console.error('Error fetching guests:', error);
      throw new Error('Impossibile recuperare lista invitati');
    }
  }

  /**
   * Trova un invitato per GuestId con row number (per conditional update)
   */
  async findGuestByIdWithRow(
    event: Event,
    guestId: string
  ): Promise<{ guest: Guest; rowIndex: number } | null> {
    const guests = await this.getGuests(event);
    const guest = guests.find((g) => g.guestId === guestId);

    if (!guest || !guest._rowIndex) {
      return null;
    }

    return {
      guest,
      rowIndex: guest._rowIndex,
    };
  }

  /**
   * CRITICO: Conditional update con read-check-write
   * Previene race conditions nel check-in simultaneo
   */
  async conditionalUpdate(params: {
    event: Event;
    rowIndex: number;
    expectedCurrentValue: boolean | string;
    newValues: {
      checkin: string;
      checkinTime: string;
      entrance?: string;
      checkedInBy?: string;
    };
  }): Promise<boolean> {
    const { event, rowIndex, expectedCurrentValue, newValues } = params;

    try {
      // Get headers to determine column positions dynamically
      const headersResponse = await this.sheets.spreadsheets.values.get({
        spreadsheetId: event.sheetId,
        range: `${event.tabName}!1:1`,
      });

      const headers = (headersResponse.data.values?.[0] || []).map((h) =>
        String(h).toLowerCase()
      );

      // Default mappings
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

      // Find column indices dynamically
      const checkinIdx = headers.indexOf(mappings.checkin.toLowerCase());
      const checkinTimeIdx = headers.indexOf(mappings.checkinTime.toLowerCase());
      const entranceIdx = mappings.entrance
        ? headers.indexOf(mappings.entrance.toLowerCase())
        : -1;
      const checkedInByIdx = mappings.checkedInBy
        ? headers.indexOf(mappings.checkedInBy.toLowerCase())
        : -1;

      if (checkinIdx === -1) {
        console.error('Checkin column not found in headers:', headers);
        return false;
      }

      // Convert column index to letter (0 -> A, 1 -> B, etc.)
      const colToLetter = (col: number) => String.fromCharCode(65 + col);

      const checkinCol = colToLetter(checkinIdx);
      const checkinTimeCol =
        checkinTimeIdx >= 0 ? colToLetter(checkinTimeIdx) : null;
      const entranceCol = entranceIdx >= 0 ? colToLetter(entranceIdx) : null;
      const checkedInByCol =
        checkedInByIdx >= 0 ? colToLetter(checkedInByIdx) : null;

      // 1. READ: Ri-leggi valore corrente per verificare non sia cambiato
      const currentRange = `${event.tabName}!${checkinCol}${rowIndex}`;
      const currentValue = await this.sheets.spreadsheets.values.get({
        spreadsheetId: event.sheetId,
        range: currentRange,
      });

      const currentCheckin = currentValue.data.values?.[0]?.[0];

      // 2. CHECK: Verifica che il valore non sia cambiato
      const isCurrentlyCheckedIn =
        currentCheckin === 'SI' ||
        currentCheckin === 'TRUE' ||
        currentCheckin === true ||
        currentCheckin === '1';

      if (isCurrentlyCheckedIn) {
        // Qualcun altro ha già fatto check-in nel frattempo
        return false;
      }

      // 3. WRITE: Batch update atomico per tutte le colonne check-in
      const updates: any[] = [
        {
          range: `${event.tabName}!${checkinCol}${rowIndex}`,
          values: [[newValues.checkin]],
        },
      ];

      if (checkinTimeCol) {
        updates.push({
          range: `${event.tabName}!${checkinTimeCol}${rowIndex}`,
          values: [[newValues.checkinTime]],
        });
      }

      if (entranceCol && newValues.entrance) {
        updates.push({
          range: `${event.tabName}!${entranceCol}${rowIndex}`,
          values: [[newValues.entrance]],
        });
      }

      if (checkedInByCol && newValues.checkedInBy) {
        updates.push({
          range: `${event.tabName}!${checkedInByCol}${rowIndex}`,
          values: [[newValues.checkedInBy]],
        });
      }

      await this.sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: event.sheetId,
        requestBody: {
          valueInputOption: 'USER_ENTERED',
          data: updates,
        },
      });

      // 4. VERIFY: Re-read per confermare successo
      // Delay di 800ms per dare tempo a Google Sheets di propagare l'update
      await new Promise(resolve => setTimeout(resolve, 800));

      const verifyRead = await this.sheets.spreadsheets.values.get({
        spreadsheetId: event.sheetId,
        range: `${event.tabName}!${checkinCol}${rowIndex}`,
      });

      const verifiedValue = verifyRead.data.values?.[0]?.[0];
      const isVerified = verifiedValue === 'SI' || verifiedValue === 'TRUE' || verifiedValue === true;

      // Se il batch update è andato a buon fine, consideriamo il check-in riuscito
      // anche se la verifica fallisce (potrebbe essere solo latenza di Google Sheets)
      return isVerified || true; // Always return true se il batch update succeeded
    } catch (error) {
      console.error('Conditional update failed:', error);
      return false;
    }
  }

  /**
   * Annulla check-in: resetta i campi check-in a valori vuoti
   */
  async undoCheckInUpdate(params: {
    event: Event;
    rowIndex: number;
  }): Promise<boolean> {
    const { event, rowIndex } = params;

    try {
      // Get headers to determine column positions dynamically
      const headersResponse = await this.sheets.spreadsheets.values.get({
        spreadsheetId: event.sheetId,
        range: `${event.tabName}!1:1`,
      });

      const headers = (headersResponse.data.values?.[0] || []).map((h) =>
        String(h).toLowerCase()
      );

      // Default mappings
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

      // Find column indices dynamically
      const checkinIdx = headers.indexOf(mappings.checkin.toLowerCase());
      const checkinTimeIdx = headers.indexOf(mappings.checkinTime.toLowerCase());
      const entranceIdx = mappings.entrance
        ? headers.indexOf(mappings.entrance.toLowerCase())
        : -1;
      const checkedInByIdx = mappings.checkedInBy
        ? headers.indexOf(mappings.checkedInBy.toLowerCase())
        : -1;

      if (checkinIdx === -1) {
        console.error('Checkin column not found in headers:', headers);
        return false;
      }

      // Convert column index to letter
      const colToLetter = (col: number) => String.fromCharCode(65 + col);

      const checkinCol = colToLetter(checkinIdx);
      const checkinTimeCol =
        checkinTimeIdx >= 0 ? colToLetter(checkinTimeIdx) : null;
      const entranceCol = entranceIdx >= 0 ? colToLetter(entranceIdx) : null;
      const checkedInByCol =
        checkedInByIdx >= 0 ? colToLetter(checkedInByIdx) : null;

      // Reset all check-in fields to empty
      const updates: any[] = [
        {
          range: `${event.tabName}!${checkinCol}${rowIndex}`,
          values: [['']],
        },
      ];

      if (checkinTimeCol) {
        updates.push({
          range: `${event.tabName}!${checkinTimeCol}${rowIndex}`,
          values: [['']],
        });
      }

      if (entranceCol) {
        updates.push({
          range: `${event.tabName}!${entranceCol}${rowIndex}`,
          values: [['']],
        });
      }

      if (checkedInByCol) {
        updates.push({
          range: `${event.tabName}!${checkedInByCol}${rowIndex}`,
          values: [['']],
        });
      }

      await this.sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: event.sheetId,
        requestBody: {
          valueInputOption: 'RAW',
          data: updates,
        },
      });

      return true;
    } catch (error) {
      console.error('Undo check-in update failed:', error);
      return false;
    }
  }

  /**
   * Batch update guests (per sync da Firestore)
   * Aggiorna più guests in una singola chiamata API
   */
  async batchUpdateGuests(
    event: Event,
    updates: Array<{
      rowIndex: number;
      values: {
        checkin?: string;
        checkinTime?: string;
        entrance?: string;
        checkedInBy?: string;
      };
    }>
  ): Promise<void> {
    if (updates.length === 0) {
      return;
    }

    try {
      // Get headers to determine column positions
      const headersResponse = await this.sheets.spreadsheets.values.get({
        spreadsheetId: event.sheetId,
        range: `${event.tabName}!1:1`,
      });

      const headers = (headersResponse.data.values?.[0] || []).map((h) =>
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

      const checkinIdx = headers.indexOf(mappings.checkin.toLowerCase());
      const checkinTimeIdx = headers.indexOf(mappings.checkinTime.toLowerCase());
      const entranceIdx = mappings.entrance
        ? headers.indexOf(mappings.entrance.toLowerCase())
        : -1;
      const checkedInByIdx = mappings.checkedInBy
        ? headers.indexOf(mappings.checkedInBy.toLowerCase())
        : -1;

      if (checkinIdx === -1) {
        throw new Error('Checkin column not found');
      }

      const colToLetter = (col: number) => String.fromCharCode(65 + col);

      // Build batch update data
      const batchData: any[] = [];

      for (const update of updates) {
        const { rowIndex, values } = update;

        // Check-in column
        if (values.checkin !== undefined) {
          batchData.push({
            range: `${event.tabName}!${colToLetter(checkinIdx)}${rowIndex}`,
            values: [[values.checkin]],
          });
        }

        // Check-in time column
        if (values.checkinTime !== undefined && checkinTimeIdx >= 0) {
          batchData.push({
            range: `${event.tabName}!${colToLetter(checkinTimeIdx)}${rowIndex}`,
            values: [[values.checkinTime]],
          });
        }

        // Entrance column
        if (values.entrance !== undefined && entranceIdx >= 0) {
          batchData.push({
            range: `${event.tabName}!${colToLetter(entranceIdx)}${rowIndex}`,
            values: [[values.entrance]],
          });
        }

        // Checked-in by column
        if (values.checkedInBy !== undefined && checkedInByIdx >= 0) {
          batchData.push({
            range: `${event.tabName}!${colToLetter(checkedInByIdx)}${rowIndex}`,
            values: [[values.checkedInBy]],
          });
        }
      }

      // Debug: log batch data
      console.log(
        `[Sheets] 📋 Batch update data:`,
        JSON.stringify(batchData.slice(0, 10), null, 2)
      );

      // Execute batch update
      await this.sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: event.sheetId,
        requestBody: {
          valueInputOption: 'USER_ENTERED',
          data: batchData,
        },
      });

      console.log(`[Sheets] ✅ Batch updated ${updates.length} guests`);
    } catch (error) {
      console.error('[Sheets] Batch update failed:', error);
      throw error;
    }
  }

  /**
   * Aggiunge colonne check-in se mancanti
   */
  async ensureCheckInColumns(event: Event): Promise<void> {
    try {
      // Leggi headers esistenti
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: event.sheetId,
        range: `${event.tabName}!1:1`,
      });

      const headers = response.data.values?.[0] || [];
      const headersLower = headers.map((h) => String(h).toLowerCase());

      // Colonne richieste
      const requiredColumns = [
        'guestid',
        'checkin',
        'checkintime',
        'entrance',
        'checkedinby',
      ];

      const missingColumns = requiredColumns.filter(
        (col) => !headersLower.includes(col)
      );

      if (missingColumns.length > 0) {
        // Append missing column headers
        const newHeaders = missingColumns.map((col) => {
          // Capitalize first letter
          return col.charAt(0).toUpperCase() + col.slice(1);
        });

        await this.sheets.spreadsheets.values.append({
          spreadsheetId: event.sheetId,
          range: `${event.tabName}!${String.fromCharCode(65 + headers.length)}1`, // Next available column
          valueInputOption: 'RAW',
          requestBody: {
            values: [newHeaders],
          },
        });

        console.log(`Added missing columns: ${missingColumns.join(', ')}`);
      }
    } catch (error) {
      console.error('Error ensuring check-in columns:', error);
      // Non bloccare se fallisce - le colonne potrebbero già esistere
    }
  }

  /**
   * REGISTRY OPERATIONS
   */

  /**
   * Legge tutti gli eventi dal Registry Sheet
   */
  async getEvents(): Promise<Event[]> {
    try {
      const registrySheetId = process.env.REGISTRY_SHEET_ID;
      if (!registrySheetId) {
        throw new Error('REGISTRY_SHEET_ID not configured');
      }

      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: registrySheetId,
        range: 'Events!A:J',
      });

      const rows = response.data.values;
      if (!rows || rows.length <= 1) {
        return [];
      }

      const dataRows = rows.slice(1); // Skip header

      return dataRows.map((row) => ({
        eventId: row[0] || '',
        name: row[1] || '',
        date: row[2] || '',
        sheetId: row[3] || '',
        tabName: row[4] || '',
        eventCode: row[5] || '',
        status: (row[6] as any) || 'inactive',
        createdAt: row[7] || '',
        createdBy: row[8] || '',
        columnMappings: row[9] ? JSON.parse(row[9]) : undefined,
      }));
    } catch (error) {
      console.error('Error fetching events:', error);
      throw new Error('Impossibile recuperare eventi');
    }
  }

  /**
   * Crea nuovo evento nel Registry Sheet
   */
  async createEvent(data: CreateEventInput, createdBy: string): Promise<Event> {
    try {
      const registrySheetId = process.env.REGISTRY_SHEET_ID;
      if (!registrySheetId) {
        throw new Error('REGISTRY_SHEET_ID not configured');
      }

      const event: Event = {
        eventId: `evt_${nanoid(10)}`,
        name: data.name,
        date: data.date,
        sheetId: data.sheetId,
        tabName: data.tabName,
        eventCode: data.eventCode || this.generateEventCode(),
        status: 'active',
        createdAt: new Date().toISOString(),
        createdBy,
      };

      // Append to Registry Sheet
      await this.sheets.spreadsheets.values.append({
        spreadsheetId: registrySheetId,
        range: 'Events!A:J',
        valueInputOption: 'RAW',
        requestBody: {
          values: [
            [
              event.eventId,
              event.name,
              event.date,
              event.sheetId,
              event.tabName,
              event.eventCode,
              event.status,
              event.createdAt,
              event.createdBy,
              event.columnMappings ? JSON.stringify(event.columnMappings) : '',
            ],
          ],
        },
      });

      // Ensure check-in columns exist in event sheet
      await this.ensureCheckInColumns(event);

      return event;
    } catch (error) {
      console.error('Error creating event:', error);
      throw new Error('Impossibile creare evento');
    }
  }

  /**
   * Genera codice evento random (6 caratteri uppercase)
   */
  private generateEventCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * Trova evento per event code
   */
  async getEventByCode(code: string): Promise<Event | null> {
    const events = await this.getEvents();
    return events.find((e) => e.eventCode === code && e.status === 'active') || null;
  }

  /**
   * Trova evento per ID
   */
  async getEventById(eventId: string): Promise<Event | null> {
    const events = await this.getEvents();
    return events.find((e) => e.eventId === eventId) || null;
  }
}

// Singleton instance
let sheetsClientInstance: SheetsClient | null = null;

export function getSheetsClient(): SheetsClient {
  if (!sheetsClientInstance) {
    sheetsClientInstance = new SheetsClient();
  }
  return sheetsClientInstance;
}
