import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAuthenticatedUser } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000/api/v1';

export async function GET() {
  const currentUser = getAuthenticatedUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const res = await fetch(`${BACKEND_URL}/users`, { cache: 'no-store' });
    const data = await res.json();
    if (res.ok && data.success) {
      return NextResponse.json({ success: true, users: data.data.users });
    }
    return NextResponse.json({ success: false, users: [] }, { status: res.status });
  } catch (err) {
    console.error('Failed to fetch users from Express:', err);
    return NextResponse.json({ success: false, users: [] }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const currentUser = getAuthenticatedUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['manager', 'admin'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const res = await fetch(`${BACKEND_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      return NextResponse.json({ success: true, user: data.data.createdUser }, { status: 201 });
    }
    return NextResponse.json({ error: data.message || 'Failed to create user' }, { status: res.status });
  } catch (error) {
    console.error('Failed to create user in Express:', error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const currentUser = getAuthenticatedUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['manager', 'admin'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const id = String(body.id ?? body._id ?? '').trim();

    const res = await fetch(`${BACKEND_URL}/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      const sanitized = data.data.user;
      if (currentUser.id === id) {
        cookies().set('howgarts_session', JSON.stringify(sanitized), {
          path: '/',
          maxAge: 60 * 60 * 24 * 7,
          httpOnly: false,
        });
      }
      return NextResponse.json({ success: true, user: sanitized });
    }

    return NextResponse.json({ error: data.message || 'Update failed' }, { status: res.status });
  } catch (error) {
    console.error('Failed to update user in Express:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}
