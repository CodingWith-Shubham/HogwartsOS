import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getBackendUrl } from '@/lib/backend-url';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const cookieStore = cookies();
    const refreshToken = cookieStore.get('howgarts_refresh_token')?.value;

    if (!refreshToken) {
      return NextResponse.json(
        { success: false, error: 'No refresh token available' },
        { status: 401 }
      );
    }

    const BACKEND_URL = await getBackendUrl();
    const expressRes = await fetch(`${BACKEND_URL}/auth/refresh-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `refreshToken=${refreshToken}`,
      },
    });

    const resData = await expressRes.json();

    if (!expressRes.ok || !resData.success) {
      // Refresh failed — clear stale cookies so the user is redirected to login
      cookieStore.delete('howgarts_token');
      cookieStore.delete('howgarts_refresh_token');
      cookieStore.delete('howgarts_session');
      return NextResponse.json(
        { success: false, error: 'Session expired. Please log in again.' },
        { status: 401 }
      );
    }

    const newAccessToken = resData.data.accessToken;
    const newRefreshToken = resData.data.refreshToken;

    // Overwrite the access token cookie with the fresh one
    cookieStore.set('howgarts_token', newAccessToken, {
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      httpOnly: true,
      sameSite: 'lax',
    });

    // Overwrite the refresh token cookie (token rotation)
    if (newRefreshToken) {
      cookieStore.set('howgarts_refresh_token', newRefreshToken, {
        path: '/',
        maxAge: 60 * 60 * 24 * 365, // 365 days
        httpOnly: true,
        sameSite: 'lax',
      });
    }

    return NextResponse.json({ success: true, token: newAccessToken });
  } catch (error) {
    console.error('Refresh token API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
