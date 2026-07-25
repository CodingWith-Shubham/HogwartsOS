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
    const res = await fetch(`${BACKEND_URL}/clients`, {
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      cache: 'no-store'
    });

    const data = await res.json();
    if (res.ok && data.success) {
      return NextResponse.json({ leads: data.data.leads || [] });
    }
    return NextResponse.json({ leads: [] });
  } catch (error) {
    console.error('Failed to fetch clients from Express:', error);
    return NextResponse.json({ error: 'Failed to fetch clients', leads: [] }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['manager', 'sales', 'admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const token = getAccessToken();
    const body = await request.json();
    const res = await fetch(`${BACKEND_URL}/clients`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      return NextResponse.json({ lead: data.data.lead }, { status: 201 });
    }

    return NextResponse.json({ error: data.message || 'Failed to create lead' }, { status: res.status });
  } catch (error) {
    console.error('Failed to create client in Express:', error);
    return NextResponse.json({ error: 'Failed to create lead' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['manager', 'sales', 'admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const token = getAccessToken();
    const body = await request.json();
    const leadId = String(body.leadId ?? '').trim();

    if (!leadId) {
      return NextResponse.json({ error: 'Lead ID is required' }, { status: 400 });
    }

    const res = await fetch(`${BACKEND_URL}/clients/${leadId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      return NextResponse.json({ success: true, lead: data.data.lead });
    }

    return NextResponse.json({ error: data.message || 'Update failed' }, { status: res.status });
  } catch (error) {
    console.error('Failed to update client in Express:', error);
    return NextResponse.json({ error: 'Failed to update lead' }, { status: 500 });
  }
}
