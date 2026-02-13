'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useCreateEvent } from '@/hooks/useEvents';
import { Loader2 } from 'lucide-react';

export function EventForm() {
  const [formData, setFormData] = useState({
    name: '',
    date: '',
    sheetId: '',
    tabName: 'Invitati',
    eventCode: '',
  });

  const createEventMutation = useCreateEvent();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const event = await createEventMutation.mutateAsync({
        name: formData.name,
        date: formData.date,
        sheetId: formData.sheetId,
        tabName: formData.tabName,
        eventCode: formData.eventCode || undefined,
      });

      alert(`Evento creato! Codice: ${event.eventCode}`);

      // Reset form
      setFormData({
        name: '',
        date: '',
        sheetId: '',
        tabName: 'Invitati',
        eventCode: '',
      });
    } catch (error: any) {
      alert(error.message || 'Errore creazione evento');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Collega Nuovo Evento</CardTitle>
        <CardDescription>
          Collega un Google Sheet esistente con lista invitati
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Nome Evento</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="Tech Summit 2026"
              required
            />
          </div>

          <div>
            <Label htmlFor="date">Data</Label>
            <Input
              id="date"
              type="date"
              value={formData.date}
              onChange={(e) =>
                setFormData({ ...formData, date: e.target.value })
              }
              required
            />
          </div>

          <div>
            <Label htmlFor="sheetId">Google Sheet ID</Label>
            <Input
              id="sheetId"
              value={formData.sheetId}
              onChange={(e) =>
                setFormData({ ...formData, sheetId: e.target.value })
              }
              placeholder="1ABC...XYZ (dall'URL del foglio)"
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              Copia l'ID dall'URL: docs.google.com/spreadsheets/d/[ID]/edit
            </p>
          </div>

          <div>
            <Label htmlFor="tabName">Nome Tab</Label>
            <Input
              id="tabName"
              value={formData.tabName}
              onChange={(e) =>
                setFormData({ ...formData, tabName: e.target.value })
              }
              placeholder="Invitati"
              required
            />
          </div>

          <div>
            <Label htmlFor="eventCode">
              Codice Evento (opzionale, auto-generato)
            </Label>
            <Input
              id="eventCode"
              value={formData.eventCode}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  eventCode: e.target.value.toUpperCase().slice(0, 6),
                })
              }
              placeholder="ABC123"
              maxLength={6}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Codice a 6 caratteri per accesso hostess (lascia vuoto per
              auto-generare)
            </p>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={createEventMutation.isPending}
          >
            {createEventMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creazione...
              </>
            ) : (
              'Crea Evento'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
