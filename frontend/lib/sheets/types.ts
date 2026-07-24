export interface Payment {
  paymentId: string;
  leadId: string;
  clientName: string;
  amount: string;
  paymentLinkSent: string;
  paymentLinkSentAt: string;
  screenshotUrl: string;
  utrNumber: string;
  paymentStatus: string;
  verifiedBy: string;
  verifiedAt: string;
}

export interface CreateLeadInput {
  name: string;
  phoneNumber: string;
  whatsapp?: string;
  servicePitched: string;
  assignedTo: string;
  clientEmail?: string;
  cost?: string;
  reachoutDone: 'yes' | 'no';
  podcastDraft?: string;
  podcastEdit?: string;
  reelDraft?: string;
  reelEdit?: string;
  longFormatVideo?: string;
  teaserDemo?: string;
  teaser?: string;
  teaserEdit?: string;
  thumbnail?: string;
  thumbnailEdit?: string;
  serviceNotes?: string;
  camera?: string;
  recordTime?: string;
  studioTime?: string;
  remainingAmount?: string;
  shortFormatVideo?: string;
  longFormatDuration?: string;
  shortFormatDuration?: string;
  additionalNotes?: string;
  salesNotes?: string;
}

export interface Lead {
  id: string;
  leadId: string;
  phoneNumber: string;
  date: string;
  adRefCode: string;
  source: string;
  assignedTo: string;
  name: string;
  reachoutDone: string;
  servicePitched: string;
  cost: string;
  status: string;
  clientEmail: string;
  proposalSent: string;
  proposalAccepted: boolean;
  proposalSentAt: string;
  podcastDraft: string;
  podcastEdit: string;
  reelDraft: string;
  reelEdit: string;
  longFormatVideo: string;
  teaserDemo: string;
  teaser: string;
  teaserEdit: string;
  thumbnail: string;
  thumbnailEdit: string;
  serviceNotes: string;
  camera: string;
  recordTime: string;
  studioTime: string;
  remainingAmount: string;
  shortFormatVideo: string;
  longFormatDuration: string;
  shortFormatDuration: string;
  additionalNotes: string;
  salesNotes: string;
  proposalRevokeReason: string;
  serialNo: number;
  searchText: string;
  payment: Payment | null;
  payment_status?: string;
}

export type LeadFilterTab = 'all' | 'new_leads' | 'proposal_sent' | 'revoked' | 'accepted';

export interface Shoot {
  id: string;
  shootId: string;
  leadId: string;
  clientName: string;
  contactNum: string;
  emailId: string;
  shootDate: string;
  shootStartTime: string;
  shootEndTime: string;
  camera: string;
  teleprompter: string;
  totalHours: string;
  assignedTo: string;
  bts: string;
  shootMemberName: string;
  shootMemberEmail: string;
  dataLink: string;
  driveLinkUploaded: string;
  createdAt: string;
  testimonials: string;
  recordTime: string;
  studioTime: string;
  extraCamera: string;
  extraTeleprompter: string;
  extraDurationHours: string;
  additionalCost: string;
  shootNotes: string;
  editedByShootTeam: string;
  searchText: string;
}

export interface EditingProject {
  id: string;
  editId: string;
  shootId: string;
  leadId: string;
  clientName: string;
  month: string;
  editStartDate: string;
  editDeliveryDate: string;
  podcastDraft: string;
  podcastEdit: string;
  longFormatVideo: string;
  reelDraft: string;
  reel: string;
  teaserDemo: string;
  teaser: string;
  thumbnail: string;
  dataLink: string;
  status: string;
  totalService: string;
  emailId: string;
  handoverToClient: string;
  editorName: string;
  editorEmail: string;
  serviceType: string;
  revisionCount: number;
  maxFreeRevisions: number;
  extraRevisionApproved: boolean;
  extraRevisionCost: string;
  currentDraftLink: string;
  assignedAt: string;
  deadlineAt: string;
  deadlineNotified: string;
  finalDelivered: boolean;
  revisionFeedback?: string;
  searchText: string;
}

export const LEAD_STATUS_META: Record<
  string,
  { label: string; color: string; bg: string; border: string }
> = {
  'New Lead': {
    label: 'New Lead',
    color: '#8B949E',
    bg: 'rgba(139,148,158,0.12)',
    border: 'rgba(139,148,158,0.3)',
  },
  'Proposal Sent': {
    label: 'Proposal Sent',
    color: '#D29922',
    bg: 'rgba(210,153,34,0.12)',
    border: 'rgba(210,153,34,0.3)',
  },
  'Proposal Revoked': {
    label: 'Proposal Revoked',
    color: '#E57C2B',
    bg: 'rgba(229,124,43,0.12)',
    border: 'rgba(229,124,43,0.3)',
  },
  'Proposal Accepted': {
    label: 'Proposal Accepted',
    color: '#3FB950',
    bg: 'rgba(63,185,80,0.12)',
    border: 'rgba(63,185,80,0.3)',
  },
  'Shoot Scheduled': {
    label: 'Shoot Scheduled',
    color: '#58A6FF',
    bg: 'rgba(88,166,255,0.12)',
    border: 'rgba(88,166,255,0.3)',
  },
  Editing: {
    label: 'Editing',
    color: '#E57C2B',
    bg: 'rgba(229,124,43,0.12)',
    border: 'rgba(229,124,43,0.3)',
  },
  'Draft Sent': {
    label: 'Draft Sent',
    color: '#A371F7',
    bg: 'rgba(163,113,247,0.12)',
    border: 'rgba(163,113,247,0.3)',
  },
  Delivered: {
    label: 'Delivered',
    color: '#238636',
    bg: 'rgba(35,134,54,0.15)',
    border: 'rgba(35,134,54,0.4)',
  },
};

export const DEFAULT_LEAD_STATUS_META = {
  label: 'Unknown',
  color: '#8B949E',
  bg: 'rgba(139,148,158,0.12)',
  border: 'rgba(139,148,158,0.3)',
};
