import { NextResponse } from 'next/server';
import type { Lead, Payment, EditingProject } from '@/lib/sheets/types';


const EXPRESS_API_URL = process.env.NEXT_PUBLIC_EXPRESS_API_URL || 'http://localhost:5000/api/v1';

async function fetchFromExpress(endpoint: string) {
  try {
    const res = await fetch(`${EXPRESS_API_URL}${endpoint}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    return null;
  }
}

export const dynamic = 'force-dynamic';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const SERVICE_COLORS: Record<string, string> = {
  'Podcast': '#58A6FF',
  'Brand Film': '#3FB950',
  'Reel': '#D29922',
  'Product Video': '#E57C2B',
  'Event Coverage': '#F85149',
  'Social Media': '#8B949E',
  'Rentals': '#A371F7',
  'Other': '#76E3EA',
};

function normalizeService(service: string | undefined): string {
  if (!service) return 'Other';
  const s = service.toLowerCase();
  if (s.includes('podcast')) return 'Podcast';
  if (s.includes('reel')) return 'Reel';
  if (s.includes('brand')) return 'Brand Film';
  if (s.includes('product')) return 'Product Video';
  if (s.includes('event') || s.includes('coverage')) return 'Event Coverage';
  if (s.includes('social') || s.includes('media')) return 'Social Media';
  if (s.includes('rent') || s.includes('teleprompter') || s.includes('camera')) return 'Rentals';
  return 'Other';
}

/** Returns today's date as YYYY-MM-DD in IST (Asia/Kolkata, UTC+5:30). */
function getTodayIST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

/** Returns { year, month (0-indexed) } for the current month in IST. */
function getThisMonthIST(): { year: number; month: number } {
  const ist = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  return { year: ist.getFullYear(), month: ist.getMonth() };
}

/** Returns true if a YYYY-MM-DD date string falls in the given IST month. */
function isInMonth(dateStr: string | undefined, year: number, month: number): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return false;
  return d.getFullYear() === year && d.getMonth() === month;
}

/** Safe numeric parse ΓÇö returns 0 for falsy / NaN. */
function safeNum(v: string | undefined | null): number {
  const n = parseFloat(String(v ?? '').trim());
  return Number.isFinite(n) ? n : 0;
}

/** Days between a date string and now, rounded down. */
function daysSince(dateStr: string | undefined): number {
  if (!dateStr) return 0;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 0;
  return Math.floor((Date.now() - d.getTime()) / 86_400_000);
}

import { getAuthenticatedUser } from '@/lib/auth-server';

export async function GET() {
  try {
    const user = getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const [leadsRes, paymentsRes, editingRes, shootsRes, editingTasksRes] = await Promise.all([
      fetchFromExpress('/clients'),
      fetchFromExpress('/payments'),
      fetchFromExpress('/editing'),
      fetchFromExpress('/shoots'),
      fetchFromExpress('/editor-tasks'), // Or wherever editing tasks are
    ]);

    const allLeads: Lead[] = leadsRes?.leads || [];
    const allPayments: Payment[] = paymentsRes?.payments || [];
    const allEditing: EditingProject[] = editingRes?.editing || [];
    const allShoots: any[] = shootsRes?.shoots || [];
    const allEditingTasks: any[] = editingTasksRes?.tasks || [];

    let leads = allLeads;
    let payments = allPayments;
    let editingProjects = allEditing;
    let shoots = allShoots;
    let editingTasks = allEditingTasks;

    if (user.role === 'sales') {
      leads = allLeads.filter(
        (lead) =>
          lead.assignedTo.trim().toLowerCase() === user.name.trim().toLowerCase() ||
          lead.assignedTo.trim().toLowerCase() === user.email.trim().toLowerCase() ||
          lead.assignedTo.trim().toLowerCase() === user.username.trim().toLowerCase()
      );
      const allowedLeadIds = new Set(leads.map((l) => l.leadId));
      payments = allPayments.filter((p) => p.leadId && allowedLeadIds.has(p.leadId));
      editingProjects = allEditing.filter((e) => e.leadId && allowedLeadIds.has(e.leadId));
    } else if (user.role === 'editor') {
      editingProjects = allEditing.filter(
        (edit) =>
          edit.editorEmail.trim().toLowerCase() === user.email.trim().toLowerCase() ||
          edit.editorName.trim().toLowerCase() === user.name.trim().toLowerCase()
      );
      editingTasks = allEditingTasks.filter(
        (t) => t.assigned_to_email.trim().toLowerCase() === user.email.trim().toLowerCase()
      );
      const allowedLeadIds = new Set(editingProjects.map((e) => e.leadId));
      leads = allLeads.filter((l) => l.leadId && allowedLeadIds.has(l.leadId));
      payments = allPayments.filter((p) => p.leadId && allowedLeadIds.has(p.leadId));
    } else if (user.role === 'shoot') {
      const userShoots = allShoots.filter(
        (shoot) =>
          shoot.shootMemberEmail.trim().toLowerCase() === user.email.trim().toLowerCase() ||
          shoot.shootMemberName.trim().toLowerCase() === user.name.trim().toLowerCase()
      );
      shoots = userShoots;
      const allowedLeadIds = new Set(userShoots.map((s) => s.leadId));
      leads = allLeads.filter((l) => l.leadId && allowedLeadIds.has(l.leadId));
      payments = allPayments.filter((p) => p.leadId && allowedLeadIds.has(p.leadId));
      editingProjects = allEditing.filter((e) => e.leadId && allowedLeadIds.has(e.leadId));
      // Shoot role doesn't need editingTasks
      editingTasks = [];
    }

    const validPayments = payments.filter((p) => p.paymentId && p.paymentId.trim() !== '');

    // 1. Group payments by leadId for type inference
    const paymentsByLead: Record<string, Payment[]> = {};
    for (const p of validPayments) {
      if (!p.leadId) continue;
      if (!paymentsByLead[p.leadId]) {
        paymentsByLead[p.leadId] = [];
      }
      paymentsByLead[p.leadId].push(p);
    }

    const parsePaymentDate = (p: Payment) => {
      const d = p.paymentLinkSentAt ? new Date(p.paymentLinkSentAt) : new Date(0);
      return isNaN(d.getTime()) ? 0 : d.getTime();
    };

    for (const leadId in paymentsByLead) {
      paymentsByLead[leadId].sort((a, b) => parsePaymentDate(a) - parsePaymentDate(b));
    }

    // 2. Map payments to invoices
    const invoices = validPayments.map((p) => {
      const amountVal = parseFloat(p.amount) || 0;
      const statusLower = (p.paymentStatus || '').trim().toLowerCase();

      let status: 'paid' | 'unpaid' | 'partial' | 'overdue' = 'unpaid';
      const isVerified = ['payment verified', 'payment confirmed', 'confirmed'].includes(statusLower);
      const isPendingVer = ['pending verification', 'screenshot uploaded - pending verification'].includes(statusLower);

      if (isVerified) {
        status = 'paid';
      } else if (isPendingVer) {
        status = 'partial';
      } else {
        status = 'unpaid';
      }

      const linkSentDate = p.paymentLinkSentAt ? new Date(p.paymentLinkSentAt) : null;
      let dueDateStr = '';
      if (linkSentDate && !isNaN(linkSentDate.getTime())) {
        const dueDateObj = new Date(linkSentDate.getTime() + 7 * 24 * 60 * 60 * 1000);
        dueDateStr = dueDateObj.toISOString();

        if (status !== 'paid' && Date.now() > dueDateObj.getTime()) {
          status = 'overdue';
        }
      } else {
        dueDateStr = new Date().toISOString();
      }

      const leadPayments = paymentsByLead[p.leadId] || [];
      const index = leadPayments.findIndex((x) => x.paymentId === p.paymentId);
      let type: 'advance' | 'final' | 'installment' = 'advance';
      if (leadPayments.length > 1) {
        if (index === 0) {
          type = 'advance';
        } else if (index === leadPayments.length - 1) {
          type = 'final';
        } else {
          type = 'installment';
        }
      }

      return {
        id: p.paymentId,
        projectId: p.leadId,
        clientName: p.clientName || 'Unknown Client',
        amount: amountVal,
        status,
        dueDate: dueDateStr,
        paidDate: isVerified ? (p.verifiedAt || p.paymentLinkSentAt) : undefined,
        type,
      };
    });

    // 3. Analytics Aggregations
    const currentYear = new Date().getFullYear();
    const getMonthName = (dateStr: string | undefined) => {
      if (!dateStr) return null;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return null;
      if (d.getFullYear() === currentYear) {
        return MONTH_NAMES[d.getMonth()];
      }
      return null;
    };

    const revenueByMonth: Record<string, number> = {};
    const projectsByMonth: Record<string, Set<string>> = {};
    const leadsCountByMonth: Record<string, number> = {};
    const convertedCountByMonth: Record<string, number> = {};

    MONTH_NAMES.forEach((m) => {
      revenueByMonth[m] = 0;
      projectsByMonth[m] = new Set<string>();
      leadsCountByMonth[m] = 0;
      convertedCountByMonth[m] = 0;
    });

    // Populate revenue
    for (const p of validPayments) {
      const statusLower = (p.paymentStatus || '').trim().toLowerCase();
      const isVerified = ['payment verified', 'payment confirmed', 'confirmed'].includes(statusLower);
      if (!isVerified) continue;

      const m = getMonthName(p.verifiedAt || p.paymentLinkSentAt);
      if (m) {
        revenueByMonth[m] += parseFloat(p.amount) || 0;
      }
    }

    // Populate projects and sales trend
    for (const lead of leads) {
      const m = getMonthName(lead.date);
      if (m) {
        leadsCountByMonth[m]++;
        if (lead.proposalAccepted) {
          convertedCountByMonth[m]++;
          projectsByMonth[m].add(lead.leadId);
        }
      }
    }

    const REVENUE_DATA = MONTH_NAMES.map((m) => ({
      month: m,
      revenue: revenueByMonth[m],
      projects: projectsByMonth[m].size,
    }));

    const SALES_TREND = MONTH_NAMES.map((m) => ({
      month: m,
      leads: leadsCountByMonth[m],
      converted: convertedCountByMonth[m],
    }));

    // Service distribution (revenue-weighted, existing chart)
    const serviceCounts: Record<string, number> = {};
    for (const lead of leads) {
      const norm = normalizeService(lead.servicePitched);
      serviceCounts[norm] = (serviceCounts[norm] || 0) + 1;
    }
    const SERVICE_DISTRIBUTION = Object.keys(serviceCounts).map((name) => ({
      name,
      value: serviceCounts[name],
      color: SERVICE_COLORS[name] || '#8B949E',
    }));

    // Status distribution
    const statusCounts: Record<string, number> = {
      Active: 0,
      'In Progress': 0,
      'On Hold': 0,
      Closed: 0,
    };
    for (const lead of leads) {
      const s = (lead.status || '').trim().toLowerCase();
      if (['proposal accepted', 'shoot scheduled', 'editing', 'draft sent'].includes(s)) {
        statusCounts['Active']++;
      } else if (['new lead', 'proposal sent', 'awaiting payment'].includes(s)) {
        statusCounts['In Progress']++;
      } else if (['delivered', 'closed'].includes(s)) {
        statusCounts['Closed']++;
      } else {
        statusCounts['On Hold']++;
      }
    }
    const STATUS_DISTRIBUTION = [
      { name: 'Active', value: statusCounts['Active'], color: '#3FB950' },
      { name: 'In Progress', value: statusCounts['In Progress'], color: '#58A6FF' },
      { name: 'On Hold', value: statusCounts['On Hold'], color: '#D29922' },
      { name: 'Closed', value: statusCounts['Closed'], color: '#6E7681' },
    ];

    // Editors performance (from Editing sheet)
    const editorsMap: Record<string, {
      id: string;
      name: string;
      initials: string;
      email: string;
      status: 'available' | 'busy' | 'offline';
      activeProjects: number;
      completedProjects: number;
      specialization: Set<string>;
    }> = {};

    for (const proj of editingProjects) {
      const name = (proj.editorName || '').trim();
      if (!name) continue;

      if (!editorsMap[name]) {
        const words = name.split(/\s+/);
        const initials = words.map((w) => w[0]?.toUpperCase()).join('').slice(0, 2);
        const id = 'ed_' + name.toLowerCase().replace(/[^a-z0-9]/g, '_');

        editorsMap[name] = {
          id,
          name,
          initials,
          email: proj.editorEmail || '',
          status: 'available',
          activeProjects: 0,
          completedProjects: 0,
          specialization: new Set<string>(),
        };
      }

      const isDelivered = (proj.status || '').trim().toLowerCase() === 'delivered' || proj.finalDelivered;
      if (isDelivered) {
        editorsMap[name].completedProjects++;
      } else {
        editorsMap[name].activeProjects++;
      }

      if (proj.serviceType) {
        editorsMap[name].specialization.add(normalizeService(proj.serviceType));
      }
    }

    const EDITORS = Object.values(editorsMap).map((e) => ({
      ...e,
      status: e.activeProjects > 0 ? ('busy' as const) : ('available' as const),
      specialization: Array.from(e.specialization),
    }));

    // Overall metrics
    const totalRevenue = validPayments.reduce((sum, p) => {
      const statusLower = (p.paymentStatus || '').trim().toLowerCase();
      const isVerified = ['payment verified', 'payment confirmed', 'confirmed'].includes(statusLower);
      return sum + (isVerified ? (parseFloat(p.amount) || 0) : 0);
    }, 0);

    const totalProjects = leads.filter((l) => l.proposalAccepted).length;
    const avgProject = totalProjects > 0 ? totalRevenue / totalProjects : 0;
    const totalLeads = leads.length;
    const totalConverted = leads.filter((l) => l.proposalAccepted).length;
    const conversionRate = totalLeads > 0 ? (totalConverted / totalLeads) * 100 : 0;

    // -------------------------------------------------------------------------
    // NEW METRICS
    // -------------------------------------------------------------------------

    const todayIST = getTodayIST();
    const { year: istYear, month: istMonth } = getThisMonthIST();

    // --- salesMetrics ---
    const convertedLeads = leads.filter((l) => l.proposalAccepted);

    const newClientsAdded = convertedLeads.filter((l) => isInMonth(l.date, istYear, istMonth)).length;

    const totalSalesValue = convertedLeads.reduce((sum, l) => sum + safeNum(l.cost), 0);

    const totalCollectionValue = validPayments.reduce((sum, p) => {
      const statusLower = (p.paymentStatus || '').trim().toLowerCase();
      const isVerified = ['payment verified', 'payment confirmed', 'confirmed'].includes(statusLower);
      return sum + (isVerified ? safeNum(p.amount) : 0);
    }, 0);

    const totalPendingAmount = convertedLeads.reduce((sum, l) => {
      const rem = safeNum(l.remainingAmount);
      return sum + (rem > 0 ? rem : 0);
    }, 0);

    const serviceClientCounts: Record<string, number> = {};
    for (const lead of convertedLeads) {
      const norm = normalizeService(lead.servicePitched);
      serviceClientCounts[norm] = (serviceClientCounts[norm] || 0) + 1;
    }
    const serviceWiseClients = Object.entries(serviceClientCounts).map(([name, count]) => ({
      name,
      count,
      color: SERVICE_COLORS[name] || '#8B949E',
    }));

    const salesMetrics = {
      newClientsAdded,
      totalSalesValue,
      totalCollectionValue,
      totalPendingAmount,
      serviceWiseClients,
    };

    // --- shootMetrics ---
    const shootsToday = shoots.filter((s) => s.shootDate === todayIST).length;
    const shootsFuture = shoots.filter((s) => s.shootDate > todayIST).length;
    const shootsPast = shoots.filter((s) => s.shootDate < todayIST && s.shootDate !== '').length;

    const thisMonthShoots = shoots.filter((s) => isInMonth(s.shootDate, istYear, istMonth));

    let shootExtraHoursSummary = 0;
    for (const s of thisMonthShoots) {
      const hrs = safeNum(s.extraDurationHours);
      if (hrs > 0) shootExtraHoursSummary += hrs;
    }

    const shootExtraEquipment = thisMonthShoots.filter(
      (s) => safeNum(s.extraCamera) > 0 || safeNum(s.extraTeleprompter) > 0
    ).length;

    const recordTimes = thisMonthShoots.map((s) => safeNum(s.recordTime)).filter((v) => v > 0);
    const studioTimes = thisMonthShoots.map((s) => safeNum(s.studioTime)).filter((v) => v > 0);
    const avgRecordTime = recordTimes.length > 0 ? recordTimes.reduce((a, b) => a + b, 0) / recordTimes.length : 0;
    const avgStudioTime = studioTimes.length > 0 ? studioTimes.reduce((a, b) => a + b, 0) / studioTimes.length : 0;

    const shootMetrics = {
      shootsToday,
      shootsFuture,
      shootsPast,
      shootExtraHoursSummary: Math.round(shootExtraHoursSummary * 100) / 100,
      shootExtraEquipment,
      avgRecordTime: Math.round(avgRecordTime * 100) / 100,
      avgStudioTime: Math.round(avgStudioTime * 100) / 100,
    };

    // --- editingMetrics ---
    const now = Date.now();
    const TWO_DAYS_MS = 2 * 86_400_000;

    let editTotal = 0;
    let editNotStarted = 0;
    let editInProgress = 0;
    let editSharedForReview = 0;
    let editDelivered = 0;
    let editOutOfTAT = 0;
    const agingList: { task_id: string; client_name: string; task_label: string; assigned_to_name: string; days: number }[] = [];

    const editorStatsMap: Record<string, {
      editor_name: string;
      editor_email: string;
      assigned: number;
      inProgress: number;
      sharedForReview: number;
      delivered: number;
      outOfTAT: number;
    }> = {};

    for (const task of editingTasks) {
      editTotal++;
      const statusRaw = (task.status || '').trim();
      const statusLower = statusRaw.toLowerCase();
      const isDelivered = task.final_delivered === 'true' || task.final_delivered === true as unknown as string || statusLower === 'delivered';
      const deadlineMs = task.deadline_at ? new Date(task.deadline_at).getTime() : 0;
      const isOutOfTAT = !isDelivered && deadlineMs > 0 && now > deadlineMs;
      const assignedAtMs = task.deadline_at ? new Date(task.deadline_at).getTime() : 0; // use assigned_at below
      const assignedAtActual = (task as any).assigned_at;
      const assignedAtParsed = assignedAtActual ? new Date(assignedAtActual).getTime() : 0;

      if (isDelivered) {
        editDelivered++;
      } else if (statusLower === 'in progress') {
        editInProgress++;
      } else if (statusLower === 'shared for review' || statusLower === 'pending review') {
        editSharedForReview++;
      } else if (statusLower === 'assigned') {
        // Only "not started" if assigned more than 2 days ago
        const ageMs = assignedAtParsed > 0 ? now - assignedAtParsed : 0;
        if (ageMs > TWO_DAYS_MS) {
          editNotStarted++;
        }
      }
      // out of TAT counted separately (can overlap statuses)
      if (isOutOfTAT) editOutOfTAT++;

      // Aging list for non-delivered tasks
      if (!isDelivered) {
        const days = assignedAtParsed > 0 ? Math.floor((now - assignedAtParsed) / 86_400_000) : 0;
        agingList.push({
          task_id: task.task_id,
          client_name: task.client_name,
          task_label: task.task_label,
          assigned_to_name: task.assigned_to_name,
          days,
        });
      }

      // Per-editor stats
      const editorKey = task.assigned_to_email || task.assigned_to_name || 'unknown';
      if (!editorStatsMap[editorKey]) {
        editorStatsMap[editorKey] = {
          editor_name: task.assigned_to_name || 'Unknown',
          editor_email: task.assigned_to_email || '',
          assigned: 0,
          inProgress: 0,
          sharedForReview: 0,
          delivered: 0,
          outOfTAT: 0,
        };
      }
      const es = editorStatsMap[editorKey];
      if (isDelivered) {
        es.delivered++;
      } else if (statusLower === 'in progress') {
        es.inProgress++;
      } else if (statusLower === 'shared for review' || statusLower === 'pending review') {
        es.sharedForReview++;
      } else if (statusLower === 'assigned') {
        es.assigned++;
      }
      if (isOutOfTAT) es.outOfTAT++;
    }

    agingList.sort((a, b) => b.days - a.days);
    const aging = agingList.slice(0, 50);

    const tasksPerEditor = Object.values(editorStatsMap);
    const loadCapacity = tasksPerEditor.map((e) => ({
      editor_name: e.editor_name,
      activeCount: e.assigned + e.inProgress,
    }));

    const editingMetrics = {
      total: editTotal,
      notStarted: editNotStarted,
      inProgress: editInProgress,
      sharedForReview: editSharedForReview,
      delivered: editDelivered,
      outOfTAT: editOutOfTAT,
      aging,
      tasksPerEditor,
      loadCapacity,
    };

    return NextResponse.json({
      success: true,
      invoices,
      analytics: {
        totalRevenue,
        totalProjects,
        avgProject,
        conversionRate,
        REVENUE_DATA,
        SERVICE_DISTRIBUTION,
        STATUS_DISTRIBUTION,
        SALES_TREND,
        EDITORS,
        salesMetrics,
        shootMetrics,
        editingMetrics,
      },
    });
  } catch (error) {
    console.error('Failed to aggregate real-time sheets data:', error);
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
