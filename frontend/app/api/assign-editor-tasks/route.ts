import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';
const WEBHOOK_URL = process.env.N8N_ASSIGN_EDITOR_TASKS_WEBHOOK_URL ?? `${process.env.N8N_BASE_URL ?? 'https://n8n.hogwartsstudios.com'}/webhook/assign-editor-tasks`;

export async function POST(request: Request) {
  const user = getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['manager', 'admin'].includes(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const body = await request.json();
    if (!body.shoot_id || !body.data_link || !Array.isArray(body.tasks) || body.tasks.length === 0) {
      return NextResponse.json({ error: 'Shoot, data link, and at least one task are required' }, { status: 400 });
    }
    const response = await fetch(WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const contentType = response.headers.get('content-type') ?? '';
    const data = contentType.includes('application/json') ? await response.json() : await response.text();
    if (!response.ok) return NextResponse.json({ error: 'Failed to assign editor tasks', details: data }, { status: 502 });
    return NextResponse.json(data || { success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to assign editor tasks' }, { status: 500 });
  }
}
