import { NextResponse } from 'next/server';
import { getAuthenticatedUser, getAccessToken } from '@/lib/auth-server';
import { getBackendUrl } from '@/lib/backend-url';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const h = request.headers;
  try {
    const user = getAuthenticatedUser(h);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const BACKEND_URL = await getBackendUrl();
    const token = getAccessToken(h);
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const action = searchParams.get('action');

    const endpoint = action === 'summary'
      ? `${BACKEND_URL}/attendance/summary`
      : date
      ? `${BACKEND_URL}/attendance/team-attendance?date=${date}`
      : `${BACKEND_URL}/attendance/my-attendance`;

    const res = await fetch(endpoint, {
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      cache: 'no-store'
    });

    const data = await res.json();
    if (res.ok && data.success) {
      return NextResponse.json(data.data);
    }
    return NextResponse.json({ today: null, history: [], logs: [] });
  } catch (error) {
    console.error('Failed to fetch attendance data:', error);
    return NextResponse.json({ error: 'Failed to fetch attendance data' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const h = request.headers;
  try {
    const user = getAuthenticatedUser(h);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const BACKEND_URL = await getBackendUrl();
    const token = getAccessToken(h);
    const body = await request.json();
    const proxyAction = body.proxyAction || body.action || 'check-in';

    const endpoint = proxyAction === 'check-out'
      ? `${BACKEND_URL}/attendance/check-out`
      : proxyAction === 'request-full-day'
      ? `${BACKEND_URL}/attendance/request-full-day`
      : proxyAction === 'approve-full-day'
      ? `${BACKEND_URL}/attendance/approve-full-day`
      : `${BACKEND_URL}/attendance/check-in`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      return NextResponse.json({ success: true, attendance: data.data.attendance });
    }

    return NextResponse.json({ error: data.message || 'Attendance action failed' }, { status: res.status });
  } catch (error) {
    console.error('Failed to process attendance action:', error);
    return NextResponse.json({ error: 'Failed to process attendance action' }, { status: 500 });
  }
}
