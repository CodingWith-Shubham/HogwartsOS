import { NextResponse } from 'next/server';
import { getBackendUrl } from '@/lib/backend-url';
import { getAuthenticatedUser, getAccessToken } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const h = request.headers;
    const user = getAuthenticatedUser(h);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const token = getAccessToken(h);
    const { searchParams } = new URL(request.url);
    const BACKEND_URL = await getBackendUrl();
    
    // Construct the backend URL with query params
    const backendUrl = new URL(`${BACKEND_URL}/finance/dashboard`);
    searchParams.forEach((value, key) => {
        backendUrl.searchParams.append(key, value);
    });

    const response = await fetch(backendUrl.toString(), {
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      cache: 'no-store'
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return NextResponse.json({ success: false, error: errorData.message || 'Backend error' }, { status: response.status });
    }

    const json = await response.json();
    return NextResponse.json(json);
  } catch (error) {
    console.error('Failed to fetch finance dashboard data:', error);
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
