'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { WORKFLOW_TRIGGERS, type WorkflowEvent, type WorkflowResult } from '@/lib/workflow';

export function useWorkflow() {
  const [triggering, setTriggering] = useState<Record<string, boolean>>({});

  const triggerWorkflow = useCallback(
    async (
      event: WorkflowEvent,
      payload: {
        projectId?: string;
        clientId?: string;
        data: Record<string, unknown>;
        triggeredBy: string;
      }
    ): Promise<WorkflowResult> => {
      const config = WORKFLOW_TRIGGERS[event];
      if (!config) {
        toast.error('Workflow Failed', { description: `No config for ${event}` });
        return { success: false, message: 'No config' };
      }
      setTriggering((p) => ({ ...p, [event]: true }));
      try {
        await new Promise((r) => setTimeout(r, 800));
        const fullPayload = { ...payload, event, timestamp: new Date().toISOString() };
        console.log('[n8n Webhook Triggered]', { url: config.webhookUrl, method: config.method, payload: fullPayload });
        toast.success(`Workflow Triggered: ${config.name}`, {
          description: 'Webhook sent to n8n successfully.',
        });
        return { success: true, message: `${config.name} triggered.`, data: fullPayload };
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Network error';
        toast.error(`Workflow Failed: ${config.name}`, { description: msg });
        return { success: false, message: msg };
      } finally {
        setTriggering((p) => ({ ...p, [event]: false }));
      }
    },
    []
  );

  return { triggerWorkflow, triggering };
}
