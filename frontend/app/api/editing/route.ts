import { NextResponse } from 'next/server';
import { getAuthenticatedUser, getAccessToken } from '@/lib/auth-server';
import { getBackendUrl } from '@/lib/backend-url';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const BACKEND_URL = await getBackendUrl();
    const token = getAccessToken();
    const { searchParams } = new URL(request.url);
    const qs = searchParams.toString();
    const res = await fetch(`${BACKEND_URL}/editing${qs ? `?${qs}` : ''}`, {
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      cache: 'no-store',
    });

    const data = await res.json();
    if (res.ok && data.success) {
      return NextResponse.json({
        editingProjects: data.data.editingProjects || [],
        tasks: data.data.tasks || [],
        revisions: data.data.revisions || []
      });
    }
    return NextResponse.json({ editingProjects: [], tasks: [], revisions: [] });
  } catch (error) {
    console.error('Failed to fetch editing data from Express:', error);
    return NextResponse.json({ error: 'Failed to fetch editing data', editingProjects: [], tasks: [], revisions: [] }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const BACKEND_URL = await getBackendUrl();
    const token = getAccessToken();
    const body = await request.json();
    const taskId = String(body.taskId ?? '').trim();

    // Build the payload — include editorComment if provided
    const payload: Record<string, unknown> = { ...body };

    const res = await fetch(`${BACKEND_URL}/editing/task/${taskId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      return NextResponse.json({ success: true, task: data.data.task });
    }
    return NextResponse.json({ error: data.message || 'Failed to update task' }, { status: res.status });
  } catch (error) {
    console.error('Failed to update task in Express:', error);
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const BACKEND_URL = await getBackendUrl();
    const token = getAccessToken();
    const body = await request.json();

    // action: 'segregate' — classify client feedback as correction or revision
    if (body.action === 'segregate') {
      const { revisionId, type, taskId } = body;
      const res = await fetch(`${BACKEND_URL}/editing/segregate/${revisionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ type, taskId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        return NextResponse.json({ success: true, ...data.data });
      }
      return NextResponse.json({ error: data.message || 'Failed to segregate feedback' }, { status: res.status });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Failed to process editing POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
