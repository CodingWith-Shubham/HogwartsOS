import { NextResponse } from 'next/server';
import { getAuthenticatedUser, getAccessToken } from '@/lib/auth-server';
import { getBackendUrl } from '@/lib/backend-url';

export const dynamic = 'force-dynamic';

const getEndpoint = (backendUrl: string, action?: string, date?: string | null, leaveId?: string | null, startDate?: string | null, endDate?: string | null) => {
  const base = `${backendUrl}/attendance`;
  const endpoints: Record<string, string> = {
    summary: `/summary${startDate && endDate ? `?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}` : ''}`, 'team-attendance': `/team-attendance${date ? `?date=${encodeURIComponent(date)}` : ''}`,
    'my-attendance': '/my-attendance', 'my-leaves': '/my-leaves', 'leave-balance': '/leave-balance',
    'team-leaves': '/team-leaves?status=Pending', 'weekly-off-status': '/weekly-off-status',
    'lop-overrides': '/lop-overrides', 'leave-certificate': `/leave-certificate/${leaveId}`,
    'check-in': '/check-in', 'check-out': '/check-out', 'request-full-day': '/request-full-day',
    'approve-full-day': '/approve-full-day', 'apply-leave': '/apply-leave', 'review-leave': '/review-leave',
    'request-lop-override': '/request-lop-override', 'approve-lop-override': '/approve-lop-override',
    'process-weekly-off': '/process-weekly-off', 'initialize-leave-balance': '/initialize-leave-balance',
  };
  return `${base}${endpoints[action || 'my-attendance'] || '/my-attendance'}`;
};

export async function GET(request: Request) {
  try {
    const headers = request.headers; if (!getAuthenticatedUser(headers)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const url = new URL(request.url); const action = url.searchParams.get('action') || (url.searchParams.get('date') ? 'team-attendance' : 'my-attendance');
    const backendUrl = await getBackendUrl(); const token = getAccessToken(headers);
    const res = await fetch(getEndpoint(backendUrl, action, url.searchParams.get('date'), url.searchParams.get('leaveId'), url.searchParams.get('startDate'), url.searchParams.get('endDate')), { headers: token ? { Authorization: `Bearer ${token}` } : {}, cache: 'no-store' });
    if (action === 'leave-certificate') {
      if (!res.ok) return NextResponse.json({ error: 'Certificate not found' }, { status: res.status });
      return new NextResponse(await res.arrayBuffer(), { headers: { 'Content-Type': res.headers.get('content-type') || 'application/octet-stream', 'Content-Disposition': res.headers.get('content-disposition') || 'inline' } });
    }
    const data = await res.json();
    return NextResponse.json(res.ok && data.success ? data.data : { error: data.message || 'Attendance request failed' }, { status: res.ok ? 200 : res.status });
  } catch (error) { console.error('Attendance GET proxy failed:', error); return NextResponse.json({ error: 'Failed to fetch attendance data' }, { status: 500 }); }
}

export async function POST(request: Request) {
  try {
    const headers = request.headers; if (!getAuthenticatedUser(headers)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const backendUrl = await getBackendUrl(); const token = getAccessToken(headers); const contentType = headers.get('content-type') || '';
    const isMultipart = contentType.includes('multipart/form-data');
    const body = isMultipart ? await request.formData() : await request.json();
    const action = isMultipart ? String(body.get('proxyAction') || 'apply-leave') : (body.proxyAction || body.action || 'check-in');
    if (isMultipart) body.delete('proxyAction');
    const res = await fetch(getEndpoint(backendUrl, action), {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(!isMultipart ? { 'Content-Type': 'application/json' } : {}),
      },
      body: isMultipart ? body : JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok || !data.success) return NextResponse.json({ error: data.message || 'Attendance action failed' }, { status: res.status });
    return NextResponse.json({ success: true, ...data.data });
  } catch (error) { console.error('Attendance POST proxy failed:', error); return NextResponse.json({ error: 'Failed to process attendance action' }, { status: 500 }); }
}
