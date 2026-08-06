import { NextResponse } from 'next/server';
import { getBackendUrl } from '@/lib/backend-url';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token') || request.headers.get('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'Missing onboarding token' }, { status: 401 });
    }

    const BACKEND_URL = await getBackendUrl();
    const res = await fetch(`${BACKEND_URL}/client-profiles/public/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    });

    const data = await res.json();
    if (res.ok && data.success) {
      return NextResponse.json(data.data);
    }
    return NextResponse.json({ error: data.message || 'Failed to fetch public profile' }, { status: res.status });
  } catch (error) {
    console.error('Failed to fetch public profile:', error);
    return NextResponse.json({ error: 'Failed to fetch public profile' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'Missing onboarding token' }, { status: 401 });
    }

    const body = await request.json();
    const BACKEND_URL = await getBackendUrl();

    const res = await fetch(`${BACKEND_URL}/client-profiles/public/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      return NextResponse.json(data.data);
    }

    return NextResponse.json({ error: data.message || 'Failed to update public profile' }, { status: res.status });
  } catch (error) {
    console.error('Failed to update public profile:', error);
    return NextResponse.json({ error: 'Failed to update public profile' }, { status: 500 });
  }
}
