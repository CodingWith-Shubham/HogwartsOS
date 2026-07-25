import { NextResponse } from 'next/server';
import { getAuthenticatedUser, getAccessToken } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000/api/v1';

export async function GET(request: Request) {
  try {
    const user = getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = getAccessToken();
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');

    const endpoint = date
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
  try {
    const user = getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = getAccessToken();
    const body = await request.json();
    const action = body.action || 'check-in';

    const endpoint = action === 'check-out'
      ? `${BACKEND_URL}/attendance/check-out`
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
