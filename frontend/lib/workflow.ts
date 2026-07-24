export type WorkflowEvent =
  | 'lead.created'
  | 'lead.updated'
  | 'proposal.sent'
  | 'payment.link.sent'
  | 'payment.received'
  | 'shoot.assigned'
  | 'shoot.completed'
  | 'editor.assigned'
  | 'draft.submitted'
  | 'draft.approved'
  | 'revision.requested'
  | 'project.delivered'
  | 'project.closed'
  | 'invoice.created'
  | 'invoice.sent';

export interface WorkflowTriggerConfig {
  event: WorkflowEvent;
  name: string;
  webhookUrl: string;
  method: 'POST';
}

export const WORKFLOW_TRIGGERS: Record<WorkflowEvent, WorkflowTriggerConfig> = {
  'lead.created': { event: 'lead.created', name: 'Lead Created', webhookUrl: '/webhook/lead-created', method: 'POST' },
  'lead.updated': { event: 'lead.updated', name: 'Lead Updated', webhookUrl: '/webhook/lead-updated', method: 'POST' },
  'proposal.sent': { event: 'proposal.sent', name: 'Proposal Sent', webhookUrl: '/webhook/proposal-sent', method: 'POST' },
  'payment.link.sent': { event: 'payment.link.sent', name: 'Payment Link Sent', webhookUrl: '/webhook/payment-link', method: 'POST' },
  'payment.received': { event: 'payment.received', name: 'Payment Received', webhookUrl: '/webhook/payment-received', method: 'POST' },
  'shoot.assigned': { event: 'shoot.assigned', name: 'Shoot Assigned', webhookUrl: '/webhook/shoot-assigned', method: 'POST' },
  'shoot.completed': { event: 'shoot.completed', name: 'Shoot Completed', webhookUrl: '/webhook/shoot-completed', method: 'POST' },
  'editor.assigned': { event: 'editor.assigned', name: 'Editor Assigned', webhookUrl: '/webhook/editor-assigned', method: 'POST' },
  'draft.submitted': { event: 'draft.submitted', name: 'Draft Submitted', webhookUrl: '/webhook/draft-submitted', method: 'POST' },
  'draft.approved': { event: 'draft.approved', name: 'Draft Approved', webhookUrl: '/webhook/draft-approved', method: 'POST' },
  'revision.requested': { event: 'revision.requested', name: 'Revision Requested', webhookUrl: '/webhook/revision-requested', method: 'POST' },
  'project.delivered': { event: 'project.delivered', name: 'Project Delivered', webhookUrl: '/webhook/project-delivered', method: 'POST' },
  'project.closed': { event: 'project.closed', name: 'Project Closed', webhookUrl: '/webhook/project-closed', method: 'POST' },
  'invoice.created': { event: 'invoice.created', name: 'Invoice Created', webhookUrl: '/webhook/invoice-created', method: 'POST' },
  'invoice.sent': { event: 'invoice.sent', name: 'Invoice Sent', webhookUrl: '/webhook/invoice-sent', method: 'POST' },
};

export interface WorkflowResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
}
