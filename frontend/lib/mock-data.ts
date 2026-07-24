import type { Client, Editor, Project, Invoice, ActivityLog, Shoot } from './types';

export const EDITORS: Editor[] = [
  { id: 'e1', name: 'Siddharth Roy', initials: 'SR', email: 'siddharth@howgartsmedia.com', status: 'busy', activeProjects: 3, completedProjects: 28, specialization: ['podcast', 'brand_film'] },
  { id: 'e2', name: 'Priya Sharma', initials: 'PS', email: 'priya@howgartsmedia.com', status: 'available', activeProjects: 1, completedProjects: 19, specialization: ['reel', 'social_media'] },
  { id: 'e3', name: 'Arjun Mehta', initials: 'AM', email: 'arjun@howgartsmedia.com', status: 'busy', activeProjects: 2, completedProjects: 34, specialization: ['product_video', 'event_coverage'] },
  { id: 'e4', name: 'Neha Kapoor', initials: 'NK', email: 'neha@howgartsmedia.com', status: 'available', activeProjects: 0, completedProjects: 41, specialization: ['brand_film', 'podcast'] },
  { id: 'e5', name: 'Rahul Verma', initials: 'RV', email: 'rahul@howgartsmedia.com', status: 'offline', activeProjects: 0, completedProjects: 12, specialization: ['social_media', 'reel'] },
];

export const CLIENTS: Client[] = [
  { id: 'c1', name: 'Rajesh Kumar', company: 'TechVision India', whatsapp: '+91 98765 43210', contact: '+91 98765 43210', email: 'rajesh@techvision.in', socialHandle: '@techvision', city: 'Mumbai', totalProjects: 4, totalRevenue: 1850000, status: 'active', createdAt: '2024-08-12' },
  { id: 'c2', name: 'Anika Desai', company: 'Anika Fashion House', whatsapp: '+91 99876 54321', contact: '+91 99876 54321', email: 'anika@anikafashion.com', socialHandle: '@anikafashion', city: 'Delhi', totalProjects: 2, totalRevenue: 720000, status: 'active', createdAt: '2024-11-03' },
  { id: 'c3', name: 'Vikram Singh', company: 'Singh & Sons Realty', whatsapp: '+91 91234 56789', contact: '+91 91234 56789', email: 'vikram@singhrealty.in', city: 'Jaipur', totalProjects: 1, totalRevenue: 350000, status: 'active', createdAt: '2025-01-15' },
  { id: 'c4', name: 'Meera Iyer', company: 'Bloom Cosmetics', whatsapp: '+91 90123 45678', contact: '+91 90123 45678', email: 'meera@bloomcosmetics.com', socialHandle: '@bloomcosmetics', city: 'Bangalore', totalProjects: 3, totalRevenue: 980000, status: 'active', createdAt: '2024-09-22' },
  { id: 'c5', name: 'Karan Malhotra', company: 'Malhotra Foods', whatsapp: '+91 93456 78901', contact: '+91 93456 78901', email: 'karan@malhotrafoods.in', city: 'Pune', totalProjects: 0, totalRevenue: 0, status: 'lead', createdAt: '2025-06-10' },
  { id: 'c6', name: 'Sneha Reddy', company: 'Reddy Wellness', whatsapp: '+91 94567 89012', contact: '+91 94567 89012', email: 'sneha@reddywellness.com', socialHandle: '@reddywellness', city: 'Hyderabad', totalProjects: 1, totalRevenue: 280000, status: 'inactive', createdAt: '2024-12-01' },
];

const now = new Date().toISOString();
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();
const daysAhead = (n: number) => new Date(Date.now() + n * 86400000).toISOString();

