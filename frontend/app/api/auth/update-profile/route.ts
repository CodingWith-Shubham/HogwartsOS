import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAuthenticatedUser, getAccessToken } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000/api/v1';

export async function POST(request: Request) {
  try {
    const authenticatedUser = getAuthenticatedUser();
    if (!authenticatedUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!['manager', 'admin'].includes(authenticatedUser.role)) {
      return NextResponse.json({ success: false, error: 'Forbidden. Please contact a manager to update your account details.' }, { status: 403 });
    }

    const body = await request.json();
    const email = String(body.email ?? '').trim();
    const username = String(body.username ?? '').trim().toLowerCase();
    const password = String(body.password ?? '').trim();

    if (!email || !username) {
      return NextResponse.json({ success: false, error: 'Email and username are required' }, { status: 400 });
    }

    const updatePayload: any = { email, username };
    if (password) updatePayload.password = password;

    const token = getAccessToken();
    const res = await fetch(`${BACKEND_URL}/users/${authenticatedUser.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(updatePayload),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return NextResponse.json({ success: false, error: data.message || 'Failed to update profile' }, { status: res.status });
    }

    const sanitizedUser = data.data.user;

    cookies().set('howgarts_session', JSON.stringify(sanitizedUser), {
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
      httpOnly: false,
    });

    return NextResponse.json({ success: true, user: sanitizedUser });
  } catch (error) {
    console.error('Update profile API error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
