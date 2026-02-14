'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

interface SyncResult {
  eventId: string;
  status: 'success' | 'error';
  guestsSynced?: number;
  error?: string;
}

interface SyncResponse {
  success: boolean;
  totalEvents: number;
  successful: number;
  failed: number;
  results: SyncResult[];
  timestamp: string;
}

export function SyncButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [lastSync, setLastSync] = useState<SyncResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSync = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/sync', {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Sync fallito');
      }

      setLastSync(data);
    } catch (err: any) {
      console.error('[SyncButton] Error:', err);
      setError(err.message || 'Errore durante il sync');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sync Manuale</CardTitle>
        <CardDescription>
          Sincronizza check-in da Firestore a Google Sheets
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          onClick={handleSync}
          disabled={isLoading}
          className="w-full"
          size="lg"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Sincronizzazione...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Sincronizza Ora
            </>
          )}
        </Button>

        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-50 text-red-900 rounded-lg text-sm">
            <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {lastSync && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Ultimo sync:</span>
              <span className="font-mono text-xs">
                {new Date(lastSync.timestamp).toLocaleTimeString('it-IT')}
              </span>
            </div>

            <div className="space-y-2">
              {lastSync.results.map((result) => (
                <div
                  key={result.eventId}
                  className={`flex items-center justify-between p-2 rounded ${
                    result.status === 'success'
                      ? 'bg-green-50 text-green-900'
                      : 'bg-red-50 text-red-900'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {result.status === 'success' ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <XCircle className="h-4 w-4" />
                    )}
                    <span className="text-sm font-medium">
                      {result.eventId.substring(0, 15)}...
                    </span>
                  </div>
                  <span className="text-sm">
                    {result.status === 'success'
                      ? `${result.guestsSynced} guests`
                      : result.error}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Risultato:</span>
                <span className="font-semibold">
                  {lastSync.successful}/{lastSync.totalEvents} eventi riusciti
                </span>
              </div>
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          💡 Usa questo button se i check-in non appaiono sullo sheet.
          Normalmente il sync è automatico ogni minuto.
        </p>
      </CardContent>
    </Card>
  );
}
