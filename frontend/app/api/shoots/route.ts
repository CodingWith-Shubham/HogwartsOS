import { NextResponse } from 'next/server';
import { getAuthenticatedUser, getAccessToken } from '@/lib/auth-server';
import { getBackendUrl } from '@/lib/backend-url';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const BACKEND_URL = await getBackendUrl();
    const token = getAccessToken();
    const { searchParams } = new URL(request.url);
    const qs = searchParams.toString();
    const res = await fetch(`${BACKEND_URL}/shoots${qs ? `?${qs}` : ''}`, {
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      cache: 'no-store',
    });

    const data = await res.json();
    if (res.ok && data.success) {
      return NextResponse.json({ shoots: data.data.shoots || [] });
    }
    return NextResponse.json({ shoots: [] });
  } catch (error) {
    console.error('Failed to fetch shoots from Express:', error);
    return NextResponse.json({ error: 'Failed to fetch shoots', shoots: [] }, { status: 500 });
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
    const res = await fetch(`${BACKEND_URL}/shoots`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      return NextResponse.json({ shoot: data.data.shoot }, { status: 201 });
    }
    return NextResponse.json({ error: data.message || 'Failed to schedule shoot' }, { status: res.status });
  } catch (error) {
    console.error('Failed to create shoot in Express:', error);
    return NextResponse.json({ error: 'Failed to schedule shoot' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const BACKEND_URL = await getBackendUrl();
    const token = getAccessToken();
    const body = await request.json();
    const shootId = String(body.shootId ?? '').trim();

    const res = await fetch(`${BACKEND_URL}/shoots/${shootId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      return NextResponse.json({ success: true, shoot: data.data.shoot });
    }
    return NextResponse.json({ error: data.message || 'Failed to update shoot' }, { status: res.status });
  } catch (error) {
    console.error('Failed to update shoot in Express:', error);
    return NextResponse.json({ error: 'Failed to update shoot' }, { status: 500 });
  }
}
