'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useCheckIn } from '@/hooks/useCheckIn';
import { Check, Loader2 } from 'lucide-react';

interface CheckInButtonProps {
  guestId: string;
  eventId: string;
  eventCode: string;
  guestName: string;
}

export function CheckInButton({
  guestId,
  eventId,
  eventCode,
  guestName,
}: CheckInButtonProps) {
  const [showSuccess, setShowSuccess] = useState(false);
  const checkInMutation = useCheckIn();

  const handleCheckIn = async () => {
    try {
      await checkInMutation.mutateAsync({
        guestId,
        eventId,
        eventCode,
      });

      // Show success feedback
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
    } catch (error: any) {
      // Error handling via toast (fase 2) o alert
      alert(error.message || 'Check-in fallito');
    }
  };

  if (showSuccess) {
    return (
      <Button size="lg" variant="default" disabled className="bg-green-600">
        <Check className="h-5 w-5 mr-2" />
        Registrato!
      </Button>
    );
  }

  return (
    <Button
      size="lg"
      onClick={handleCheckIn}
      disabled={checkInMutation.isPending}
      className="font-semibold"
    >
      {checkInMutation.isPending ? (
        <>
          <Loader2 className="h-5 w-5 mr-2 animate-spin" />
          Check-in...
        </>
      ) : (
        'CHECK-IN'
      )}
    </Button>
  );
}
