import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-server';
import { fetchEditingTasksFromSheet } from '@/lib/google/sheets';

export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const user = getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const email = new URL(request.url).searchParams.get('email')?.trim();
  if (!email && !['manager', 'admin'].includes(user.role)) return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  if (user.role === 'editor' && email?.toLowerCase() !== user.email.toLowerCase()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try { return NextResponse.json(await fetchEditingTasksFromSheet(email ?? undefined)); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to fetch tasks' }, { status: 500 }); }
}
