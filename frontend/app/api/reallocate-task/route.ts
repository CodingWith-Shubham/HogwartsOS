import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';
const WEBHOOK_URL = process.env.N8N_REALLOCATE_TASK_WEBHOOK_URL ?? `${process.env.N8N_BASE_URL ?? 'https://n8n.hogwartsstudios.com'}/webhook/reallocate-task`;

export async function POST(request: Request) {
  const user = getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['manager', 'admin'].includes(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const body = await request.json();
    if (!body.task_id || !body.new_editor_name || !body.new_editor_email || !body.reason) return NextResponse.json({ error: 'Task, editor, and reason are required' }, { status: 400 });
    const response = await fetch(WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return NextResponse.json({ error: 'Failed to reallocate task', details: data }, { status: 502 });
    return NextResponse.json(data || { success: true });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to reallocate task' }, { status: 500 }); }
}
