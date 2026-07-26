import { NextResponse } from 'next/server';
import { getAuthenticatedUser, getAccessToken } from '@/lib/auth-server';
import { getBackendUrl } from '@/lib/backend-url';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const BACKEND_URL = await getBackendUrl();
    const token = getAccessToken();
    const res = await fetch(`${BACKEND_URL}/realtime-data`, {
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      cache: 'no-store',
    });

    const data = await res.json();
    if (res.ok && data.success) {
      return NextResponse.json(data.data);
    }
    return NextResponse.json({
      totalLeads: 0,
      scheduledShoots: 0,
      activeEdits: 0,
      totalRevenue: 0,
      pendingPayments: 0,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to fetch realtime data from Express:', error);
    return NextResponse.json({ error: 'Failed to fetch realtime data' }, { status: 500 });
  }
}
