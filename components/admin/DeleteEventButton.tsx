'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Trash2, Loader2, AlertTriangle } from 'lucide-react';

interface DeleteEventButtonProps {
  eventId: string;
  eventName: string;
  onDeleted?: () => void;
}

export function DeleteEventButton({ eventId, eventName, onDeleted }: DeleteEventButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    // Double confirmation per sicurezza
    const confirm1 = confirm(
      `⚠️ ATTENZIONE!\n\nVuoi CANCELLARE l'evento "${eventName}"?\n\nQuesta azione eliminerà:\n- L'evento da Google Sheets\n- Tutti i guests da Firestore\n- Tutti i metadata\n\nQuesta operazione è IRREVERSIBILE!`
    );

    if (!confirm1) return;

    const confirm2 = confirm(
      `Sei SICURO di voler cancellare "${eventName}"?\n\nDigita OK per confermare.`
    );

    if (!confirm2) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/events/${eventId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Cancellazione fallita');
      }

      // Successo - notifica parent component
      if (onDeleted) {
        onDeleted();
      }

      // Ricarica la pagina per aggiornare la lista
      window.location.reload();
    } catch (err: any) {
      console.error('[DeleteEventButton] Error:', err);
      setError(err.message || 'Errore durante cancellazione');
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        onClick={handleDelete}
        disabled={isLoading}
        size="sm"
        variant="destructive"
        className="h-8"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Cancellazione...
          </>
        ) : (
          <>
            <Trash2 className="h-3 w-3 mr-1" />
            Cancella
          </>
        )}
      </Button>

      {error && (
        <div className="flex items-center gap-1 text-xs text-red-600">
          <AlertTriangle className="h-3 w-3" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