export const PROJECTS: Project[] = [
  {
    id: 'p1', serialNo: 1, client: CLIENTS[0], service: 'podcast', status: 'editing', priority: 'high',
    budget: 450000, paidAmount: 225000, salesMember: 'Shubham', editor: EDITORS[0],
    requirements: '8-episode podcast series, multi-cam setup, professional audio mixing',
    shootDate: daysAgo(5), revisions: 0, createdAt: daysAgo(20), updatedAt: daysAgo(2),
    driveLink: 'https://drive.google.com/drive/folders/p1footage',
    timeline: [
      { id: 't1', event: 'Editor Assigned', description: 'Siddharth Roy assigned to project', timestamp: daysAgo(3), actor: 'Albus Dumbledore' },
      { id: 't2', event: 'Footage Received', description: 'Raw footage uploaded to Drive', timestamp: daysAgo(4), actor: 'Shoot Team' },
      { id: 't3', event: 'Payment Received', description: 'Advance of ₹2,25,000 received', timestamp: daysAgo(12), actor: 'Shubham' },
    ],
  },
  {
    id: 'p2', serialNo: 2, client: CLIENTS[1], service: 'brand_film', status: 'proposal_sent', priority: 'medium',
    budget: 380000, paidAmount: 0, salesMember: 'Shubham',
    requirements: '3-minute brand film, studio + outdoor locations, 2-day shoot',
    revisions: 0, createdAt: daysAgo(8), updatedAt: daysAgo(1),
    timeline: [
      { id: 't4', event: 'Proposal Sent', description: 'Proposal shared with client via WhatsApp', timestamp: daysAgo(1), actor: 'Shubham' },
      { id: 't5', event: 'Lead Created', description: 'Lead captured from WhatsApp Business', timestamp: daysAgo(8), actor: 'Shubham' },
    ],
  },
  {
    id: 'p3', serialNo: 3, client: CLIENTS[2], service: 'product_video', status: 'shoot_scheduled', priority: 'urgent',
    budget: 350000, paidAmount: 175000, salesMember: 'Shubham',
    shoot: { id: 's1', projectId: 'p3', date: daysAhead(2), location: 'Jaipur Studio', crew: ['Ravi (Cam)', 'Amit (Light)', 'Sara (Sound)'], equipment: ['Sony FX6', 'DJI Ronin', 'Aputure 600D'], status: 'scheduled' },
    requirements: 'Product showcase video, 5 SKUs, white cyc backdrop',
    shootDate: daysAhead(2), revisions: 0, createdAt: daysAgo(15), updatedAt: daysAgo(3),
    timeline: [
      { id: 't6', event: 'Shoot Scheduled', description: 'Shoot scheduled for ' + new Date(daysAhead(2)).toLocaleDateString('en-IN'), timestamp: daysAgo(3), actor: 'Albus Dumbledore' },
      { id: 't7', event: 'Payment Received', description: 'Advance of ₹1,75,000 received', timestamp: daysAgo(6), actor: 'Shubham' },
    ],
  },
  {
    id: 'p4', serialNo: 4, client: CLIENTS[3], service: 'reel', status: 'draft_sent', priority: 'medium',
    budget: 120000, paidAmount: 60000, salesMember: 'Shubham', editor: EDITORS[1],
    requirements: '5 Instagram reels, beauty product focus, trending audio',
    revisions: 0, createdAt: daysAgo(18), updatedAt: daysAgo(1),
    draftLink: 'https://drive.google.com/file/d/p4draft',
    timeline: [
      { id: 't8', event: 'Draft Submitted', description: 'Review draft uploaded', timestamp: daysAgo(1), actor: 'Priya Sharma' },
      { id: 't9', event: 'Editor Assigned', description: 'Priya Sharma assigned', timestamp: daysAgo(6), actor: 'Albus Dumbledore' },
    ],
  },
  {
    id: 'p5', serialNo: 5, client: CLIENTS[4], service: 'social_media', status: 'new_lead', priority: 'low',
    budget: 0, paidAmount: 0, salesMember: 'Shubham',
    revisions: 0, createdAt: daysAgo(2), updatedAt: daysAgo(2),
    timeline: [
      { id: 't10', event: 'Lead Created', description: 'New lead from WhatsApp Business', timestamp: daysAgo(2), actor: 'Shubham' },
    ],
  },
  {
    id: 'p6', serialNo: 6, client: CLIENTS[5], service: 'event_coverage', status: 'footage_received', priority: 'high',
    budget: 280000, paidAmount: 140000, salesMember: 'Shubham',
    requirements: 'Wellness expo coverage, 1-day event, 3 cameras',
    revisions: 0, createdAt: daysAgo(25), updatedAt: daysAgo(4),
    driveLink: 'https://drive.google.com/drive/folders/p6footage',
    timeline: [
      { id: 't11', event: 'Footage Received', description: 'Event footage uploaded', timestamp: daysAgo(4), actor: 'Shoot Team' },
      { id: 't12', event: 'Shoot Completed', description: 'Wellness expo shoot completed', timestamp: daysAgo(5), actor: 'Shoot Team' },
    ],
  },
  {
    id: 'p7', serialNo: 7, client: CLIENTS[0], service: 'brand_film', status: 'delivered', priority: 'medium',
    budget: 520000, paidAmount: 520000, salesMember: 'Shubham', editor: EDITORS[3],
    requirements: 'Corporate brand film, office + factory locations',
    revisions: 1, createdAt: daysAgo(60), updatedAt: daysAgo(7),
    draftLink: 'https://drive.google.com/file/d/p7final',
    timeline: [
      { id: 't13', event: 'Project Delivered', description: 'Final files delivered to client', timestamp: daysAgo(7), actor: 'Albus Dumbledore' },
      { id: 't14', event: 'Draft Approved', description: 'Client approved final draft', timestamp: daysAgo(10), actor: 'Shubham' },
    ],
  },
  {
    id: 'p8', serialNo: 8, client: CLIENTS[3], service: 'product_video', status: 'in_revision', priority: 'high',
    budget: 180000, paidAmount: 90000, salesMember: 'Shubham', editor: EDITORS[2],
    requirements: 'Cosmetic product launch video, 90 seconds',
    revisions: 1, createdAt: daysAgo(22), updatedAt: daysAgo(1),
    draftLink: 'https://drive.google.com/file/d/p8draft',
    timeline: [
      { id: 't15', event: 'Revision Requested', description: 'Client requested color grading changes', timestamp: daysAgo(1), actor: 'Meera Iyer' },
      { id: 't16', event: 'Draft Submitted', description: 'First draft uploaded', timestamp: daysAgo(3), actor: 'Arjun Mehta' },
    ],
  },
];

