'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Clock, LogIn, LogOut, MapPin, CheckCircle, AlertCircle, Calendar, UserCheck } from 'lucide-react';

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

  const fetchAttendance = useCallback(async () => {
    try {
      const res = await fetch('/api/attendance');
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

  const handleCheckIn = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check-in', workLocation }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Check-in successful!', {
          description: `Status: ${data.attendance.status} | Location: ${data.attendance.workLocation}`
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
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check-out' }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Check-out successful!', {
          description: 'Have a great rest of your day!'
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
            Track daily check-ins, work locations, and attendance history
          </p>
        </div>
        <div className="flex items-center gap-4 bg-background/40 backdrop-blur px-4 py-2 rounded-lg border border-white/10">
          <div className="text-right">
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Current Time</p>
            <p className="text-xl font-extrabold text-indigo-400 font-mono">{time || '00:00:00 AM'}</p>
          </div>
        </div>
      </div>

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

            <div className="grid grid-cols-2 gap-3 p-3 bg-secondary/30 rounded-lg border border-border">
              <div>
                <span className="text-[11px] text-muted-foreground uppercase font-medium">Check-In</span>
                <p className="text-sm font-bold text-foreground mt-0.5">{formatTime(todayRecord?.checkIn)}</p>
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground uppercase font-medium">Check-Out</span>
                <p className="text-sm font-bold text-foreground mt-0.5">{formatTime(todayRecord?.checkOut)}</p>
              </div>
            </div>

            {!todayRecord?.checkIn ? (
              <Button
                onClick={handleCheckIn}
                disabled={isSubmitting}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-md font-semibold h-11"
              >
                <LogIn className="h-4 w-4 mr-2" /> Punch Check-In
              </Button>
            ) : !todayRecord?.checkOut ? (
              <Button
                onClick={handleCheckOut}
                disabled={isSubmitting}
                variant="destructive"
                className="w-full shadow-md font-semibold h-11"
              >
                <LogOut className="h-4 w-4 mr-2" /> Punch Check-Out
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-6 text-muted-foreground text-sm">
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
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Manager Team View */}
      {['manager', 'admin'].includes(user?.role || '') && (
        <Card className="border-border shadow-lg bg-card mt-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-indigo-400" /> Team Attendance Roster
              </CardTitle>
              <CardDescription>View check-in status for all team members</CardDescription>
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
            <div className="rounded-md border border-border overflow-hidden">
              <Table>
                <TableHeader className="bg-secondary/40">
                  <TableRow>
                    <TableHead>Employee Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Check-In</TableHead>
                    <TableHead>Check-Out</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-6 text-muted-foreground text-sm">
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
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
