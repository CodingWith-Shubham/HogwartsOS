import { NextResponse } from 'next/server';
import { getAuthenticatedUser, getAccessToken } from '@/lib/auth-server';
import { getBackendUrl } from '@/lib/backend-url';

export const dynamic = 'force-dynamic';

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = getAuthenticatedUser(request.headers);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['manager', 'admin', 'super_admin'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const BACKEND_URL = await getBackendUrl();
    const token = getAccessToken(request.headers);
    const id = params.id;

    if (!id) {
      return NextResponse.json({ error: 'Missing employee ID' }, { status: 400 });
    }

    const res = await fetch(`${BACKEND_URL}/users/${id}`, {
      method: 'DELETE',
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
    });

    const data = await res.json();
    if (res.ok && data.success) {
      return NextResponse.json({ success: true });
    }
    
    return NextResponse.json({ error: data.message || 'Failed to delete user' }, { status: res.status });
  } catch (error) {
    console.error('Failed to delete user in Express:', error);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
