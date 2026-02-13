'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { SearchBar } from '@/components/hostess/SearchBar';
import { GuestCard } from '@/components/hostess/GuestCard';
import { useGuests, useGuestSearch } from '@/hooks/useGuests';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, Users, CheckCircle } from 'lucide-react';

export default function HostessEventPage() {
  const params = useParams();
  const router = useRouter();
  const eventCode = params.eventCode as string;

  const [eventId, setEventId] = useState<string | null>(null);
  const [eventName, setEventName] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  // Validate event code and get event ID
  useEffect(() => {
    async function validateCode() {
      try {
        const response = await fetch(`/api/events?code=${eventCode}`);
        if (!response.ok) throw new Error('Invalid code');

        const events = await response.json();
        if (events && events.length > 0) {
          setEventId(events[0].eventId);
          setEventName(events[0].name);
        } else {
          router.push('/hostess');
        }
      } catch (error) {
        router.push('/hostess');
      }
    }

    if (eventCode) {
      validateCode();
    }
  }, [eventCode, router]);

  // Fetch guests with polling
  const { data: guests, isLoading, error } = useGuests(
    eventId || '',
    eventCode
  );

  // Client-side search
  const filteredGuests = useGuestSearch(guests, searchQuery);

  if (!eventId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const checkedInCount = guests?.filter((g) => g.checkin).length || 0;
  const totalCount = guests?.length || 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10 shadow-sm">
        <div className="max-w-2xl mx-auto p-4">
          <div className="flex items-center gap-3 mb-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push('/hostess')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="font-bold text-lg">{eventName}</h1>
              <p className="text-sm text-muted-foreground">
                Codice: {eventCode}
              </p>
            </div>
          </div>

          <SearchBar value={searchQuery} onChange={setSearchQuery} />

          {/* Stats */}
          <div className="flex gap-4 mt-3 text-sm">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span>
                {totalCount} invitat{totalCount !== 1 ? 'i' : 'o'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-green-700 font-medium">
                {checkedInCount} check-in
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto p-4 pb-8">
        {isLoading && !guests ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="bg-destructive/10 text-destructive p-4 rounded-lg">
            Errore caricamento lista invitati
          </div>
        ) : filteredGuests.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            {searchQuery
              ? 'Nessun invitato trovato per questa ricerca'
              : 'Nessun invitato in lista'}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredGuests.map((guest) => (
              <GuestCard
                key={guest.guestId}
                guest={guest}
                eventId={eventId}
                eventCode={eventCode}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
