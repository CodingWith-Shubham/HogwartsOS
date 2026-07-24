import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000/api/v1';

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

    cookies().set('howgarts_session', JSON.stringify(user), {
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
      httpOnly: false,
    });

    return NextResponse.json({ success: true, user, token: resData.data.accessToken });
  } catch (error) {
    console.error('Login API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error connecting to backend' },
      { status: 500 }
    );
  }
}
