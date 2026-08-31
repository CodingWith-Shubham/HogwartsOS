import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';
import { getBackendUrl } from '@/lib/backend-url';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Get the access token from the httpOnly cookie
    const cookieStore = cookies();
    const accessToken = cookieStore.get('howgarts_token')?.value;

    // Also check the X-Auth-Token header (sent by authFetch via localStorage)
    const reqHeaders = headers();
    const headerToken = reqHeaders.get('x-auth-token');

    const token = accessToken || headerToken;

    if (!token) {
      return NextResponse.json({ success: false, error: 'No token' }, { status: 401 });
    }

    const BACKEND_URL = await getBackendUrl();
    const expressRes = await fetch(`${BACKEND_URL}/auth/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    const resData = await expressRes.json();

    if (!expressRes.ok || !resData.success) {
      return NextResponse.json(
        { success: false, error: resData.message || 'Unauthorized' },
        { status: expressRes.status || 401 }
      );
    }

    return NextResponse.json({ success: true, user: resData.data?.user || resData.data });
  } catch (error) {
    console.error('/api/auth/me error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
