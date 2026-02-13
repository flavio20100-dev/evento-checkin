'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Event, CreateEventInput } from '@/types/event';

/**
 * Hook per lista eventi (admin)
 */
export function useEvents() {
  return useQuery<Event[]>({
    queryKey: ['events'],
    queryFn: async () => {
      const response = await fetch('/api/events');

      if (!response.ok) {
        throw new Error('Impossibile caricare eventi');
      }

      return response.json();
    },
    staleTime: 10000, // 10 secondi
  });
}

/**
 * Hook per creare evento (admin)
 */
export function useCreateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateEventInput) => {
      const response = await fetch('/api/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Impossibile creare evento');
      }

      return response.json();
    },

    onSuccess: () => {
      // Refetch events list
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

/**
 * Hook per validare event code (hostess)
 */
export function useValidateEventCode(code: string | null) {
  return useQuery<Event>({
    queryKey: ['event-code', code],
    queryFn: async () => {
      if (!code) throw new Error('Codice evento richiesto');

      const response = await fetch(`/api/events?code=${code}`);

      if (!response.ok) {
        throw new Error('Codice evento non valido');
      }

      const events = await response.json();
      if (!Array.isArray(events) || events.length === 0) {
        throw new Error('Evento non trovato');
      }

      return events[0];
    },
    enabled: !!code && code.length === 6,
    retry: 1,
  });
}
