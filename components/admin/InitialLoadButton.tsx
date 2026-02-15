'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2, CheckCircle2, XCircle } from 'lucide-react';

interface InitialLoadButtonProps {
  eventCode: string;
  eventName: string;
}

interface LoadResult {
  success: boolean;
  guestsLoaded?: number;
  error?: string;
}

export function InitialLoadButton({ eventCode, eventName }: InitialLoadButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<LoadResult | null>(null);

  const handleLoad = async () => {
    if (!confirm(`Vuoi caricare gli invitati per "${eventName}" da Google Sheets a Firestore?`)) {
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/sync/initial-load', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ eventCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Initial load fallito');
      }

      setResult({
        success: true,
        guestsLoaded: data.guestsLoaded,
      });

      // Auto-hide success dopo 3 secondi
      setTimeout(() => setResult(null), 3000);
    } catch (err: any) {
      console.error('[InitialLoadButton] Error:', err);
      setResult({
        success: false,
        error: err.message || 'Errore durante initial load',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        onClick={handleLoad}
        disabled={isLoading}
        size="sm"
        variant="outline"
        className="h-8"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Loading...
          </>
        ) : (
          <>
            <Download className="h-3 w-3 mr-1" />
            Initial Load
          </>
        )}
      </Button>

      {result && (
        <div className="flex items-center gap-1 text-xs">
          {result.success ? (
            <>
              <CheckCircle2 className="h-3 w-3 text-green-600" />
              <span className="text-green-600 font-medium">
                {result.guestsLoaded} guests caricati
              </span>
            </>
          ) : (
            <>
              <XCircle className="h-3 w-3 text-red-600" />
              <span className="text-red-600">{result.error}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
