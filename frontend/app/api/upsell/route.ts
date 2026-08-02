import { NextResponse } from 'next/server';
import { getAuthenticatedUser, getAccessToken } from '@/lib/auth-server';
import { getBackendUrl } from '@/lib/backend-url';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const h = request.headers;
  let BACKEND_URL = '';
  try {
    const user = getAuthenticatedUser(h);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    BACKEND_URL = await getBackendUrl();
    const token = getAccessToken(h);
    const body = await request.json();

    const res = await fetch(`${BACKEND_URL}/leads/upsell`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(
        { error: data.message || 'Failed to create upsell lead' },
        { status: res.status }
      );
    }
    return NextResponse.json({ success: true, data: data.data });
  } catch (error) {
    console.error('Failed to create upsell lead in Express:', error);
    const msg = error instanceof Error && error.message.includes('ECONNREFUSED')
      ? 'Backend server is not running at ' + BACKEND_URL
      : 'Failed to create upsell lead';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

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

    const res = await fetch(`${BACKEND_URL}/analytics/upsell-metrics`, {
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      cache: 'no-store'
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(
        { error: data.message || 'Failed to fetch upsell metrics' },
        { status: res.status }
      );
    }
    return NextResponse.json({ data: data.data });
  } catch (error) {
    console.error('Failed to fetch upsell metrics from Express:', error);
    return NextResponse.json({ error: 'Failed to fetch metrics', data: [] }, { status: 500 });
  }
}
