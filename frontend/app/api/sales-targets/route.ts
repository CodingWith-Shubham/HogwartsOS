import { NextResponse } from 'next/server';
import { getAuthenticatedUser, getAccessToken } from '@/lib/auth-server';
import { getBackendUrl } from '@/lib/backend-url';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const h = request.headers;
  let BACKEND_URL = '';
  try {
    const user = getAuthenticatedUser(h);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    BACKEND_URL = await getBackendUrl();
    const token = getAccessToken(h);
    const { searchParams } = new URL(request.url);
    const qs = searchParams.toString();
    const res = await fetch(`${BACKEND_URL}/sales-targets${qs ? `?${qs}` : ''}`, {
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      cache: 'no-store'
    });

    const data = await res.json();
    if (res.ok && data.success) {
      return NextResponse.json({ targets: data.targets || [] });
    }
    if (res.status === 401 || res.status === 403) {
      return NextResponse.json({ error: data.message || 'Unauthorized' }, { status: res.status });
    }
    return NextResponse.json({ targets: [] });
  } catch (error) {
    console.error('Failed to fetch sales targets from Express:', error);
    const msg = error instanceof Error && error.message.includes('ECONNREFUSED')
      ? 'Backend server is not running at ' + BACKEND_URL
      : 'Failed to fetch sales targets';
    return NextResponse.json({ error: msg, targets: [] }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const h = request.headers;
  try {
    const user = getAuthenticatedUser(h);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['manager', 'admin', 'super_admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const BACKEND_URL = await getBackendUrl();
    const token = getAccessToken(h);
    const body = await request.json();
    
    const res = await fetch(`${BACKEND_URL}/sales-targets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      return NextResponse.json({ target: data.target }, { status: 200 });
    }

    return NextResponse.json({ error: data.message || data.error || 'Failed to save sales target' }, { status: res.status });
  } catch (error) {
    console.error('Failed to save sales target in Express:', error);
    const msg = error instanceof Error && error.message.includes('ECONNREFUSED')
      ? 'Backend server is not running.'
      : 'Failed to save sales target';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