export const INVOICES: Invoice[] = [
  { id: 'inv1', projectId: 'p1', clientName: 'TechVision India', amount: 225000, status: 'paid', dueDate: daysAgo(12), paidDate: daysAgo(12), type: 'advance' },
  { id: 'inv2', projectId: 'p1', clientName: 'TechVision India', amount: 225000, status: 'unpaid', dueDate: daysAhead(5), type: 'final' },
  { id: 'inv3', projectId: 'p2', clientName: 'Anika Fashion House', amount: 380000, status: 'unpaid', dueDate: daysAhead(7), type: 'advance' },
  { id: 'inv4', projectId: 'p3', clientName: 'Singh & Sons Realty', amount: 175000, status: 'paid', dueDate: daysAgo(6), paidDate: daysAgo(6), type: 'advance' },
  { id: 'inv5', projectId: 'p3', clientName: 'Singh & Sons Realty', amount: 175000, status: 'unpaid', dueDate: daysAhead(2), type: 'final' },
  { id: 'inv6', projectId: 'p4', clientName: 'Bloom Cosmetics', amount: 60000, status: 'paid', dueDate: daysAgo(10), paidDate: daysAgo(10), type: 'advance' },
  { id: 'inv7', projectId: 'p4', clientName: 'Bloom Cosmetics', amount: 60000, status: 'partial', dueDate: daysAhead(3), type: 'final' },
  { id: 'inv8', projectId: 'p6', clientName: 'Reddy Wellness', amount: 140000, status: 'overdue', dueDate: daysAgo(2), type: 'final' },
  { id: 'inv9', projectId: 'p7', clientName: 'TechVision India', amount: 520000, status: 'paid', dueDate: daysAgo(15), paidDate: daysAgo(8), type: 'final' },
];

