export interface Guest {
  guestId: string;
  nome: string;
  cognome: string;
  azienda?: string;
  email?: string;
  checkin: boolean;
  checkinTime?: string; // ISO 8601
  entrance?: string;
  checkedInBy?: string;
  // Row metadata for updates
  _rowIndex?: number;
}

export interface CheckInData {
  entrance?: string;
  checkedInBy?: string;
}

export interface CheckInResult {
  success: boolean;
  guest: Guest;
  timestamp: string;
}
