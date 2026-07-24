export type { UserRole, User, AuthContextValue } from './auth';

export type ProjectStatus =
  | 'new_lead'
  | 'requirements_filled'
  | 'proposal_sent'
  | 'payment_pending'
  | 'payment_done'
  | 'shoot_scheduled'
  | 'footage_received'
  | 'editor_assigned'
  | 'editing'
  | 'draft_sent'
  | 'in_revision'
  | 'approved'
  | 'delivered'
  | 'closed';

export type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'overdue';
export type PaymentMode = 'Online' | 'Cash';
export type InstallmentLabel = 'Advance' | 'Day Before Shoot' | 'Post Shoot' | 'Custom';

export interface PaymentInstallment {
  payment_id: string;
  lead_id: string;
  client_name: string;
  installment_label: InstallmentLabel;
  amount: number;
  payment_mode: PaymentMode;
  cash_collected_by?: string;
  payment_status: string;
  payment_link_sent_at?: string;
  verified_at?: string;
  total_cost: number;
  remaining_amount: number;
  payment_completed: boolean;
}
export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type ServiceType =
  | 'podcast'
  | 'reel'
  | 'brand_film'
  | 'product_video'
  | 'event_coverage'
  | 'social_media';

export interface Client {
  id: string;
  name: string;
  company: string;
  whatsapp: string;
  contact: string;
  email: string;
  socialHandle?: string;
  city: string;
  totalProjects: number;
  totalRevenue: number;
  status: 'active' | 'inactive' | 'lead';
  createdAt: string;
}

export interface Shoot {
  id: string;
  projectId: string;
  date: string;
  location: string;
  crew: string[];
  equipment: string[];
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  driveLink?: string;
  notes?: string;
}

export interface Editor {
  id: string;
  name: string;
  initials: string;
  email: string;
  status: 'available' | 'busy' | 'offline';
  activeProjects: number;
  completedProjects: number;
  specialization: ServiceType[];
}

export interface Project {
  id: string;
  serialNo: number;
  client: Client;
  service: ServiceType;
  status: ProjectStatus;
  priority: Priority;
  budget: number;
  paidAmount: number;
  salesMember: string;
  editor?: Editor;
  shoot?: Shoot;
  requirements?: string;
  shootDate?: string;
  remarks?: string;
  driveLink?: string;
  draftLink?: string;
  revisions: number;
  createdAt: string;
  updatedAt: string;
  timeline: TimelineEvent[];
}

export interface TimelineEvent {
  id: string;
  event: string;
  description: string;
  timestamp: string;
  actor: string;
}

export interface Invoice {
  id: string;
  projectId: string;
  clientName: string;
  amount: number;
  status: PaymentStatus;
  dueDate: string;
  paidDate?: string;
  type: 'advance' | 'final' | 'installment';
}

export interface ActivityLog {
  id: string;
  type: string;
  message: string;
  actor: string;
  timestamp: string;
  projectId?: string;
}
