'use client';

import { authFetch } from '@/lib/auth-fetch';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { AttendanceShimmer } from '@/components/shared/ShimmerLoader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { toast } from 'sonner';
import {
  Clock, LogIn, LogOut, MapPin, CheckCircle, AlertCircle, Calendar,
  UserCheck, Navigation, NavigationOff, ExternalLink, Loader2, Users,
  ChevronLeft, ChevronRight, TrendingUp, Download
} from 'lucide-react';

interface LocationCoords {
  lat: number | null;
  lng: number | null;
}

interface AttendanceRecord {
  _id?: string;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  date: string;
  checkIn?: string;
  checkOut?: string;
  status: 'Present' | 'Late' | 'Half-day' | 'Half Day' | 'Absent' | 'Weekly Off' | 'Leave' | 'LOP';
  workLocation: 'Office' | 'Remote' | 'On-site Shoot';
  notes?: string;
  checkInLocation?: LocationCoords;
  checkOutLocation?: LocationCoords;
  fullDayRequest?: boolean;
  fullDayRequestStatus?: 'None' | 'Pending' | 'Approved' | 'Rejected';
  lopApplied?: boolean;
  leaveBalance?: { remainingPL: number; totalPL: number; remainingSL: number; totalSL: number } | null;
  lopOverrideRequest?: { note?: string; status?: string };
}

interface LeaveRecord { _id: string; leaveType: 'Paid' | 'Sick'; startDate: string; endDate: string; totalDays: number; reason: string; status: 'Pending' | 'Approved' | 'Rejected'; certificateFileName?: string; }
interface LeaveBalance { financialYear: string; totalPL: number; usedPL: number; remainingPL: number; totalSL: number; usedSL: number; remainingSL: number; }
interface MonthStats {
  Present?: number; Late?: number; 'Half-day'?: number; Absent?: number;
  Leave?: number; LOP?: number; 'Weekly Off'?: number;
  totalWorkingDays?: number; effectiveWorkingDays?: number; attendancePercentage?: number;
}

// Newest records live on the first page; 10 records (≈ past 10 working days) per page.
const HISTORY_PAGE_SIZE = 10;
const ROSTER_PAGE_SIZE = 10;

// ─── Geolocation Helper ───────────────────────────────────────────────────────
const getCurrentLocation = (): Promise<LocationCoords> => {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ lat: null, lng: null });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve({ lat: null, lng: null }),
      { timeout: 8000, enableHighAccuracy: true }
    );
  });
};

const mapsUrl = (loc?: LocationCoords | null) => {
  if (!loc?.lat || !loc?.lng) return null;
  return `https://www.google.com/maps?q=${loc.lat},${loc.lng}`;
};

const formatCoords = (loc?: LocationCoords | null) => {
  if (!loc?.lat || !loc?.lng) return null;
  return `${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}`;
};

