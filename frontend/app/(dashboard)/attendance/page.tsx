'use client';

import { authFetch } from '@/lib/auth-fetch';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
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
  UserCheck, Navigation, NavigationOff, ExternalLink, Loader2, Users
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
  status: 'Present' | 'Late' | 'Half-day' | 'Absent';
  workLocation: 'Office' | 'Remote' | 'On-site Shoot';
  notes?: string;
  checkInLocation?: LocationCoords;
  checkOutLocation?: LocationCoords;
  fullDayRequest?: boolean;
  fullDayRequestStatus?: 'None' | 'Pending' | 'Approved' | 'Rejected';
}

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

export default function AttendancePage() {
  const { user } = useAuth();
  const [time, setTime] = useState<string>('');
  const [workLocation, setWorkLocation] = useState<'Office' | 'Remote' | 'On-site Shoot'>('Office');
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [teamLogs, setTeamLogs] = useState<AttendanceRecord[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'acquiring' | 'captured' | 'denied'>('idle');
  const [capturedLocation, setCapturedLocation] = useState<LocationCoords | null>(null);
  
  const [employeeSummaries, setEmployeeSummaries] = useState<any[]>([]);
  const [loadingSummaries, setLoadingSummaries] = useState(false);

  const fetchSummaries = useCallback(async () => {
    setLoadingSummaries(true);
    try {
      const res = await authFetch('/api/attendance?action=summary');
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
  }, []);

  useEffect(() => {
    if (user?.role === 'manager') {
      fetchSummaries();
    }
  }, [user, fetchSummaries]);

  // Live Digital Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

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
    if (!['manager', 'admin'].includes(user?.role || '')) return;
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
    fetchAttendance();
    if (['manager', 'admin'].includes(user?.role || '')) {
      fetchTeamAttendance(selectedDate);
    }
  }, [fetchAttendance, fetchTeamAttendance, selectedDate, user]);

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
        if (['manager', 'admin'].includes(user?.role || '')) {
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
        if (['manager', 'admin'].includes(user?.role || '')) {
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

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-indigo-950 via-slate-900 to-purple-950 p-6 rounded-xl border border-indigo-900/50 shadow-xl">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Clock className="h-6 w-6 text-indigo-400" /> Employee Attendance Portal
          </h1>
          <p className="text-sm text-slate-300 mt-1">
            Track daily check-ins, GPS locations, and attendance history
          </p>
        </div>
        <div className="flex items-center gap-4 bg-background/40 backdrop-blur px-4 py-2 rounded-lg border border-white/10">
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
            {['manager', 'admin'].includes(user?.role || '') && (
              <TabsTrigger value="team-roster" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Team Roster</TabsTrigger>
            )}
            {user?.role === 'manager' && (
              <TabsTrigger value="employee-summaries" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground" onClick={fetchSummaries}>Employee Summaries</TabsTrigger>
            )}
          </TabsList>
        </div>

        <TabsContent value="my-attendance" className="mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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

        {/* Attendance Summary & Log Table */}
        <Card className="lg:col-span-2 border-border shadow-lg bg-card">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Calendar className="h-5 w-5 text-indigo-400" /> My Attendance History
            </CardTitle>
            <CardDescription>Your personal check-in logs and status history</CardDescription>
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
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-6 text-muted-foreground text-sm">
                        No attendance records found yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    history.map((record) => (
                      <TableRow key={record._id || record.date}>
                        <TableCell className="font-medium text-sm">{record.date}</TableCell>
                        <TableCell className="text-sm font-mono">{formatTime(record.checkIn)}</TableCell>
                        <TableCell className="text-sm font-mono">{formatTime(record.checkOut)}</TableCell>
                        <TableCell className="text-sm">{record.workLocation}</TableCell>
                        <TableCell>
                          <Badge
                            className={
                              record.status === 'Present'
                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                : record.status === 'Late'
                                ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                                : 'bg-red-500/15 text-red-400 border-red-500/30'
                            }
                          >
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
                        <TableCell>
                          {record.status === 'Half-day' && record.checkOut && (
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
                                <span className="text-xs text-amber-400">Request Pending</span>
                              )}
                              {record.fullDayRequestStatus === 'Rejected' && (
                                <span className="text-xs text-red-400">Request Rejected</span>
                              )}
                            </>
                          )}
                          {record.fullDayRequestStatus === 'Approved' && (
                            <span className="text-xs text-emerald-400">Full Day Approved</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
          </div>
        </TabsContent>

        <TabsContent value="team-roster" className="mt-0">
          {['manager', 'admin'].includes(user?.role || '') && (
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
                    teamLogs.map((log) => (
                      <TableRow key={log._id || log.employeeEmail}>
                        <TableCell className="font-medium text-sm">{log.employeeName}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{log.employeeEmail}</TableCell>
                        <TableCell className="text-sm font-mono">{formatTime(log.checkIn)}</TableCell>
                        <TableCell className="text-sm font-mono">{formatTime(log.checkOut)}</TableCell>
                        <TableCell className="text-sm">{log.workLocation}</TableCell>
                        <TableCell>
                          <Badge
                            className={
                              log.status === 'Present'
                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                : log.status === 'Late'
                                ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                                : 'bg-red-500/15 text-red-400 border-red-500/30'
                            }
                          >
                            {log.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <LocationCell loc={log.checkInLocation} />
                        </TableCell>
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
          </CardContent>
        </Card>
          )}
        </TabsContent>

        <TabsContent value="employee-summaries" className="mt-0">
          {user?.role === 'manager' && (
            <Card className="border-border shadow-lg bg-card">
              <CardHeader>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Users className="h-5 w-5 text-indigo-400" /> Employee Summaries
                </CardTitle>
                <CardDescription>Click on an employee to view their month-by-month attendance record.</CardDescription>
              </CardHeader>
              <CardContent>
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
                            <DialogTitle>{summary.name}'s Attendance</DialogTitle>
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
                                      </div>
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
