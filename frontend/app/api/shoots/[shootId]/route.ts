import { NextResponse } from 'next/server';
import { getAuthenticatedUser, getAccessToken } from '@/lib/auth-server';
import { getBackendUrl } from '@/lib/backend-url';

export const dynamic = 'force-dynamic';

export async function DELETE(
  request: Request,
  { params }: { params: { shootId: string } }
) {
  try {
    const user = getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const BACKEND_URL = await getBackendUrl();
    const token = getAccessToken();
    const shootId = params.shootId;

    if (!shootId) {
      return NextResponse.json({ error: 'Shoot ID is required' }, { status: 400 });
    }

    const res = await fetch(`${BACKEND_URL}/shoots/${shootId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success !== false) {
      return NextResponse.json({ success: true });
    }
    return NextResponse.json(
      { error: data.message || 'Failed to delete shoot' },
      { status: res.status }
    );
  } catch (error) {
    console.error('Failed to delete shoot in Express:', error);
    return NextResponse.json({ error: 'Failed to delete shoot' }, { status: 500 });
  }
}
