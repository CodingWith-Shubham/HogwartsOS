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
    const res = await fetch(`${BACKEND_URL}/editing/workload`, {
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      cache: 'no-store',
    });

    const data = await res.json();
    if (res.ok && data.success) {
      return NextResponse.json({
        workloads: data.data.workloads || []
      });
    }
    return NextResponse.json({ workloads: [] });
  } catch (error) {
    console.error('Failed to fetch editor workload from Express:', error);
    return NextResponse.json({ error: 'Failed to fetch editor workload', workloads: [] }, { status: 500 });
  }
}
