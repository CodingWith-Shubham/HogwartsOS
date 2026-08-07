import { NextResponse } from 'next/server';
import { getAuthenticatedUser, getAccessToken } from '@/lib/auth-server';
import { getBackendUrl } from '@/lib/backend-url';

export const dynamic = 'force-dynamic';

const MANAGER_ROLES = ['manager', 'admin', 'super_admin'];

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const h = request.headers;
  try {
    const user = getAuthenticatedUser(h);
    if (!user || !MANAGER_ROLES.includes(user.role)) {
      return NextResponse.json({ error: 'Unauthorized: managers only' }, { status: 401 });
    }

    const BACKEND_URL = await getBackendUrl();
    const token = getAccessToken(h);
    const body = await request.json();

    const res = await fetch(`${BACKEND_URL}/upsell-crosssell/${params.id}/assign-editor`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(
        { error: data.message || 'Failed to assign editor' },
        { status: res.status }
      );
    }
    return NextResponse.json({ success: true, data: data.data });
  } catch (error) {
    console.error('Failed to assign editor for upsell/cross-sell in Express:', error);
    return NextResponse.json({ error: 'Failed to assign editor' }, { status: 500 });
  }
}