export const ACTIVITY: ActivityLog[] = [
  { id: 'a1', type: 'revision', message: 'Revision requested on Bloom Cosmetics product video', actor: 'Meera Iyer', timestamp: daysAgo(0.02), projectId: 'p8' },
  { id: 'a2', type: 'draft', message: 'Draft submitted for Bloom Cosmetics reel package', actor: 'Priya Sharma', timestamp: daysAgo(1), projectId: 'p4' },
  { id: 'a3', type: 'footage', message: 'Footage uploaded for Reddy Wellness event', actor: 'Shoot Team', timestamp: daysAgo(4), projectId: 'p6' },
  { id: 'a4', type: 'shoot', message: 'Shoot scheduled for Singh & Sons Realty', actor: 'Albus Dumbledore', timestamp: daysAgo(3), projectId: 'p3' },
  { id: 'a5', type: 'payment', message: 'Advance payment received from Singh & Sons Realty', actor: 'Shubham', timestamp: daysAgo(6), projectId: 'p3' },
  { id: 'a6', type: 'delivery', message: 'Brand film delivered to TechVision India', actor: 'Albus Dumbledore', timestamp: daysAgo(7), projectId: 'p7' },
  { id: 'a7', type: 'lead', message: 'New lead captured: Karan Malhotra (Malhotra Foods)', actor: 'Shubham', timestamp: daysAgo(2), projectId: 'p5' },
];

export const REVENUE_DATA = [
  { month: 'Jan', revenue: 320000, projects: 3 },
  { month: 'Feb', revenue: 450000, projects: 4 },
  { month: 'Mar', revenue: 580000, projects: 5 },
  { month: 'Apr', revenue: 410000, projects: 3 },
  { month: 'May', revenue: 720000, projects: 6 },
  { month: 'Jun', revenue: 890000, projects: 7 },
  { month: 'Jul', revenue: 650000, projects: 5 },
  { month: 'Aug', revenue: 980000, projects: 8 },
  { month: 'Sep', revenue: 1120000, projects: 9 },
  { month: 'Oct', revenue: 850000, projects: 7 },
  { month: 'Nov', revenue: 1240000, projects: 10 },
  { month: 'Dec', revenue: 1450000, projects: 11 },
];

export const SERVICE_DISTRIBUTION = [
  { name: 'Podcast', value: 28, color: '#58A6FF' },
  { name: 'Brand Film', value: 22, color: '#3FB950' },
  { name: 'Reel', value: 18, color: '#D29922' },
  { name: 'Product Video', value: 14, color: '#E57C2B' },
  { name: 'Event Coverage', value: 10, color: '#F85149' },
  { name: 'Social Media', value: 8, color: '#8B949E' },
];

export const STATUS_DISTRIBUTION = [
  { name: 'Active', value: 6, color: '#3FB950' },
  { name: 'In Progress', value: 4, color: '#58A6FF' },
  { name: 'On Hold', value: 2, color: '#D29922' },
  { name: 'Closed', value: 8, color: '#6E7681' },
];

export const SALES_TREND = [
  { month: 'Jan', leads: 8, converted: 3 },
  { month: 'Feb', leads: 12, converted: 4 },
  { month: 'Mar', leads: 15, converted: 5 },
  { month: 'Apr', leads: 10, converted: 3 },
  { month: 'May', leads: 18, converted: 6 },
  { month: 'Jun', leads: 22, converted: 7 },
];

export function getProject(id: string): Project | undefined {
  return PROJECTS.find((p) => p.id === id);
}
