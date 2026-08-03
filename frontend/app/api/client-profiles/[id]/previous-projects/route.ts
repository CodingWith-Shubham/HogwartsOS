import { NextResponse } from 'next/server';
import { getAuthenticatedUser, getAccessToken } from '@/lib/auth-server';
import { getBackendUrl } from '@/lib/backend-url';

export const dynamic = 'force-dynamic';

/**
 * POST /api/client-profiles/[id]/previous-projects — Link a project
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const h = request.headers;
  try {
    const user = getAuthenticatedUser(h);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const BACKEND_URL = await getBackendUrl();
    const token = getAccessToken(h);
    const body = await request.json();

    const res = await fetch(`${BACKEND_URL}/client-profiles/${params.id}/previous-projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      return NextResponse.json(data.data);
    }

    return NextResponse.json({ error: data.message || 'Failed to link project' }, { status: res.status });
  } catch (error) {
    console.error('Failed to link project:', error);
    return NextResponse.json({ error: 'Failed to link project' }, { status: 500 });
  }
}

/**
 * GET /api/client-profiles/[id]/previous-projects — Search projects (used as search-projects proxy)
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const h = request.headers;
  try {
    const user = getAuthenticatedUser(h);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const BACKEND_URL = await getBackendUrl();
    const token = getAccessToken(h);
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';

    const res = await fetch(`${BACKEND_URL}/client-profiles/${params.id}/search-projects?q=${encodeURIComponent(q)}`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      cache: 'no-store',
    });

    const data = await res.json();
    if (res.ok && data.success) {
      return NextResponse.json(data.data);
    }

    return NextResponse.json({ error: data.message || 'Failed to search projects', projects: [] }, { status: res.status });
  } catch (error) {
    console.error('Failed to search projects:', error);
    return NextResponse.json({ error: 'Failed to search projects', projects: [] }, { status: 500 });
  }
}
