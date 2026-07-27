import { NextResponse } from 'next/server';
import { getAuthenticatedUser, getAccessToken } from '@/lib/auth-server';
import { getBackendUrl } from '@/lib/backend-url';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const user = getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const BACKEND_URL = await getBackendUrl();
    const token = getAccessToken();
    const body = await request.json();

    const res = await fetch(`${BACKEND_URL}/editing/assign-tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      return NextResponse.json({ success: true, data: data.data });
    }
    
    return NextResponse.json(
      { error: data.message || 'Failed to assign tasks' }, 
      { status: res.status }
    );
  } catch (error) {
    console.error('Failed to assign tasks via Express:', error);
    return NextResponse.json({ error: 'Failed to assign tasks' }, { status: 500 });
  }
}
