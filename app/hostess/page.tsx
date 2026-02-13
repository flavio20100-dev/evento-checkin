'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useValidateEventCode } from '@/hooks/useEvents';
import { Loader2 } from 'lucide-react';

export default function HostessEntryPage() {
  const [eventCode, setEventCode] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (eventCode.length !== 6) {
      setError('Il codice evento deve essere di 6 caratteri');
      return;
    }

    setIsValidating(true);

    try {
      const response = await fetch(`/api/events?code=${eventCode}`);

      if (!response.ok) {
        throw new Error('Codice evento non valido');
      }

      const events = await response.json();

      if (!events || events.length === 0) {
        throw new Error('Evento non trovato');
      }

      // Redirect to event page
      router.push(`/hostess/${eventCode.toUpperCase()}`);
    } catch (err: any) {
      setError(err.message || 'Errore validazione codice');
      setIsValidating(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Check-in Eventi</CardTitle>
          <CardDescription>
            Inserisci il codice evento per iniziare
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="eventCode">Codice Evento</Label>
              <Input
                id="eventCode"
                type="text"
                value={eventCode}
                onChange={(e) =>
                  setEventCode(e.target.value.toUpperCase().slice(0, 6))
                }
                placeholder="ABC123"
                maxLength={6}
                className="text-center text-2xl font-mono tracking-widest uppercase"
                autoFocus
                required
              />
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Chiedi il codice a 6 caratteri all'organizzatore
              </p>
            </div>

            {error && (
              <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={isValidating || eventCode.length !== 6}
            >
              {isValidating ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Verifica...
                </>
              ) : (
                'Accedi'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
