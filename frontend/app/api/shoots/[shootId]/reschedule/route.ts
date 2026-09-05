import { NextResponse } from 'next/server';
import { getAuthenticatedUser, getAccessToken } from '@/lib/auth-server';
import { getBackendUrl } from '@/lib/backend-url';

export const dynamic = 'force-dynamic';

/**
 * Release a shoot for rescheduling (soft-cancel with a "Rescheduled" note and
 * free its deliverableSetIndex). The client then re-fires the unchanged n8n
 * schedule-shoot webhook so the updated shoot + calendar invite are created by
 * the existing n8n workflow. On webhook failure the client restores the shoot
 * via PUT /api/shoots.
 */
export async function POST(
  request: Request,
  { params }: { params: { shootId: string } }
) {
  try {
    const user = getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const BACKEND_URL = await getBackendUrl();
    const token = getAccessToken();
    const shootId = params.shootId;

    if (!shootId) {
      return NextResponse.json({ error: 'Shoot ID is required' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));

    const res = await fetch(`${BACKEND_URL}/shoots/${shootId}/reschedule`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success !== false) {
      return NextResponse.json({ success: true, message: data.message || 'Shoot released for rescheduling' });
    }
    return NextResponse.json(
      { error: data.message || 'Failed to release shoot for rescheduling' },
      { status: res.status }
    );
  } catch (error) {
    console.error('Failed to release shoot for rescheduling in Express:', error);
    return NextResponse.json({ error: 'Failed to release shoot for rescheduling' }, { status: 500 });
  }
}
