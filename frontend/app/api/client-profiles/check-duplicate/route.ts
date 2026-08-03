import { NextResponse } from 'next/server';
import { getAuthenticatedUser, getAccessToken } from '@/lib/auth-server';
import { getBackendUrl } from '@/lib/backend-url';

export const dynamic = 'force-dynamic';

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

    const res = await fetch(`${BACKEND_URL}/client-profiles/check-duplicate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      return NextResponse.json(data.data);
    }

    return NextResponse.json({ exists: false, profile: null });
  } catch (error) {
    console.error('Failed to check duplicate client profile:', error);
    return NextResponse.json({ exists: false, profile: null }, { status: 500 });
  }
}
