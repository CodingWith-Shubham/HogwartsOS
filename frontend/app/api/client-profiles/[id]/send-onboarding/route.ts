import { NextResponse } from 'next/server';
import { getAuthenticatedUser, getAccessToken } from '@/lib/auth-server';
import { getBackendUrl } from '@/lib/backend-url';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const h = request.headers;
  try {
    const user = getAuthenticatedUser(h);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const BACKEND_URL = await getBackendUrl();
    const token = getAccessToken(h);

    const res = await fetch(`${BACKEND_URL}/client-profiles/${params.id}/send-onboarding`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      cache: 'no-store',
    });

    const data = await res.json();
    if (res.ok && data.success) {
      return NextResponse.json(data.data || {});
    }

    return NextResponse.json({ error: data.message || 'Failed to send onboarding link' }, { status: res.status });
  } catch (error) {
    console.error('Failed to send onboarding link:', error);
    return NextResponse.json({ error: 'Failed to send onboarding link' }, { status: 500 });
  }
}
