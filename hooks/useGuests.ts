'use client';

import { useQuery } from '@tanstack/react-query';
import type { Guest } from '@/types/guest';

/**
 * Hook per polling lista invitati
 * Intervallo fisso 5s per MVP (Fase 2: adaptive 3s/10s)
 */
export function useGuests(eventId: string, eventCode: string) {
  return useQuery<Guest[]>({
    queryKey: ['guests', eventId],
    queryFn: async () => {
      const response = await fetch(`/api/events/${eventId}/guests`, {
        headers: {
          'X-Event-Code': eventCode,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Impossibile caricare lista');
      }

      return response.json();
    },
    refetchInterval: 5000, // MVP: 5 secondi fissi
    staleTime: 2000, // Cache valida 2 secondi
    enabled: !!eventId && !!eventCode,
    retry: 2,
  });
}

/**
 * Hook per cercare invitati (client-side filter)
 */
export function useGuestSearch(guests: Guest[] | undefined, query: string) {
  if (!guests || !query || query.length < 2) {
    return guests || [];
  }

  const normalizedQuery = query.toLowerCase().trim();

  return guests
    .filter((guest) => {
      const searchText =
        `${guest.nome} ${guest.cognome} ${guest.azienda || ''}`.toLowerCase();
      return searchText.includes(normalizedQuery);
    })
    .sort((a, b) => {
      // Priorità: non checked-in prima
      if (a.checkin !== b.checkin) {
        return a.checkin ? 1 : -1;
      }
      // Poi ordine alfabetico per cognome
      return a.cognome.localeCompare(b.cognome);
    });
}
