'use client';

import { Card, CardContent } from '@/components/ui/card';
import { CheckInButton } from './CheckInButton';
import { UndoCheckInButton } from './UndoCheckInButton';
import type { Guest } from '@/types/guest';
import { CheckCircle2, Building2 } from 'lucide-react';

interface GuestCardProps {
  guest: Guest;
  eventId: string;
  eventCode: string;
}

export function GuestCard({ guest, eventId, eventCode }: GuestCardProps) {
  return (
    <Card className={guest.checkin ? 'opacity-60 border-green-200' : ''}>
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h3 className="font-semibold text-base truncate">
                {guest.nome} {guest.cognome}
              </h3>
              {guest.checkin && (
                <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
              )}
            </div>

            {guest.azienda && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Building2 className="h-3 w-3" />
                <span className="truncate">{guest.azienda}</span>
              </div>
            )}

            {guest.checkin && guest.checkinTime && (
              <p className="text-xs text-green-700 mt-1">
                {new Date(guest.checkinTime).toLocaleTimeString('it-IT', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            )}
          </div>

          {guest.checkin ? (
            <UndoCheckInButton
              guestId={guest.guestId}
              eventId={eventId}
              eventCode={eventCode}
              guestName={`${guest.nome} ${guest.cognome}`}
            />
          ) : (
            <CheckInButton
              guestId={guest.guestId}
              eventId={eventId}
              eventCode={eventCode}
              guestName={`${guest.nome} ${guest.cognome}`}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
