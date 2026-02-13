'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Guest } from '@/types/guest';

interface CheckInMutationData {
  eventId: string;
  guestId: string;
  eventCode: string;
  entrance?: string;
}

/**
 * Hook per check-in mutation con optimistic update
 */
export function useCheckIn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CheckInMutationData) => {
      // Retry automatico con backoff esponenziale per race conditions
      let lastError;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const response = await fetch(`/api/events/${data.eventId}/checkin`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Event-Code': data.eventCode,
            },
            body: JSON.stringify({
              guestId: data.guestId,
              eventId: data.eventId,
              entrance: data.entrance,
            }),
          });

          if (!response.ok) {
            const error = await response.json();

            // Se è un conflitto (409), ritenta dopo un delay
            if (response.status === 409 && attempt < 2) {
              lastError = new Error(error.error || 'Check-in fallito');
              // Backoff esponenziale: 500ms, 1000ms
              await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
              continue;
            }

            throw new Error(error.error || 'Check-in fallito');
          }

          return response.json();
        } catch (err) {
          if (attempt === 2) throw err; // Ultimo tentativo fallito
          lastError = err;
          await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
        }
      }

      throw lastError;
    },

    // Optimistic update
    onMutate: async (data) => {
      // Cancel ongoing queries
      await queryClient.cancelQueries({ queryKey: ['guests', data.eventId] });

      // Snapshot previous value
      const previousGuests = queryClient.getQueryData<Guest[]>([
        'guests',
        data.eventId,
      ]);

      // Optimistically update
      if (previousGuests) {
        queryClient.setQueryData<Guest[]>(['guests', data.eventId], (old) =>
          old
            ? old.map((g) =>
                g.guestId === data.guestId
                  ? {
                      ...g,
                      checkin: true,
                      checkinTime: new Date().toISOString(),
                      entrance: data.entrance,
                    }
                  : g
              )
            : old
        );
      }

      return { previousGuests };
    },

    // Rollback on error
    onError: (err, variables, context) => {
      if (context?.previousGuests) {
        queryClient.setQueryData(
          ['guests', variables.eventId],
          context.previousGuests
        );
      }
    },

    // Refetch on success (con delay per batch updates)
    onSuccess: (data, variables) => {
      // Delay di 1.5s per permettere a Google Sheets di propagare
      // e per batch multiple invalidazioni simultanee
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['guests', variables.eventId] });
      }, 1500);
    },
  });
}
