import { NextResponse } from 'next/server';
import { getAuthenticatedUser, getAccessToken } from '@/lib/auth-server';
import { getBackendUrl } from '@/lib/backend-url';

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/client-profiles/[id]/previous-projects/[projectId] — Unlink a project
 */
export async function DELETE(
  request: Request,
  { params }: { params: { id: string; projectId: string } }
) {
  const h = request.headers;
  try {
    const user = getAuthenticatedUser(h);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const BACKEND_URL = await getBackendUrl();
    const token = getAccessToken(h);

    const res = await fetch(
      `${BACKEND_URL}/client-profiles/${params.id}/previous-projects/${params.projectId}`,
      {
        method: 'DELETE',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      }
    );

    const data = await res.json();
    if (res.ok && data.success) {
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: data.message || 'Failed to unlink project' }, { status: res.status });
  } catch (error) {
    console.error('Failed to unlink project:', error);
    return NextResponse.json({ error: 'Failed to unlink project' }, { status: 500 });
  }
}
