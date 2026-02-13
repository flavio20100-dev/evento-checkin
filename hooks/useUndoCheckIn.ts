import { useMutation, useQueryClient } from '@tanstack/react-query';

interface UndoCheckInParams {
  eventId: string;
  guestId: string;
  eventCode: string;
}

export function useUndoCheckIn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ eventId, guestId, eventCode }: UndoCheckInParams) => {
      const response = await fetch(`/api/events/${eventId}/checkin`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-Event-Code': eventCode,
        },
        body: JSON.stringify({ guestId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Annullamento check-in fallito');
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      // Invalida la query guests per aggiornare la lista (con delay)
      setTimeout(() => {
        queryClient.invalidateQueries({
          queryKey: ['guests', variables.eventId],
        });
      }, 1500);
    },
  });
}
