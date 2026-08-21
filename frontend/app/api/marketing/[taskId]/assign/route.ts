import { NextResponse } from 'next/server';
import { getAuthenticatedUser, getAccessToken } from '@/lib/auth-server';
import { getBackendUrl } from '@/lib/backend-url';

export const dynamic = 'force-dynamic';

export async function PATCH(request: Request, { params }: { params: { taskId: string } }) {
  try {
    const user = getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const BACKEND_URL = await getBackendUrl();
    const token = getAccessToken();
    const body = await request.json();
    const taskId = params.taskId;

    const res = await fetch(`${BACKEND_URL}/marketing/${taskId}/assign`, {
      method: 'PATCH',
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
    return NextResponse.json({ error: data.message || 'Failed to assign task' }, { status: res.status });
  } catch (error) {
    console.error('Failed to assign task in Express:', error);
    return NextResponse.json({ error: 'Failed to assign task' }, { status: 500 });
  }
}
