'use client';

import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { CalendarIcon, MapPin, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWorkflow } from '@/hooks/use-workflow';
import { useAuth } from '@/lib/auth-context';
import type { Project } from '@/lib/types';
import { toast } from 'sonner';

interface AssignShootDialogProps {
  project: Project | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AssignShootDialog({ project, open, onOpenChange }: AssignShootDialogProps) {
  const { triggerWorkflow, triggering } = useWorkflow();
  const { user } = useAuth();
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [location, setLocation] = useState('');
  const [crew, setCrew] = useState('');

  const handleAssign = async () => {
    if (!project || !date) return;
    await triggerWorkflow('shoot.assigned', {
      projectId: project.id,
      clientId: project.client.id,
      data: {
        date: date.toISOString(),
        location,
        crew: crew.split(',').map((c) => c.trim()),
      },
      triggeredBy: user?.name ?? 'manager',
    });
    toast.success('Shoot Scheduled', { description: `${project.client.company} shoot on ${format(date, 'dd MMM')}` });
    onOpenChange(false);
    setDate(undefined);
    setLocation('');
    setCrew('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule Shoot</DialogTitle>
          <DialogDescription>
            {project ? `Assign a shoot for ${project.client.company}` : ''}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Shoot Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, 'PPP') : <span className="text-muted-foreground">Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={date} onSelect={setDate} />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <div className="relative">
              <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Studio / outdoor address" className="pl-8" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="crew">Crew Members (comma separated)</Label>
            <div className="relative">
              <Users className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="crew" value={crew} onChange={(e) => setCrew(e.target.value)} placeholder="Ravi (Cam), Amit (Light), Sara (Sound)" className="pl-8" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleAssign} disabled={!date || !location || triggering['shoot.assigned']}>
            Schedule Shoot
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
