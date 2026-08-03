import { NextResponse } from 'next/server';
import { getAuthenticatedUser, getAccessToken } from '@/lib/auth-server';
import { getBackendUrl } from '@/lib/backend-url';

export const dynamic = 'force-dynamic';

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

    const res = await fetch(`${BACKEND_URL}/client-profiles/${params.id}`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      cache: 'no-store',
    });

    const data = await res.json();
    if (res.ok && data.success) {
      return NextResponse.json(data.data);
    }

    return NextResponse.json({ error: data.message || 'Client profile not found' }, { status: res.status });
  } catch (error) {
    console.error('Failed to fetch single client profile:', error);
    return NextResponse.json({ error: 'Failed to fetch client profile' }, { status: 500 });
  }
}

export async function PATCH(
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

    const res = await fetch(`${BACKEND_URL}/client-profiles/${params.id}`, {
      method: 'PATCH',
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

    return NextResponse.json({ error: data.message || 'Failed to update client profile' }, { status: res.status });
  } catch (error) {
    console.error('Failed to update client profile:', error);
    return NextResponse.json({ error: 'Failed to update client profile' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const h = request.headers;
  try {
    const user = getAuthenticatedUser(h);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['manager', 'admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Only Managers can delete client profiles' }, { status: 403 });
    }

    const BACKEND_URL = await getBackendUrl();
    const token = getAccessToken(h);

    const res = await fetch(`${BACKEND_URL}/client-profiles/${params.id}`, {
      method: 'DELETE',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    const data = await res.json();
    if (res.ok && data.success) {
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: data.message || 'Failed to delete client profile' }, { status: res.status });
  } catch (error) {
    console.error('Failed to delete client profile:', error);
    return NextResponse.json({ error: 'Failed to delete client profile' }, { status: 500 });
  }
}
