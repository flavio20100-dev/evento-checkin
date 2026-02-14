'use client';

import { EventForm } from '@/components/admin/EventForm';
import { SyncButton } from '@/components/admin/SyncButton';
import { useEvents } from '@/hooks/useEvents';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Calendar, Code2, ExternalLink } from 'lucide-react';
import Link from 'next/link';

export default function AdminPage() {
  const { data: events, isLoading } = useEvents();

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        {/* Create Event Form */}
        <EventForm />

        {/* Manual Sync Button */}
        <SyncButton />
      </div>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Istruzioni Setup</CardTitle>
          <CardDescription>
            Come preparare il Google Sheet
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <p className="font-medium mb-1">1. Prepara Google Sheet:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>Crea foglio con colonne: Nome, Cognome, Azienda</li>
              <li>Il sistema aggiungerà automaticamente le colonne check-in</li>
            </ul>
          </div>

          <div>
            <p className="font-medium mb-1">2. Condividi Sheet:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>Condividi con Service Account email (Editor)</li>
              <li>Trova email in Google Cloud Console</li>
            </ul>
          </div>

          <div>
            <p className="font-medium mb-1">3. Copia Sheet ID:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>
                Dall'URL: docs.google.com/spreadsheets/d/
                <span className="font-mono">[ID]</span>/edit
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Events List */}
      <Card>
        <CardHeader>
          <CardTitle>Eventi Attivi</CardTitle>
          <CardDescription>
            Condividi i codici evento con le hostess
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !events || events.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nessun evento ancora creato
            </p>
          ) : (
            <div className="space-y-3">
              {events
                .filter((e) => e.status === 'active')
                .map((event) => (
                  <div
                    key={event.eventId}
                    className="border rounded-lg p-4 hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate">{event.name}</h3>
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {new Date(event.date).toLocaleDateString('it-IT')}
                          </div>
                          <div className="flex items-center gap-1">
                            <Code2 className="h-4 w-4" />
                            <span className="font-mono font-bold text-primary">
                              {event.eventCode}
                            </span>
                          </div>
                        </div>
                      </div>
                      <Link
                        href={`/hostess/${event.eventCode}`}
                        target="_blank"
                        className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 flex-shrink-0"
                      >
                        Link Hostess
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
