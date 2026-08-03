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

    const res = await fetch(`${BACKEND_URL}/client-profiles${qs ? `?${qs}` : ''}`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      cache: 'no-store',
    });

    const data = await res.json();
    if (res.ok && data.success) {
      return NextResponse.json(data.data);
    }
    return NextResponse.json({ error: data.message || 'Failed to fetch client profiles', profiles: [] }, { status: res.status });
  } catch (error) {
    console.error('Failed to fetch client profiles:', error);
    return NextResponse.json({ error: 'Failed to fetch client profiles', profiles: [] }, { status: 500 });
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

    const res = await fetch(`${BACKEND_URL}/client-profiles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (res.status === 409) {
      return NextResponse.json({
        isDuplicate: true,
        message:  `${data.message} A matching client profile already exists`,
        existingProfile: data.existingProfile,
      }, { status: 409 });
    }

    if (res.ok && data.success) {
      return NextResponse.json(data.data, { status: 201 });
    }

    return NextResponse.json({ error: data.message || 'Failed to create client profile' }, { status: res.status });
  } catch (error) {
    console.error('Failed to create client profile:', error);
    return NextResponse.json({ error: 'Failed to create client profile' }, { status: 500 });
  }
}
