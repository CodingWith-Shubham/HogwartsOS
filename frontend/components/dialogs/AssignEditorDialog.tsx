'use client';

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useWorkflow } from '@/hooks/use-workflow';
import { useAuth } from '@/lib/auth-context';
import type { Project } from '@/lib/types';
import { useState } from 'react';
import { toast } from 'sonner';

interface AssignEditorDialogProps {
  project: Project | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AssignEditorDialog({ project, open, onOpenChange }: AssignEditorDialogProps) {
  const { triggerWorkflow, triggering } = useWorkflow();
  const { user, users } = useAuth();
  const [editorId, setEditorId] = useState<string>('');

  const available = users.filter((e) => e.role === 'editor');
  const selectedEditor = available.find((e) => e.id === editorId);

  const handleAssign = async () => {
    if (!project || !editorId) return;
    await triggerWorkflow('editor.assigned', {
      projectId: project.id,
      clientId: project.client.id,
      data: { editorId, editorName: selectedEditor?.name },
      triggeredBy: user?.name ?? 'manager',
    });
    toast.success('Editor Assigned', { description: `${selectedEditor?.name} assigned to ${project.client.company}` });
    onOpenChange(false);
    setEditorId('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign Editor</DialogTitle>
          <DialogDescription>
            {project ? `Allocate an editor for ${project.client.company}` : ''}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Select Editor</Label>
            <Select value={editorId} onValueChange={setEditorId}>
              <SelectTrigger><SelectValue placeholder="Choose an available editor" /></SelectTrigger>
              <SelectContent>
                {available.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    <div className="flex items-center gap-2">
                      <span>{e.name}</span>
                      <span className="text-xs text-muted-foreground">
                        ({e.designation || 'Editor'})
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedEditor && (
            <div className="rounded-md border border-border p-3 flex items-center gap-3">
              <Avatar>
                <AvatarFallback className="bg-secondary border border-border text-xs">{selectedEditor.initials}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">{selectedEditor.name}</p>
                <p className="text-xs text-muted-foreground">
                  {selectedEditor.designation || 'Editor'} · {selectedEditor.email}
                </p>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleAssign} disabled={!editorId || triggering['editor.assigned']}>
            Assign Editor
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
