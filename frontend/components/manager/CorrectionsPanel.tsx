'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Correction {
  _id: string;
  round: number;
  note: string;
  status: 'open' | 'resolved';
  raisedByName: string;
  createdAt: string;
  resolvedAt?: string;
}

export function CorrectionsPanel({ 
  projectId, 
  editingTaskId, 
  editorName, 
  editorId 
}: { 
  projectId: string; 
  editingTaskId: string; 
  editorName: string;
  editorId: string;
}) {
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchCorrections = useCallback(async () => {
    try {
      const res = await fetch(`/api/corrections/task/${editingTaskId}`);
      const data = await res.json();
      if (res.ok && data.corrections) {
        setCorrections(data.corrections);
      }
    } catch (error) {
      console.error('Failed to fetch corrections', error);
    } finally {
      setLoading(false);
    }
  }, [editingTaskId]);

  useEffect(() => {
    fetchCorrections();
  }, [fetchCorrections]);

  const handleAddCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    
    setSubmitting(true);
    try {
      const res = await fetch('/api/corrections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          editingTaskId,
          editorId,
          editorName,
          note: newNote.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add correction');
      
      toast.success('Correction raised successfully');
      setNewNote('');
      fetchCorrections(); // Refresh list
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolve = async (correctionId: string) => {
    try {
      const res = await fetch(`/api/corrections/${correctionId}/resolve`, {
        method: 'PATCH'
      });
      if (!res.ok) throw new Error('Failed to resolve correction');
      toast.success('Correction resolved');
      fetchCorrections();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const openCount = corrections.filter(c => c.status === 'open').length;
  const resolvedCount = corrections.length - openCount;

  return (
    <Card className="border-amber-500/30 bg-amber-500/5 shadow-sm mt-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg text-amber-700 dark:text-amber-500 flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          Internal Corrections
        </CardTitle>
        <CardDescription>
          {loading ? 'Loading...' : `${corrections.length} total · ${openCount} open · ${resolvedCount} resolved`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {corrections.length > 0 && (
          <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
            {corrections.map(c => (
              <div key={c._id} className="p-3 bg-background rounded-md border border-border text-sm flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Round {c.round}</Badge>
                    <span className="text-xs text-muted-foreground">{c.raisedByName}</span>
                  </div>
                  <Badge variant="secondary" className={c.status === 'open' ? 'bg-amber-500/15 text-amber-600' : 'bg-emerald-500/15 text-emerald-600'}>
                    {c.status}
                  </Badge>
                </div>
                <p className="whitespace-pre-wrap">{c.note}</p>
                {c.status === 'open' && (
                  <Button size="sm" variant="outline" className="w-fit mt-1 h-7 text-xs" onClick={() => handleResolve(c._id)}>
                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Mark Resolved
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleAddCorrection} className="space-y-2 pt-2 border-t border-border/50">
          <Textarea 
            placeholder="Describe the issue..."
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            rows={2}
            className="text-sm bg-background"
          />
          <Button type="submit" size="sm" disabled={submitting || !newNote.trim()}>
            {submitting ? 'Adding...' : 'Add Correction'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
