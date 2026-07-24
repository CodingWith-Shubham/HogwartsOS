'use client';

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { Loader2, Edit, UserPlus, Info, Eye, EyeOff } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { toast } from 'sonner';

const USER_ROLES = ['manager', 'sales', 'editor', 'shoot', 'admin'];

const REDIRECT_PATHS = [
  { label: 'Manager View (/manager)', value: '/manager' },
  { label: 'Sales Board (/sales)', value: '/sales' },
  { label: 'Editor View (/editor)', value: '/editor' },
  { label: 'Shoot Calendar (/shoot)', value: '/shoot' },
];

export default function SettingsPage() {
  const { user } = useAuth();

  // User Management List States
  const [employees, setEmployees] = useState<any[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);

  // Employee Form Sheet States
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<any | null>(null); // Null means adding
  const [empName, setEmpName] = useState('');
  const [empEmail, setEmpEmail] = useState('');
  const [empPhone, setEmpPhone] = useState('');
  const [empDesignation, setEmpDesignation] = useState('');
  const [empRole, setEmpRole] = useState('sales');
  const [empUsername, setEmpUsername] = useState('');
  const [empRedirect, setEmpRedirect] = useState('/sales');
  const [empPassword, setEmpPassword] = useState('');
  const [empSubmitting, setEmpSubmitting] = useState(false);

  const isManager = user?.role === 'manager' || user?.role === 'admin';

  // Load Employee List for Managers
  const fetchEmployees = useCallback(async () => {
    if (!isManager) return;
    setEmployeesLoading(true);
    try {
      const res = await fetch('/api/users', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setEmployees(data.users ?? []);
      }
    } catch (err) {
      console.error('Failed to load employee list:', err);
    } finally {
      setEmployeesLoading(false);
    }
  }, [isManager]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  if (!user) {
    return null;
  }

  // Open Sheet to Add New Employee
  const handleAddEmployee = () => {
    setEditingEmployee(null);
    setEmpName('');
    setEmpEmail('');
    setEmpPhone('');
    setEmpDesignation('');
    setEmpRole('sales');
    setEmpUsername('');
    setEmpRedirect('/sales');
    setEmpPassword('');
    setSheetOpen(true);
  };

  // Open Sheet to Edit Existing Employee
  const handleEditEmployee = (emp: any) => {
    setEditingEmployee(emp);
    setEmpName(emp.name || '');
    setEmpEmail(emp.email || '');
    setEmpPhone(emp.phone || '');
    setEmpDesignation(emp.designation || '');
    setEmpRole(emp.role || 'sales');
    setEmpUsername(emp.username || '');
    setEmpRedirect(emp.redirectTo || '/sales');
    setEmpPassword(''); // Clear password (optional on edit)
    setSheetOpen(true);
  };

  // Handle Employee Form Submissions
  const handleEmployeeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmpSubmitting(true);
    try {
      const url = '/api/users';
      const method = editingEmployee ? 'PUT' : 'POST';
      const payload: any = {
        name: empName,
        email: empEmail,
        phone: empPhone,
        designation: empDesignation,
        role: empRole,
        username: empUsername,
        redirectTo: empRedirect,
        password: empPassword || undefined,
      };

      if (editingEmployee) {
        payload.id = editingEmployee.id;
      } else if (!empPassword) {
        throw new Error('Password is required for new employees');
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to save employee profile');
      }

      toast.success(editingEmployee ? 'Employee Updated' : 'Employee Created', {
        description: editingEmployee ? 'Employee details saved in Google Sheets' : 'New employee profile added to Google Sheets',
      });

      setSheetOpen(false);
      await fetchEmployees();
      
      // If manager updated their own credentials from the manager list, reload
      if (editingEmployee && editingEmployee.id === user.id) {
        window.location.reload();
      }
    } catch (err) {
      toast.error('Operation failed', {
        description: err instanceof Error ? err.message : 'Unknown error occurred',
      });
    } finally {
      setEmpSubmitting(false);
    }
  };

  // User Management Table Columns
  const employeeColumns: Column<any>[] = [
    {
      key: 'name',
      header: 'Employee Name',
      sortable: true,
      sortValue: (emp) => emp.name,
      cell: (emp) => (
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-secondary text-xs">
              {emp.initials || (emp.name ? emp.name[0] : 'E')}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold text-sm">{emp.name}</p>
            <p className="text-xs text-muted-foreground">{emp.designation || 'Staff'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'username',
      header: 'Username',
      cell: (emp) => <span className="text-xs font-mono">{emp.username}</span>,
    },
    {
      key: 'email',
      header: 'Email / Phone',
      cell: (emp) => (
        <div>
          <p className="text-xs">{emp.email}</p>
          {emp.phone && <p className="text-[11px] text-muted-foreground">{emp.phone}</p>}
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      cell: (emp) => (
        <span className="inline-block text-[11px] uppercase tracking-wider bg-secondary/80 border border-border px-2 py-0.5 rounded-full font-medium">
          {emp.role}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      cell: (emp) => (
        <Button variant="ghost" size="icon" onClick={() => handleEditEmployee(emp)}>
          <Edit className="h-4 w-4 text-muted-foreground hover:text-foreground" />
        </Button>
      ),
    },
  ];

  const ProfileDetailsCard = () => (
    <Card className="border border-border/80 bg-card/40 backdrop-blur-md shadow-lg">
      <CardHeader className="text-center">
        <CardTitle className="text-lg">Profile Details</CardTitle>
        <CardDescription>View your current credentials and designations.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 text-sm">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16 border border-border shadow-sm">
            <AvatarFallback className="bg-secondary text-foreground text-xl font-semibold">
              {user?.initials || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <p className="font-bold text-lg text-foreground">{user?.name || 'User'}</p>
            <p className="text-sm text-muted-foreground">{user?.designation || 'Hogwarts Staff'}</p>
            <div className="inline-block text-[11px] font-semibold uppercase tracking-wider bg-secondary border border-border text-foreground rounded-full px-2.5 py-0.5 mt-1 capitalize shadow-sm">
              {user?.role}
            </div>
          </div>
        </div>

        <Separator className="my-4" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="space-y-1 bg-secondary/10 p-3 rounded-lg border border-border/40 md:col-span-2">
            <span className="text-xs text-muted-foreground block uppercase font-semibold tracking-wider">Full Name</span>
            <span className="font-semibold text-foreground text-base">{user?.name || '—'}</span>
          </div>

          <div className="space-y-1 bg-secondary/10 p-3 rounded-lg border border-border/40">
            <span className="text-xs text-muted-foreground block uppercase font-semibold tracking-wider">Username</span>
            <span className="font-semibold text-foreground">{user?.username}</span>
          </div>

          <div className="space-y-1 bg-secondary/10 p-3 rounded-lg border border-border/40">
            <span className="text-xs text-muted-foreground block uppercase font-semibold tracking-wider">Email Address</span>
            <span className="font-semibold text-foreground">{user?.email}</span>
          </div>

          <div className="space-y-1 bg-secondary/10 p-3 rounded-lg border border-border/40">
            <span className="text-xs text-muted-foreground block uppercase font-semibold tracking-wider">Contact Number</span>
            <span className="font-semibold text-foreground">{user?.phone || '—'}</span>
          </div>

          <div className="space-y-1 bg-secondary/10 p-3 rounded-lg border border-border/40">
            <span className="text-xs text-muted-foreground block uppercase font-semibold tracking-wider">Designation</span>
            <span className="font-semibold text-foreground">{user?.designation || '—'}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Account details and profile information"
        actions={
          isManager && (
            <Button size="sm" onClick={handleAddEmployee}>
              <UserPlus className="mr-1.5 h-4 w-4" />
              Add Employee
            </Button>
          )
        }
      />

      <div className="max-w-4xl">
        {!isManager ? (
          // Non-manager View: READ-ONLY Form with Manager Notification
          <div className="space-y-6">
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-4 text-amber-600 flex items-start gap-3">
              <Info className="h-5 w-5 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-semibold text-sm">Read-Only Profile View</h4>
                <p className="text-xs text-amber-600/90 mt-1">
                  Non-manager roles cannot edit account details directly. If you need to change your email, username, or login credentials, please request your manager to do so.
                </p>
              </div>
            </div>

            <ProfileDetailsCard />
          </div>
        ) : (
          // Manager View: TABS Layout with clean Profile card + User Management list
          <Tabs defaultValue="profile" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="profile">My Profile</TabsTrigger>
              <TabsTrigger value="users">User Management</TabsTrigger>
            </TabsList>

            <TabsContent value="profile">
              <ProfileDetailsCard />
            </TabsContent>

            <TabsContent value="users">
              {employeesLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <DataTable
                  data={employees}
                  columns={employeeColumns}
                  searchKeys={['name', 'email', 'username', 'role']}
                  searchPlaceholder="Search employees..."
                />
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Employee Add/Edit side sheet drawer */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingEmployee ? 'Edit Employee details' : 'Add New Employee'}</SheetTitle>
            <SheetDescription>
              {editingEmployee ? 'Update account configurations and designations in Google Sheets.' : 'Create a new employee profile to access the CRM portal.'}
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={handleEmployeeSubmit} className="space-y-4 mt-6">
            <div className="space-y-2">
              <Label htmlFor="empName">Full Name</Label>
              <Input
                id="empName"
                value={empName}
                onChange={(e) => setEmpName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="empEmail">Email Address</Label>
              <Input
                id="empEmail"
                type="email"
                required
                value={empEmail}
                onChange={(e) => setEmpEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="empPhone">Phone Number</Label>
              <Input
                id="empPhone"
                placeholder="+91 ..."
                value={empPhone}
                onChange={(e) => setEmpPhone(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="empDesignation">Designation</Label>
              <Input
                id="empDesignation"
                placeholder="e.g. Creative Editor"
                value={empDesignation}
                onChange={(e) => setEmpDesignation(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="empRole">System Role</Label>
              <Select value={empRole} onValueChange={setEmpRole}>
                <SelectTrigger id="empRole">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {USER_ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role === 'manager' ? 'manager (Master)' : role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="empUsername">System Username</Label>
              <Input
                id="empUsername"
                value={empUsername}
                onChange={(e) => setEmpUsername(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="empRedirect">Dashboard redirect path</Label>
              <Select value={empRedirect} onValueChange={setEmpRedirect}>
                <SelectTrigger id="empRedirect">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REDIRECT_PATHS.map((path) => (
                    <SelectItem key={path.value} value={path.value}>
                      {path.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="empPassword">Password</Label>
              <Input
                id="empPassword"
                type="password"
                placeholder={editingEmployee ? 'Leave empty to keep unchanged' : 'Required for login'}
                value={empPassword}
                onChange={(e) => setEmpPassword(e.target.value)}
                required={!editingEmployee}
              />
            </div>

            <Button type="submit" disabled={empSubmitting} className="w-full mt-4">
              {empSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
