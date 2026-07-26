import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getBackendUrl } from '@/lib/backend-url';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email ?? '').trim().toLowerCase();
    const password = String(body.password ?? '');

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const BACKEND_URL = await getBackendUrl();
    const expressRes = await fetch(`${BACKEND_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const resData = await expressRes.json();

    if (!expressRes.ok || !resData.success) {
      return NextResponse.json(
        { success: false, error: resData.message || 'Invalid email or password' },
        { status: expressRes.status || 401 }
      );
    }

    const user = resData.data.user;
    const accessToken = resData.data.accessToken;

    // Store user session info in a non-httpOnly cookie (readable by client JS)
    cookies().set('howgarts_session', JSON.stringify(user), {
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
      httpOnly: false,
    });

    // Store the JWT access token in an httpOnly cookie (used by server-side API routes)
    cookies().set('howgarts_token', accessToken, {
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
      httpOnly: true,
      sameSite: 'lax',
    });

    return NextResponse.json({ success: true, user, token: accessToken });
  } catch (error) {
    console.error('Login API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error connecting to backend' },
      { status: 500 }
    );
  }
}
