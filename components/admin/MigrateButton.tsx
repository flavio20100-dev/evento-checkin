'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Database, CheckCircle2, XCircle, Loader2, AlertTriangle } from 'lucide-react';

interface MigrationResult {
  eventId: string;
  totalGuests: number;
  migrated: number;
}

interface MigrationResponse {
  success: boolean;
  totalEvents: number;
  totalGuestsMigrated: number;
  eventResults: MigrationResult[];
  timestamp: string;
}

export function MigrateButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<MigrationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleMigrate = async () => {
    if (!confirm('⚠️ Sei sicuro di voler eseguire la migration? Questa operazione aggiornerà tutti i guest documents in Firestore.')) {
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/admin/migrate', {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Migration fallita');
      }

      setResult(data);
    } catch (err: any) {
      console.error('[MigrateButton] Error:', err);
      setError(err.message || 'Errore durante la migration');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Data Migration</CardTitle>
        <CardDescription>
          Fix field mancanti nei guest documents (una tantum)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-2 p-3 bg-amber-50 text-amber-900 rounded-lg text-sm">
          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium mb-1">Quando usare:</p>
            <ul className="text-xs space-y-1">
              <li>• Se il sync non funziona (trova 0 guests)</li>
              <li>• Se i guest hanno field null/undefined</li>
              <li>• Dopo initial load da Sheets</li>
            </ul>
          </div>
        </div>

        <Button
          onClick={handleMigrate}
          disabled={isLoading}
          className="w-full"
          variant="outline"
          size="lg"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Migrazione in corso...
            </>
          ) : (
            <>
              <Database className="h-4 w-4 mr-2" />
              Esegui Migration
            </>
          )}
        </Button>

        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-50 text-red-900 rounded-lg text-sm">
            <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {result && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-3 bg-green-50 text-green-900 rounded-lg text-sm">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              <span className="font-medium">
                Migration completata! {result.totalGuestsMigrated} guests aggiornati
              </span>
            </div>

            <div className="space-y-2">
              {result.eventResults.map((event) => (
                <div
                  key={event.eventId}
                  className="flex items-center justify-between p-2 rounded bg-gray-50 text-sm"
                >
                  <span className="font-mono text-xs text-gray-600">
                    {event.eventId.substring(0, 15)}...
                  </span>
                  <span className="text-gray-900">
                    {event.migrated}/{event.totalGuests} guests
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Timestamp:</span>
                <span className="font-mono">
                  {new Date(result.timestamp).toLocaleTimeString('it-IT')}
                </span>
              </div>
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          💡 Questa operazione è sicura e può essere eseguita più volte. Aggiorna solo i field mancanti.
        </p>
      </CardContent>
    </Card>
  );
}
