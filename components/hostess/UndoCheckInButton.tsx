'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useUndoCheckIn } from '@/hooks/useUndoCheckIn';
import { X, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface UndoCheckInButtonProps {
  guestId: string;
  eventId: string;
  eventCode: string;
  guestName: string;
}

export function UndoCheckInButton({
  guestId,
  eventId,
  eventCode,
  guestName,
}: UndoCheckInButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const undoCheckIn = useUndoCheckIn();
  const { toast } = useToast();

  const handleUndo = () => {
    undoCheckIn.mutate(
      { eventId, guestId, eventCode },
      {
        onSuccess: () => {
          toast({
            title: 'Check-in annullato',
            description: `${guestName} rimosso dalla lista`,
          });
          setShowConfirm(false);
        },
        onError: (error: any) => {
          toast({
            title: 'Errore',
            description: error.message || 'Impossibile annullare check-in',
            variant: 'destructive',
          });
        },
      }
    );
  };

  if (showConfirm) {
    return (
      <div className="flex gap-1.5">
        <Button
          size="sm"
          variant="destructive"
          onClick={handleUndo}
          disabled={undoCheckIn.isPending}
          className="h-8 text-xs"
        >
          {undoCheckIn.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            'Conferma'
          )}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowConfirm(false)}
          disabled={undoCheckIn.isPending}
          className="h-8 text-xs"
        >
          No
        </Button>
      </div>
    );
  }

  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={() => setShowConfirm(true)}
      className="h-8 text-xs"
    >
      <X className="h-3 w-3" />
      Annulla
    </Button>
  );
}