// 'YYYY-MM' -> 'August 2026' (parsed as local midnight to avoid TZ drift)
const monthLabel = (ym: string) =>
  new Date(`${ym}-01T00:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

const statusBadgeClass = (status?: string) => {
  switch (status) {
    case 'Present': return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    case 'Late': return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    case 'Half-day': case 'Half Day': return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
    case 'Leave': return 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30';
    case 'Weekly Off': return 'bg-slate-500/15 text-slate-400 border-slate-500/30';
    case 'LOP': return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
    default: return 'bg-red-500/15 text-red-400 border-red-500/30';
  }
};

const percentageBadgeClass = (pct: number) =>
  pct >= 85
    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
    : pct >= 70
      ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
      : 'bg-red-500/10 text-red-500 border-red-500/20';

// ─── Location Status Badge ────────────────────────────────────────────────────
function LocationStatusBadge({ status }: { status: 'idle' | 'acquiring' | 'captured' | 'denied' }) {
  if (status === 'acquiring') return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded-full">
      <Loader2 className="h-3 w-3 animate-spin" /> Acquiring Location…
    </span>
  );
  if (status === 'captured') return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
      <Navigation className="h-3 w-3" /> Location Captured
    </span>
  );
  if (status === 'denied') return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full">
      <NavigationOff className="h-3 w-3" /> Location Unavailable
    </span>
  );
  return null;
}

// ─── Location Cell for Manager Table ─────────────────────────────────────────
function LocationCell({ loc }: { loc?: LocationCoords | null }) {
  const url = mapsUrl(loc);
  const coords = formatCoords(loc);
  if (!coords || !url) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <NavigationOff className="h-3 w-3" /> Not shared
      </span>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-xs font-mono text-indigo-400 hover:text-indigo-300 hover:underline transition-colors group"
    >
      <MapPin className="h-3 w-3 text-indigo-500 group-hover:text-indigo-300" />
      {coords}
      <ExternalLink className="h-3 w-3 opacity-60" />
    </a>
  );
}

// ─── Pagination Bar (newest records sit on the first page) ───────────────────
function PaginationBar({
  page, totalPages, totalItems, pageSize, onPageChange
}: {
  page: number; totalPages: number; totalItems: number; pageSize: number; onPageChange: (page: number) => void;
}) {
  if (totalItems === 0) return null;
  const from = page * pageSize + 1;
  const to = Math.min(totalItems, (page + 1) * pageSize);
  return (
    <div className="flex items-center justify-between gap-3 pt-4">
      <p className="text-xs text-muted-foreground">
        Showing <span className="font-semibold text-foreground">{from}&ndash;{to}</span> of <span className="font-semibold text-foreground">{totalItems}</span> records
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline" size="icon" className="h-8 w-8"
          disabled={page === 0}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-xs font-medium text-muted-foreground px-2 whitespace-nowrap">
          Page {page + 1} of {totalPages}
        </span>
        <Button
          variant="outline" size="icon" className="h-8 w-8"
          disabled={page >= totalPages - 1}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default function AttendancePage() {
  const { user } = useAuth();
  const [time, setTime] = useState<string>('');
  const [elapsedTime, setElapsedTime] = useState<string>('00:00:00');
  const [workLocation, setWorkLocation] = useState<'Office' | 'Remote' | 'On-site Shoot'>('Office');
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [teamLogs, setTeamLogs] = useState<AttendanceRecord[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'acquiring' | 'captured' | 'denied'>('idle');
  const [capturedLocation, setCapturedLocation] = useState<LocationCoords | null>(null);
  
  const [employeeSummaries, setEmployeeSummaries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSummaries, setLoadingSummaries] = useState(false);
  const [summaryStartDate, setSummaryStartDate] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [summaryEndDate, setSummaryEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [leaveBalance, setLeaveBalance] = useState<LeaveBalance | null>(null);
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [teamLeaves, setTeamLeaves] = useState<LeaveRecord[]>([]);
  const [weeklyOff, setWeeklyOff] = useState<{ used: boolean; date: string | null }>({ used: false, date: null });
  const [leaveType, setLeaveType] = useState<'Paid' | 'Sick'>('Paid');
  const [leaveStart, setLeaveStart] = useState('');
  const [leaveEnd, setLeaveEnd] = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  const [certificate, setCertificate] = useState<File | null>(null);
  const [lopNote, setLopNote] = useState('');
  const [lopTarget, setLopTarget] = useState<AttendanceRecord | null>(null);
  const [lopOverrides, setLopOverrides] = useState<AttendanceRecord[]>([]);
  const [fullDayRequests, setFullDayRequests] = useState<AttendanceRecord[]>([]);
  const [historyMonth, setHistoryMonth] = useState<string>(''); // '' = All Months
  const [historyPage, setHistoryPage] = useState(0);
  const [rosterPage, setRosterPage] = useState(0);
  const [myMonthlyStats, setMyMonthlyStats] = useState<Record<string, MonthStats>>({});
  const [statMonth, setStatMonth] = useState<string>('');

  const fetchFullDayRequests = useCallback(async () => {
    if (!['manager', 'admin', 'super_admin'].includes(user?.role || '')) return;
    const res = await authFetch('/api/attendance?action=full-day-requests');
    if (res.ok) setFullDayRequests((await res.json()).records || []);
  }, [user?.role]);

  const fetchLeaveData = useCallback(async () => {
    if (user?.role === 'super_admin') return;
    try {
      const [balanceRes, leavesRes, weeklyRes] = await Promise.all([
        authFetch('/api/attendance?action=leave-balance'), authFetch('/api/attendance?action=my-leaves'), authFetch('/api/attendance?action=weekly-off-status')
      ]);
      if (balanceRes.ok) setLeaveBalance((await balanceRes.json()).balance || null);
      if (leavesRes.ok) setLeaves((await leavesRes.json()).leaves || []);
      if (weeklyRes.ok) setWeeklyOff(await weeklyRes.json());
    } catch { toast.error('Failed to load leave information'); }
  }, [user?.role]);
  const fetchTeamLeaves = useCallback(async () => {
    if (!['manager', 'admin', 'super_admin'].includes(user?.role || '')) return;
    const res = await authFetch('/api/attendance?action=team-leaves');
    if (res.ok) setTeamLeaves((await res.json()).leaves || []);
  }, [user?.role]);
  const fetchLopOverrides = useCallback(async () => {
    if (user?.role !== 'super_admin') return;
    const res = await authFetch('/api/attendance?action=lop-overrides');
    if (res.ok) setLopOverrides((await res.json()).records || []);
  }, [user?.role]);

  const fetchSummaries = useCallback(async () => {
    setLoadingSummaries(true);
    try {
      const res = await authFetch(`/api/attendance?action=summary&startDate=${summaryStartDate}&endDate=${summaryEndDate}`);
      const data = await res.json();
      if (res.ok && Array.isArray(data.summaries)) {
        setEmployeeSummaries(data.summaries);
      } else if (res.ok && Array.isArray(data)) {
        setEmployeeSummaries(data);
      }
    } catch (e) {
      toast.error('Failed to load employee summaries');
    } finally {
      setLoadingSummaries(false);
    }
  }, [summaryStartDate, summaryEndDate]);
  // Personal month-by-month attendance breakdown (percentage + leave/LOP/late/absent counts)
  const fetchMySummary = useCallback(async () => {
    try {
      const res = await authFetch('/api/attendance?action=my-summary');
      const data = await res.json();
      if (res.ok && data.months) {
        setMyMonthlyStats(data.months);
        setStatMonth((prev) => (prev && data.months[prev] ? prev : Object.keys(data.months).sort().reverse()[0] || ''));
      }
    } catch (e) {
      console.error('Failed to load monthly summary:', e);
    }
  }, []);


  useEffect(() => {
    if (user?.role === 'super_admin') {
      fetchSummaries();
    }
  }, [user, fetchSummaries]);

  // Live Digital Clock & Shift Timer
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' }));

      if (todayRecord?.checkIn) {
        const checkInTime = new Date(todayRecord.checkIn).getTime();
        const endTime = todayRecord.checkOut ? new Date(todayRecord.checkOut).getTime() : now.getTime();
        
        let diff = endTime - checkInTime;
        if (diff < 0) diff = 0;
        
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        
        const formatted = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        setElapsedTime(formatted);
      } else {
        setElapsedTime('00:00:00');
      }
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [todayRecord]);

  // Pre-fetch location when page loads (so it's ready when they punch)
  useEffect(() => {
    const roles = ['sales', 'shoot', 'editor', 'manager', 'admin'];
    if (!user?.role || !roles.includes(user.role)) return;
    setLocationStatus('acquiring');
    getCurrentLocation().then((loc) => {
      if (loc.lat && loc.lng) {
        setCapturedLocation(loc);
        setLocationStatus('captured');
      } else {
        setLocationStatus('denied');
      }
    });
  }, [user?.role]);

  const fetchAttendance = useCallback(async () => {
    try {
      const res = await authFetch('/api/attendance');
      const data = await res.json();
      if (res.ok) {
        setTodayRecord(data.today || null);
        setHistory(data.history || []);
      }
    } catch (e) {
      console.error('Failed to load attendance:', e);
    }
  }, []);

  const fetchTeamAttendance = useCallback(async (date: string) => {
    if (!['manager', 'admin', 'super_admin'].includes(user?.role || '')) return;
    try {
      const res = await fetch(`/api/attendance?date=${date}`);
      const data = await res.json();
      if (res.ok) {
        setTeamLogs(data.logs || []);
      }
    } catch (e) {
      console.error('Failed to load team attendance:', e);
    }
  }, [user]);

  useEffect(() => {
    fetchAttendance().finally(() => setLoading(false));
    fetchLeaveData();
    fetchTeamLeaves();
    fetchLopOverrides();
    fetchFullDayRequests();
    if (['manager', 'admin', 'super_admin'].includes(user?.role || '')) {
      fetchTeamAttendance(selectedDate);
    }
    fetchMySummary();
    setRosterPage(0);
  }, [fetchAttendance, fetchLeaveData, fetchLopOverrides, fetchTeamLeaves, fetchTeamAttendance, fetchFullDayRequests, fetchMySummary, selectedDate, user]);

  const submitLeave = async () => {
    if (!leaveStart || !leaveEnd || !leaveReason.trim()) return toast.error('Complete all leave details');
    if (leaveType === 'Sick' && !certificate) return toast.error('A medical certificate is required for Sick Leave');
    if (certificate && (!['application/pdf', 'image/jpeg', 'image/png'].includes(certificate.type) || certificate.size > 5 * 1024 * 1024)) return toast.error('Certificate must be PDF, JPG, or PNG up to 5MB');
    const form = new FormData(); form.set('proxyAction', 'apply-leave'); form.set('leaveType', leaveType); form.set('startDate', leaveStart); form.set('endDate', leaveEnd); form.set('reason', leaveReason); if (certificate) form.set('certificate', certificate);
    const res = await authFetch('/api/attendance', { method: 'POST', body: form }); const data = await res.json();
    if (!res.ok) return toast.error(data.error || 'Could not submit leave');
    toast.success('Leave request submitted'); setLeaveStart(''); setLeaveEnd(''); setLeaveReason(''); setCertificate(null); fetchLeaveData(); fetchTeamLeaves();
  };
  const reviewLeave = async (leaveId: string, action: 'Approved' | 'Rejected') => {
    const res = await authFetch('/api/attendance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ proxyAction: 'review-leave', leaveId, action }) });
    const data = await res.json(); if (!res.ok) return toast.error(data.error || 'Could not review leave'); toast.success(`Leave ${action.toLowerCase()}`); fetchTeamLeaves(); fetchTeamAttendance(selectedDate);
  };
  const submitLopOverride = async () => {
    if (!lopTarget?._id || !lopNote.trim()) return;
    const res = await authFetch('/api/attendance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ proxyAction: 'request-lop-override', attendanceId: lopTarget._id, note: lopNote }) });
    const data = await res.json(); if (!res.ok) return toast.error(data.error || 'Could not submit request'); toast.success('LOP override request submitted'); setLopTarget(null); setLopNote(''); fetchAttendance();
  };
  const reviewLopOverride = async (attendanceId: string, action: 'Approved' | 'Rejected') => {
    const res = await authFetch('/api/attendance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ proxyAction: 'approve-lop-override', attendanceId, action }) });
    const data = await res.json(); if (!res.ok) return toast.error(data.error || 'Could not review LOP request'); toast.success(`LOP request ${action.toLowerCase()}`); fetchLopOverrides(); fetchTeamAttendance(selectedDate);
  };

  // ── Get fresh location before punch ───────────────────────────────────────
  const acquireLocation = async (): Promise<LocationCoords> => {
    setLocationStatus('acquiring');
    const loc = await getCurrentLocation();
    if (loc.lat && loc.lng) {
      setCapturedLocation(loc);
      setLocationStatus('captured');
    } else {
      setLocationStatus('denied');
    }
    return loc;
  };

  const handleCheckIn = async () => {
    setIsSubmitting(true);
    try {
      const loc = await acquireLocation();
      if (!loc.lat || !loc.lng) {
        toast.warning('Location not captured', {
          description: 'Check-in will proceed without GPS coordinates. Please allow location access next time.'
        });
      }
      const res = await authFetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check-in', workLocation, checkInLocation: loc }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Check-in successful!', {
          description: `Status: ${data.attendance.status} | Location: ${data.attendance.workLocation}${loc.lat ? ' | 📍 GPS logged' : ''}`
        });
        fetchAttendance();
        fetchMySummary();
        if (['manager', 'admin', 'super_admin'].includes(user?.role || '')) {
          fetchTeamAttendance(selectedDate);
        }
      } else {
        toast.error(data.error || 'Check-in failed');
      }
    } catch (e) {
      toast.error('Network error checking in');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCheckOut = async () => {
    setIsSubmitting(true);
    try {
      const loc = await acquireLocation();
      if (!loc.lat || !loc.lng) {
        toast.warning('Location not captured', {
          description: 'Check-out will proceed without GPS coordinates.'
        });
      }
      const res = await authFetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check-out', checkOutLocation: loc }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Check-out successful!', {
          description: `Have a great rest of your day!${loc.lat ? ' | 📍 GPS logged' : ''}`
        });
        fetchAttendance();
        fetchMySummary();
        if (['manager', 'admin', 'super_admin'].includes(user?.role || '')) {
          fetchTeamAttendance(selectedDate);
        }
      } else {
        toast.error(data.error || 'Check-out failed');
      }
    } catch (e) {
      toast.error('Network error checking out');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestFullDay = async (date: string) => {
    try {
      const res = await authFetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request-full-day', date }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Request submitted!');
        fetchAttendance();
      } else {
        toast.error(data.error || 'Request failed');
      }
    } catch (e) {
      toast.error('Network error submitting request');
    }
  };

  const handleApproveFullDay = async (attendanceId: string, action: 'approve' | 'reject') => {
    try {
      const res = await authFetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proxyAction: 'approve-full-day', attendanceId, action }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Request ${action}d successfully`);
        fetchTeamAttendance(selectedDate);
        fetchFullDayRequests();
      } else {
        toast.error(data.error || `Failed to ${action} request`);
      }
    } catch (e) {
      toast.error(`Network error attempting to ${action} request`);
    }
  };

  const formatTime = (iso?: string) => {
    if (!iso) return '--:--';
    return new Date(iso).toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit' });
  };

  // ─── History month filter + pagination (history is already newest-first) ───
  const monthOptions = Array.from(new Set(history.map((r) => r.date.slice(0, 7)))).sort().reverse();
  const filteredHistory = historyMonth ? history.filter((r) => r.date.startsWith(historyMonth)) : history;
  const historyTotalPages = Math.max(1, Math.ceil(filteredHistory.length / HISTORY_PAGE_SIZE));
  const safeHistoryPage = Math.min(historyPage, historyTotalPages - 1);
  const pagedHistory = filteredHistory.slice(safeHistoryPage * HISTORY_PAGE_SIZE, (safeHistoryPage + 1) * HISTORY_PAGE_SIZE);

  // ─── Team roster pagination ───
  const rosterTotalPages = Math.max(1, Math.ceil(teamLogs.length / ROSTER_PAGE_SIZE));
  const safeRosterPage = Math.min(rosterPage, rosterTotalPages - 1);
  const pagedTeamLogs = teamLogs.slice(safeRosterPage * ROSTER_PAGE_SIZE, (safeRosterPage + 1) * ROSTER_PAGE_SIZE);

  // ─── Monthly performance stats (current + past months) ───
  const statMonthKeys = Object.keys(myMonthlyStats).sort().reverse();
  const statMonthStats = statMonth && myMonthlyStats[statMonth] ? myMonthlyStats[statMonth] : null;

  if (loading) return <AttendanceShimmer />;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-indigo-500/10 via-purple-500/5 to-indigo-500/10 dark:from-indigo-950 dark:via-slate-900 dark:to-purple-950 p-6 rounded-xl border border-border shadow-md">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Clock className="h-6 w-6 text-indigo-400" /> Employee Attendance Portal
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track daily check-ins, GPS locations, and attendance history
          </p>
        </div>
        <div className="flex items-center gap-4 bg-background/40 backdrop-blur px-4 py-2 rounded-lg border border-white/10">
          {user?.role === 'super_admin' && (
            <div className="text-right pr-4 border-r border-white/10">
              <Button size="sm" variant="outline" className="text-white border-white/20 hover:bg-white/10 h-8 mt-1" onClick={() => {
                import('@/lib/export').then(({ exportToExcel }) => exportToExcel(employeeSummaries, 'attendance_data'));
              }}>
                <Download className="mr-1.5 h-4 w-4" />
                Export
              </Button>
            </div>
          )}
          <div className="text-right pr-4 border-r border-white/10">
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Shift Duration</p>
            <p className="text-xl font-extrabold text-emerald-400 font-mono">{elapsedTime}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Current Time</p>
            <p className="text-xl font-extrabold text-indigo-400 font-mono">{time || '00:00:00 AM'}</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="my-attendance" className="w-full">
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6">
          <TabsList className="bg-secondary/40 border border-border h-auto p-1 flex-wrap w-full md:w-auto justify-start">
            <TabsTrigger value="my-attendance" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">My Attendance</TabsTrigger>
            {['manager', 'admin', 'super_admin'].includes(user?.role || '') && (
              <TabsTrigger value="team-roster" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Team Roster</TabsTrigger>
            )}
            {user?.role === 'super_admin' && (
              <TabsTrigger value="full-day-requests" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground" onClick={fetchFullDayRequests}>
                Full Day Requests
                {fullDayRequests.filter(r => r.fullDayRequestStatus === 'Pending').length > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center h-4 w-4 rounded-full bg-indigo-500 text-white text-[10px] font-bold">{fullDayRequests.filter(r => r.fullDayRequestStatus === 'Pending').length}</span>
                )}
              </TabsTrigger>
            )}
            {user?.role === 'super_admin' && (
              <TabsTrigger value="lop-overrides" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground" onClick={fetchLopOverrides}>
                LOP Overrides
                {lopOverrides.length > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center h-4 w-4 rounded-full bg-indigo-500 text-white text-[10px] font-bold">{lopOverrides.length}</span>
                )}
              </TabsTrigger>
            )}
            {user?.role === 'super_admin' && (
              <TabsTrigger value="employee-summaries" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground" onClick={fetchSummaries}>Employee Summaries</TabsTrigger>
            )}
          </TabsList>
        </div>

        <TabsContent value="my-attendance" className="mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Check-In / Check-Out Action Widget */}
        <Card className="lg:col-span-1 border-border shadow-lg bg-card">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center justify-between">
              Daily Check-In
              {todayRecord?.checkOut ? (
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                  <CheckCircle className="h-3 w-3 mr-1" /> Shift Completed
                </Badge>
              ) : todayRecord?.checkIn ? (
                <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30">
                  <Clock className="h-3 w-3 mr-1" /> On Duty
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30">
                  <AlertCircle className="h-3 w-3 mr-1" /> Not Checked In
                </Badge>
              )}
            </CardTitle>
            <CardDescription>Record your attendance for today ({new Date().toLocaleDateString('en-GB')})</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-indigo-400" /> Work Location
              </label>
              <Select
                value={workLocation}
                onValueChange={(val: any) => setWorkLocation(val)}
                disabled={Boolean(todayRecord?.checkIn)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Office">Office Studio</SelectItem>
                  <SelectItem value="Remote">Remote / Work from Home</SelectItem>
                  <SelectItem value="On-site Shoot">On-site Shoot Location</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* GPS Location Status */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                <Navigation className="h-3.5 w-3.5 text-indigo-400" /> GPS Location
              </label>
              <div className="flex items-center gap-2">
                <LocationStatusBadge status={locationStatus} />
              </div>
              {capturedLocation?.lat && capturedLocation?.lng && (
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-xs font-mono text-muted-foreground">
                    {capturedLocation.lat.toFixed(5)}, {capturedLocation.lng.toFixed(5)}
                  </p>
                  <a
                    href={mapsUrl(capturedLocation) || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-indigo-400 hover:text-indigo-300 hover:underline flex items-center gap-0.5"
                  >
                    Preview <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
              {locationStatus === 'denied' && (
                <p className="text-[11px] text-amber-500/80">
                  ⚠ Allow location access in browser settings for GPS tracking. Attendance still works without it.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 p-3 bg-secondary/30 rounded-lg border border-border">
              <div>
                <span className="text-[11px] text-muted-foreground uppercase font-medium">Check-In</span>
                <p className="text-sm font-bold text-foreground mt-0.5">{formatTime(todayRecord?.checkIn)}</p>
                {todayRecord?.checkInLocation?.lat && (
                  <a
                    href={mapsUrl(todayRecord.checkInLocation) || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-indigo-400 hover:underline flex items-center gap-0.5 mt-0.5"
                  >
                    <MapPin className="h-2.5 w-2.5" /> View location
                  </a>
                )}
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground uppercase font-medium">Check-Out</span>
                <p className="text-sm font-bold text-foreground mt-0.5">{formatTime(todayRecord?.checkOut)}</p>
                {todayRecord?.checkOutLocation?.lat && (
                  <a
                    href={mapsUrl(todayRecord.checkOutLocation) || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-indigo-400 hover:underline flex items-center gap-0.5 mt-0.5"
                  >
                    <MapPin className="h-2.5 w-2.5" /> View location
                  </a>
                )}
              </div>
            </div>

            {!todayRecord?.checkIn ? (
              <Button
                onClick={handleCheckIn}
                disabled={isSubmitting}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-md font-semibold h-11"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <LogIn className="h-4 w-4 mr-2" />}
                {isSubmitting ? 'Locating & Punching…' : 'Punch Check-In'}
              </Button>
            ) : !todayRecord?.checkOut ? (
              <Button
                onClick={handleCheckOut}
                disabled={isSubmitting}
                variant="destructive"
                className="w-full shadow-md font-semibold h-11"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <LogOut className="h-4 w-4 mr-2" />}
                {isSubmitting ? 'Locating & Punching…' : 'Punch Check-Out'}
              </Button>
            ) : (
              <div className="text-center p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
                You have completed your shift check-out for today.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Monthly Attendance Performance */}
        <Card className="lg:col-span-1 border-border shadow-lg bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-indigo-400" /> Monthly Performance
              </span>
              {statMonthStats && (
                <Badge variant="outline" className={percentageBadgeClass(statMonthStats.attendancePercentage || 0)}>
                  {statMonthStats.attendancePercentage || 0}%
                </Badge>
              )}
            </CardTitle>
            <CardDescription>Attendance score with a full status breakdown</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {statMonthKeys.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No attendance records yet. Your monthly stats will appear here.
              </p>
            ) : (
              <>
                <Select value={statMonth} onValueChange={setStatMonth}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select month" />
                  </SelectTrigger>
                  <SelectContent>
                    {statMonthKeys.map((m) => (
                      <SelectItem key={m} value={m}>{monthLabel(m)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {statMonthStats && (
                  <>
                    <div className="flex items-end justify-between p-3 rounded-lg bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20">
                      <span className="text-3xl font-extrabold text-indigo-300">{statMonthStats.attendancePercentage || 0}%</span>
                      <span className="text-right text-[11px] text-muted-foreground leading-tight">
                        of {(statMonthStats.effectiveWorkingDays ?? statMonthStats.totalWorkingDays) || 0} working days<br />
                        <span className="text-[10px]">(weekly offs excluded · current month counts days so far)</span>
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex items-center justify-between rounded-md border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-2 text-xs font-medium text-emerald-400">
                        <span>Present</span><span className="font-bold">{statMonthStats.Present || 0}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-md border border-amber-500/20 bg-amber-500/5 px-2.5 py-2 text-xs font-medium text-amber-400">
                        <span>Late</span><span className="font-bold">{statMonthStats.Late || 0}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-md border border-blue-500/20 bg-blue-500/5 px-2.5 py-2 text-xs font-medium text-blue-400">
                        <span>Half-day</span><span className="font-bold">{statMonthStats['Half-day'] || 0}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-md border border-cyan-500/20 bg-cyan-500/5 px-2.5 py-2 text-xs font-medium text-cyan-400">
                        <span>Leave</span><span className="font-bold">{statMonthStats.Leave || 0}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-md border border-rose-500/20 bg-rose-500/5 px-2.5 py-2 text-xs font-medium text-rose-400">
                        <span>LOP</span><span className="font-bold">{statMonthStats.LOP || 0}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-md border border-red-500/20 bg-red-500/5 px-2.5 py-2 text-xs font-medium text-red-400">
                        <span>Absent</span><span className="font-bold">{statMonthStats.Absent || 0}</span>
                      </div>
                      <div className="col-span-2 flex items-center justify-between rounded-md border border-slate-500/20 bg-slate-500/5 px-2.5 py-2 text-xs font-medium text-slate-400">
                        <span>Weekly Offs</span><span className="font-bold">{statMonthStats['Weekly Off'] || 0}</span>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Attendance Summary & Log Table */}
        <Card className="lg:col-span-2 border-border shadow-lg bg-card">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 space-y-0">
            <div>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Calendar className="h-5 w-5 text-indigo-400" /> My Attendance History
              </CardTitle>
              <CardDescription>Your personal check-in logs and status history</CardDescription>
            </div>
            <Select value={historyMonth || 'all'} onValueChange={(v) => { setHistoryMonth(v === 'all' ? '' : v); setHistoryPage(0); }}>
              <SelectTrigger className="w-full sm:w-[160px] h-9">
                <SelectValue placeholder="All Months" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Months</SelectItem>
                {monthOptions.map((m) => (
                  <SelectItem key={m} value={m}>{monthLabel(m)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-border overflow-hidden">
              <Table>
                <TableHeader className="bg-secondary/40">
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Check-In</TableHead>
                    <TableHead>Check-Out</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>GPS</TableHead>
                    {user?.role !== 'super_admin' && <TableHead>Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredHistory.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-6 text-muted-foreground text-sm">
                        {historyMonth ? `No records found for ${monthLabel(historyMonth)}.` : 'No attendance records found yet.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    pagedHistory.map((record) => (
                      <TableRow key={record._id || record.date}>
                        <TableCell className="font-medium text-sm">{record.date}</TableCell>
                        <TableCell className="text-sm font-mono">{formatTime(record.checkIn)}</TableCell>
                        <TableCell className="text-sm font-mono">{formatTime(record.checkOut)}</TableCell>
                        <TableCell className="text-sm">{record.workLocation}</TableCell>
                        <TableCell>
                          <Badge className={statusBadgeClass(record.status)}>
                            {record.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {record.checkInLocation?.lat ? (
                            <a
                              href={mapsUrl(record.checkInLocation) || '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 hover:underline"
                            >
                              <MapPin className="h-3 w-3" /> In
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                          {record.checkOutLocation?.lat && (
                            <>
                              {' · '}
                              <a
                                href={mapsUrl(record.checkOutLocation) || '#'}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 hover:underline"
                              >
                                <MapPin className="h-3 w-3" /> Out
                              </a>
                            </>
                          )}
                        </TableCell>
                        {user?.role !== 'super_admin' && <TableCell>
                          {(record.status === 'Half-day' || record.status === 'Half Day') && record.checkOut && (
                            <>
                              {(!record.fullDayRequest || record.fullDayRequestStatus === 'None') && (
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="h-7 text-xs border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10"
                                  onClick={() => handleRequestFullDay(record.date)}
                                >
                                  Request Full Day
                                </Button>
                              )}
                              {record.fullDayRequestStatus === 'Pending' && (
                                <span className="text-xs text-amber-400">⏳ Request Pending</span>
                              )}
                              {record.fullDayRequestStatus === 'Rejected' && (
                                <span className="text-xs text-red-400">✕ Request Rejected</span>
                              )}
                            </>
                          )}
                          {record.fullDayRequestStatus === 'Approved' && (
                            <span className="text-xs text-emerald-400">✓ Full Day Approved</span>
                          )}
                          {(record.status === 'LOP' || record.lopApplied) && (
                            <Button variant="outline" size="sm" className="h-7 text-xs ml-1" onClick={() => setLopTarget(record)}>Request LOP → Present</Button>
                          )}
                        </TableCell>}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <PaginationBar
              page={safeHistoryPage}
              totalPages={historyTotalPages}
              totalItems={filteredHistory.length}
              pageSize={HISTORY_PAGE_SIZE}
              onPageChange={setHistoryPage}
            />
          </CardContent>
        </Card>
          </div>
          {user?.role !== 'super_admin' && <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
            <Card>
              <CardHeader><CardTitle className="text-lg">Leave Balance</CardTitle><CardDescription>Financial year {leaveBalance?.financialYear || '—'}</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-lg bg-indigo-500/10 p-3 text-sm">Paid Leave <strong className="float-right">{leaveBalance ? `${leaveBalance.remainingPL} / ${leaveBalance.totalPL}` : '—'}</strong><p className="text-xs text-muted-foreground mt-1">{leaveBalance?.usedPL || 0} used</p></div>
                <div className="rounded-lg bg-emerald-500/10 p-3 text-sm">Sick Leave <strong className="float-right">{leaveBalance ? `${leaveBalance.remainingSL} / ${leaveBalance.totalSL}` : '—'}</strong><p className="text-xs text-muted-foreground mt-1">{leaveBalance?.usedSL || 0} used</p></div>
                <p className="text-xs text-muted-foreground">Weekly off: {weeklyOff.used ? `used on ${weeklyOff.date}` : 'not yet assigned this week'}.</p>
              </CardContent>
            </Card>
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle className="text-lg">Apply for Leave</CardTitle><CardDescription>Balance is deducted only after manager approval.</CardDescription></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Select value={leaveType} onValueChange={(value: 'Paid' | 'Sick') => setLeaveType(value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Paid">Paid Leave</SelectItem><SelectItem value="Sick">Sick Leave</SelectItem></SelectContent></Select>
                <div className="grid grid-cols-2 gap-2"><input className="border rounded-md px-3 bg-background" type="date" value={leaveStart} onChange={e => setLeaveStart(e.target.value)} /><input className="border rounded-md px-3 bg-background" type="date" value={leaveEnd} onChange={e => setLeaveEnd(e.target.value)} /></div>
                <textarea className="border rounded-md p-3 bg-background min-h-[80px] md:col-span-2" placeholder="Reason for leave" value={leaveReason} onChange={e => setLeaveReason(e.target.value)} />
                {leaveType === 'Sick' && <div className="md:col-span-2"><label className="text-sm font-medium">Medical certificate (PDF, JPG, PNG; max 5MB)</label><input className="block mt-1 text-sm" type="file" accept=".pdf,image/jpeg,image/png" onChange={e => setCertificate(e.target.files?.[0] || null)} /></div>}
                <Button onClick={submitLeave} className="md:col-span-2">Submit Leave Request</Button>
              </CardContent>
            </Card>
          </div>
          <Card className="mt-6">
            <CardHeader><CardTitle className="text-lg">Leave History</CardTitle></CardHeader>
            <CardContent><Table><TableHeader><TableRow><TableHead>Dates</TableHead><TableHead>Type</TableHead><TableHead>Days</TableHead><TableHead>Reason</TableHead><TableHead>Status</TableHead><TableHead>Certificate</TableHead></TableRow></TableHeader><TableBody>{leaves.length ? leaves.map(leave => <TableRow key={leave._id}><TableCell>{leave.startDate} – {leave.endDate}</TableCell><TableCell>{leave.leaveType}</TableCell><TableCell>{leave.totalDays}</TableCell><TableCell>{leave.reason}</TableCell><TableCell><Badge>{leave.status}</Badge></TableCell><TableCell>{leave.certificateFileName ? <a className="text-indigo-400 hover:underline" href={`/api/attendance?action=leave-certificate&leaveId=${leave._id}`} target="_blank">View</a> : '—'}</TableCell></TableRow>) : <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No leave applications yet.</TableCell></TableRow>}</TableBody></Table></CardContent>
          </Card>
          </>}
        </TabsContent>

        <TabsContent value="full-day-requests" className="mt-0">
          {user?.role === 'super_admin' && (
            <Card className="border-border shadow-lg bg-card">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-indigo-400" /> Full Day Requests
                </CardTitle>
                <CardDescription>Employees who checked out early (Half-day) and have requested their shift be counted as a full day.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader className="bg-secondary/40">
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Check-In</TableHead>
                      <TableHead>Check-Out</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fullDayRequests.length ? fullDayRequests.map(record => (
                      <TableRow key={record._id}>
                        <TableCell className="font-medium">{record.employeeName}</TableCell>
                        <TableCell>{record.date}</TableCell>
                        <TableCell className="font-mono text-sm">{formatTime(record.checkIn)}</TableCell>
                        <TableCell className="font-mono text-sm">{formatTime(record.checkOut)}</TableCell>
                        <TableCell className="text-sm">{record.workLocation}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                              onClick={() => handleApproveFullDay(record._id!, 'approve')}
                            >
                              Approve Full Day
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-7 text-xs"
                              onClick={() => handleApproveFullDay(record._id!, 'reject')}
                            >
                              Reject
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                          No pending full-day requests.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="lop-overrides" className="mt-0">
          {user?.role === 'super_admin' && (
            <Card className="border-border shadow-lg bg-card">
              <CardHeader><CardTitle className="text-lg">LOP → Present Override Requests</CardTitle><CardDescription>Requests appear here after an employee submits an explanation for an LOP day.</CardDescription></CardHeader>
              <CardContent><Table><TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Date</TableHead><TableHead>Explanation</TableHead><TableHead>Action</TableHead></TableRow></TableHeader><TableBody>{lopOverrides.length ? lopOverrides.map(record => <TableRow key={record._id}><TableCell>{record.employeeName}</TableCell><TableCell>{record.date}</TableCell><TableCell>{record.lopOverrideRequest?.note}</TableCell><TableCell className="flex gap-2"><Button size="sm" onClick={() => reviewLopOverride(record._id!, 'Approved')}>Approve as Present</Button><Button size="sm" variant="destructive" onClick={() => reviewLopOverride(record._id!, 'Rejected')}>Reject</Button></TableCell></TableRow>) : <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">No pending LOP override requests. LOP is generated after the employee&apos;s second missed day in a completed week.</TableCell></TableRow>}</TableBody></Table></CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="team-roster" className="mt-0">
          {['manager', 'admin', 'super_admin'].includes(user?.role || '') && (
        <>
        <Card className="border-border shadow-lg bg-card mt-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-indigo-400" /> Team Attendance Roster
              </CardTitle>
              <CardDescription>Check-in status and GPS locations for all team members</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-background border border-border rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-border overflow-x-auto">
              <Table>
                <TableHeader className="bg-secondary/40">
                  <TableRow>
                    <TableHead>Employee Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Check-In</TableHead>
                    <TableHead>Check-Out</TableHead>
                    <TableHead>Work Location</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Leave Balance</TableHead>
                    <TableHead className="text-indigo-400">
                      <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> Check-In GPS</span>
                    </TableHead>
                    <TableHead className="text-purple-400">
                      <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> Check-Out GPS</span>
                    </TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-6 text-muted-foreground text-sm">
                        No team attendance logged for {selectedDate}.
                      </TableCell>
                    </TableRow>
                  ) : (
                    pagedTeamLogs.map((log) => (
                      <TableRow key={log._id || log.employeeEmail}>
                        <TableCell className="font-medium text-sm">{log.employeeName}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{log.employeeEmail}</TableCell>
                        <TableCell className="text-sm font-mono">{formatTime(log.checkIn)}</TableCell>
                        <TableCell className="text-sm font-mono">{formatTime(log.checkOut)}</TableCell>
                        <TableCell className="text-sm">{log.workLocation}</TableCell>
                        <TableCell>
                          <Badge className={statusBadgeClass(log.status)}>
                            {log.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{log.leaveBalance ? `PL: ${log.leaveBalance.remainingPL}/${log.leaveBalance.totalPL} | SL: ${log.leaveBalance.remainingSL}/${log.leaveBalance.totalSL}` : '—'}</TableCell>
                        {user?.role !== 'super_admin' && <TableCell>
                          <LocationCell loc={log.checkInLocation} />
                        </TableCell>}
                        <TableCell>
                          <LocationCell loc={log.checkOutLocation} />
                        </TableCell>
                        <TableCell>
                          {log.fullDayRequest && log.fullDayRequestStatus === 'Pending' ? (
                            <div className="flex gap-2">
                              <Button 
                                size="sm" 
                                className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                                onClick={() => handleApproveFullDay(log._id!, 'approve')}
                              >
                                Approve
                              </Button>
                              <Button 
                                size="sm" 
                                variant="destructive"
                                className="h-7 text-xs"
                                onClick={() => handleApproveFullDay(log._id!, 'reject')}
                              >
                                Reject
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <PaginationBar
              page={safeRosterPage}
              totalPages={rosterTotalPages}
              totalItems={teamLogs.length}
              pageSize={ROSTER_PAGE_SIZE}
              onPageChange={setRosterPage}
            />
          </CardContent>
        </Card>
        <Card className="border-border shadow-lg bg-card mt-6">
          <CardHeader><CardTitle className="text-lg">Pending Leave Approvals</CardTitle><CardDescription>Approve requests after reviewing certificates and available balance.</CardDescription></CardHeader>
          <CardContent><Table><TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Dates</TableHead><TableHead>Type</TableHead><TableHead>Reason</TableHead><TableHead>Certificate</TableHead><TableHead>Action</TableHead></TableRow></TableHeader><TableBody>{teamLeaves.length ? teamLeaves.map((leave: any) => <TableRow key={leave._id}><TableCell>{leave.employeeName || leave.employeeEmail}</TableCell><TableCell>{leave.startDate} – {leave.endDate}</TableCell><TableCell>{leave.leaveType} ({leave.totalDays})</TableCell><TableCell>{leave.reason}</TableCell><TableCell>{leave.certificateFileName ? <a className="text-indigo-400 hover:underline" target="_blank" href={`/api/attendance?action=leave-certificate&leaveId=${leave._id}`}>View</a> : '—'}</TableCell><TableCell className="flex gap-2"><Button size="sm" onClick={() => reviewLeave(leave._id, 'Approved')}>Approve</Button><Button size="sm" variant="destructive" onClick={() => reviewLeave(leave._id, 'Rejected')}>Reject</Button></TableCell></TableRow>) : <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No pending leave requests.</TableCell></TableRow>}</TableBody></Table></CardContent>
        </Card>
        {user?.role === 'super_admin' && <Card className="border-border shadow-lg bg-card mt-6"><CardHeader><CardTitle className="text-lg">LOP Override Queue</CardTitle></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Date</TableHead><TableHead>Explanation</TableHead><TableHead>Action</TableHead></TableRow></TableHeader><TableBody>{lopOverrides.length ? lopOverrides.map(record => <TableRow key={record._id}><TableCell>{record.employeeName}</TableCell><TableCell>{record.date}</TableCell><TableCell>{record.lopOverrideRequest?.note}</TableCell><TableCell className="flex gap-2"><Button size="sm" onClick={() => reviewLopOverride(record._id!, 'Approved')}>Approve</Button><Button size="sm" variant="destructive" onClick={() => reviewLopOverride(record._id!, 'Rejected')}>Reject</Button></TableCell></TableRow>) : <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No pending LOP override requests.</TableCell></TableRow>}</TableBody></Table></CardContent></Card>}
        </>
          )}
        </TabsContent>

        <Dialog open={Boolean(lopTarget)} onOpenChange={(open) => !open && setLopTarget(null)}>
          <DialogContent><DialogHeader><DialogTitle>Request LOP conversion</DialogTitle><DialogDescription>Explain why this attendance record should be converted to Present. Only a super admin can approve it.</DialogDescription></DialogHeader><textarea className="border rounded-md p-3 bg-background min-h-[100px]" value={lopNote} onChange={e => setLopNote(e.target.value)} placeholder="Explanation" /><Button onClick={submitLopOverride}>Submit Request</Button></DialogContent>
        </Dialog>

        <TabsContent value="employee-summaries" className="mt-0">
          {user?.role === 'super_admin' && (
            <Card className="border-border shadow-lg bg-card">
              <CardHeader>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Users className="h-5 w-5 text-indigo-400" /> Employee Summaries
                </CardTitle>
                <CardDescription>Attendance percentage and month-by-month detail for the selected date range.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-end gap-3 mb-6">
                  <label className="text-sm">From<input type="date" value={summaryStartDate} onChange={(e) => setSummaryStartDate(e.target.value)} className="block mt-1 bg-background border border-border rounded-md px-3 py-2" /></label>
                  <label className="text-sm">To<input type="date" value={summaryEndDate} onChange={(e) => setSummaryEndDate(e.target.value)} className="block mt-1 bg-background border border-border rounded-md px-3 py-2" /></label>
                  <Button onClick={fetchSummaries} disabled={loadingSummaries || !summaryStartDate || !summaryEndDate}>Apply Range</Button>
                </div>
                {loadingSummaries ? (
                  <div className="flex justify-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
                  </div>
                ) : employeeSummaries.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-8">No attendance records found.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {employeeSummaries.map((summary) => (
                      <Dialog key={summary.email}>
                        <DialogTrigger asChild>
                          <Button variant="outline" className="h-auto py-4 flex flex-col items-start gap-1 justify-start border-border bg-secondary/20 hover:bg-secondary/50">
                            <span className="font-semibold">{summary.name}</span>
                            <span className="text-xs text-muted-foreground font-normal">{summary.email}</span>
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>{summary.name}&apos;s Attendance</DialogTitle>
                            <DialogDescription>{summary.email}</DialogDescription>
                          </DialogHeader>
                          <div className="mt-4">
                            {Object.keys(summary.months).length === 0 ? (
                              <p className="text-muted-foreground text-sm">No monthly records found.</p>
                            ) : (
                              <Accordion type="single" collapsible className="w-full">
                                {Object.entries(summary.months).reverse().map(([month, stats]: [string, any]) => (
                                  <AccordionItem key={month} value={month}>
                                    <AccordionTrigger className="text-base font-semibold">
                                      <div className="flex items-center justify-between w-full pr-4">
                                        <span>{new Date(month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
                                        <Badge 
                                          variant="outline" 
                                          className={
                                            (stats.attendancePercentage || 0) >= 85 
                                              ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" 
                                              : (stats.attendancePercentage || 0) >= 70 
                                              ? "bg-amber-500/10 text-amber-500 border-amber-500/20" 
                                              : "bg-red-500/10 text-red-500 border-red-500/20"
                                          }
                                        >
                                          {stats.attendancePercentage || 0}% Attendance
                                        </Badge>
                                      </div>
                                    </AccordionTrigger>
                                    <AccordionContent>
                                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-2">
                                        <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-lg text-center">
                                          <p className="text-xs text-emerald-400 uppercase font-semibold">Present</p>
                                          <p className="text-2xl font-bold text-emerald-500 mt-1">{stats.Present || 0}</p>
                                        </div>
                                        <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg text-center">
                                          <p className="text-xs text-amber-400 uppercase font-semibold">Late</p>
                                          <p className="text-2xl font-bold text-amber-500 mt-1">{stats.Late || 0}</p>
                                        </div>
                                        <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-lg text-center">
                                          <p className="text-xs text-blue-400 uppercase font-semibold">Half-day</p>
                                          <p className="text-2xl font-bold text-blue-500 mt-1">{stats['Half-day'] || 0}</p>
                                        </div>
                                        <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-lg text-center">
                                          <p className="text-xs text-red-400 uppercase font-semibold">Absent</p>
                                          <p className="text-2xl font-bold text-red-500 mt-1">{stats.Absent || 0}</p>
                                        </div>
                                        <div className="bg-cyan-500/10 border border-cyan-500/20 p-3 rounded-lg text-center">
                                          <p className="text-xs text-cyan-400 uppercase font-semibold">Leave</p>
                                          <p className="text-2xl font-bold text-cyan-500 mt-1">{stats.Leave || 0}</p>
                                        </div>
                                        <div className="bg-rose-500/10 border border-rose-500/20 p-3 rounded-lg text-center">
                                          <p className="text-xs text-rose-400 uppercase font-semibold">LOP</p>
                                          <p className="text-2xl font-bold text-rose-500 mt-1">{stats.LOP || 0}</p>
                                        </div>
                                        <div className="bg-slate-500/10 border border-slate-500/20 p-3 rounded-lg text-center">
                                          <p className="text-xs text-slate-400 uppercase font-semibold">Weekly Off</p>
                                          <p className="text-2xl font-bold text-slate-400 mt-1">{stats['Weekly Off'] || 0}</p>
                                        </div>
                                      </div>
                                      <p className="text-xs text-muted-foreground pb-2">
                                        Percentage credits Present + Late + ½×Half-day + Leave over effective working days
                                        ({stats.effectiveWorkingDays ?? stats.totalWorkingDays ?? 0} working days, weekly offs excluded; current month counts days so far).
                                      </p>
                                    </AccordionContent>
                                  </AccordionItem>
                                ))}
                              </Accordion>
                            )}
                          </div>
                        </DialogContent>
                      </Dialog>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
