import { NextResponse } from 'next/server';
import { getAuthenticatedUser, getAccessToken } from '@/lib/auth-server';
import { getBackendUrl } from '@/lib/backend-url';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = getAuthenticatedUser(request.headers);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const BACKEND_URL = await getBackendUrl();
    const token = getAccessToken(request.headers);
    const { searchParams } = new URL(request.url);
    const qs = searchParams.toString();
    const res = await fetch(`${BACKEND_URL}/payments${qs ? `?${qs}` : ''}`, {
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      cache: 'no-store',
    });

    const data = await res.json();
    if (res.ok && data.success) {
      return NextResponse.json({ payments: data.data.payments || [] });
    }
    return NextResponse.json({ payments: [] });
  } catch (error) {
    console.error('Failed to fetch payments from Express:', error);
    return NextResponse.json({ error: 'Failed to fetch payments', payments: [] }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const BACKEND_URL = await getBackendUrl();
    const token = getAccessToken();
    const body = await request.json();
    const res = await fetch(`${BACKEND_URL}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      return NextResponse.json({ payment: data.data.payment }, { status: 201 });
    }
    return NextResponse.json({ error: data.message || 'Failed to record payment' }, { status: res.status });
  } catch (error) {
    console.error('Failed to create payment in Express:', error);
    return NextResponse.json({ error: 'Failed to record payment' }, { status: 500 });
  }
}
