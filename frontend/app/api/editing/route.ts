import { NextResponse } from 'next/server';
import { getAuthenticatedUser, getAccessToken } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000/api/v1';

export async function GET() {
  try {
    const user = getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = getAccessToken();
    const res = await fetch(`${BACKEND_URL}/editing`, {
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

    const token = getAccessToken();
    const body = await request.json();
    const taskId = String(body.taskId ?? '').trim();

    const res = await fetch(`${BACKEND_URL}/editing/task/${taskId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
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
