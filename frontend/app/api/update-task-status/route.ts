import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-server';
import { fetchEditingTasksFromSheet, updateEditingTaskInSheet } from '@/lib/google/sheets';

export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  const user = getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await request.json();
    if (!body.task_id || !body.status) return NextResponse.json({ error: 'Task ID and status are required' }, { status: 400 });
    const task = (await fetchEditingTasksFromSheet()).find((item) => item.task_id === body.task_id);
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    if (user.role === 'editor' && task.assigned_to_email.toLowerCase() !== user.email.toLowerCase()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const updated = await updateEditingTaskInSheet(body.task_id, { status: body.status, draft_link: body.draft_link });
    return NextResponse.json({ success: true, task: updated });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to update task' }, { status: 500 }); }
}
