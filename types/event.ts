export interface Event {
  eventId: string;
  name: string;
  date: string; // ISO date
  sheetId: string; // Google Sheet ID
  tabName: string; // Tab name in sheet
  eventCode: string; // 6-char code for hostess access
  status: 'active' | 'inactive' | 'archived';
  createdAt: string;
  createdBy: string;
  columnMappings?: ColumnMappings;
}

export interface ColumnMappings {
  nome: string;
  cognome: string;
  azienda: string;
  email?: string;
  guestId: string;
  checkin: string;
  checkinTime: string;
  entrance?: string;
  checkedInBy?: string;
}

export interface CreateEventInput {
  name: string;
  date: string;
  sheetId: string;
  tabName: string;
  eventCode?: string; // Auto-generated if not provided
}

export interface EventStats {
  totalGuests: number;
  checkedIn: number;
  recentCheckIns: number; // Last 10 minutes
  lastCheckInTime?: string;
}
