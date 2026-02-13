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
    refetchInterval: 30000, // 30 secondi (massima riduzione conflitti)
    staleTime: 25000, // Cache valida 25 secondi
    enabled: !!eventId && !!eventCode,
    retry: 3,
    retryOnMount: false, // Non ritentare al mount se ha già dati
    refetchOnWindowFocus: false, // Evita refetch extra
    // Mantieni dati precedenti durante refetch per evitare flash di errori
    placeholderData: (previousData) => previousData,
    // Non mostrare errore se abbiamo già dati in cache (errori temporanei)
    throwOnError: false,
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
