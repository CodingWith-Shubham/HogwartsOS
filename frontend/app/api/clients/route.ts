import { NextResponse } from 'next/server';
import { getAuthenticatedUser, getAccessToken } from '@/lib/auth-server';
import { getBackendUrl } from '@/lib/backend-url';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const h = request.headers;
  let BACKEND_URL = '';
  try {
    const user = getAuthenticatedUser(h);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    BACKEND_URL = await getBackendUrl();
    const token = getAccessToken(h);
    const { searchParams } = new URL(request.url);
    const qs = searchParams.toString();
    const res = await fetch(`${BACKEND_URL}/clients${qs ? `?${qs}` : ''}`, {
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      cache: 'no-store'
    });

    const data = await res.json();
    if (res.ok && data.success) {
      return NextResponse.json({ leads: data.data.leads || [] });
    }
    if (res.status === 401 || res.status === 403) {
      return NextResponse.json({ error: data.message || 'Unauthorized' }, { status: res.status });
    }
    return NextResponse.json({ leads: [] });
  } catch (error) {
    console.error('Failed to fetch clients from Express:', error);
    const msg = error instanceof Error && error.message.includes('ECONNREFUSED')
      ? 'Backend server is not running at ' + BACKEND_URL
      : 'Failed to fetch clients';
    return NextResponse.json({ error: msg, leads: [] }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const h = request.headers;
  try {
    const user = getAuthenticatedUser(h);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['manager', 'sales', 'admin', 'super_admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const BACKEND_URL = await getBackendUrl();
    const token = getAccessToken(h);
    const body = await request.json();
    
    console.log(`[DEBUG clients POST] BACKEND_URL=${BACKEND_URL}`);
    console.log(`[DEBUG clients POST] Token starts with: ${token?.substring(0, 15)}...`);
    
    const res = await fetch(`${BACKEND_URL}/clients`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    console.log(`[DEBUG clients POST] Response status: ${res.status}, data:`, data);
    if (res.ok && data.success) {
      return NextResponse.json({ lead: data.data.lead }, { status: 201 });
    }

    return NextResponse.json({ error: data.message || 'Failed to create lead' }, { status: res.status });
  } catch (error) {
    console.error('Failed to create client in Express:', error);
    const msg = error instanceof Error && error.message.includes('ECONNREFUSED')
      ? 'Backend server is not running. Please start it with: npm run dev (in /backend)'
      : 'Failed to create lead';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const h = request.headers;
  try {
    const user = getAuthenticatedUser(h);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['manager', 'sales', 'admin', 'super_admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const BACKEND_URL = await getBackendUrl();
    const token = getAccessToken(h);
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
    const msg = error instanceof Error && error.message.includes('ECONNREFUSED')
      ? 'Backend server is not running. Please start it with: npm run dev (in /backend)'
      : 'Failed to update lead';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const h = request.headers;
  try {
    const user = getAuthenticatedUser(h);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['manager', 'sales', 'admin', 'super_admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const BACKEND_URL = await getBackendUrl();
    const token = getAccessToken(h);
    const body = await request.json();
    const leadId = String(body.leadId ?? '').trim();

    if (!leadId) {
      return NextResponse.json({ error: 'Lead ID is required' }, { status: 400 });
    }

    const res = await fetch(`${BACKEND_URL}/clients/${leadId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
    });

    const data = await res.json();
    if (res.ok && data.success) {
      return NextResponse.json({ success: true, lead: data.data.lead });
    }

    return NextResponse.json({ error: data.message || 'Delete failed' }, { status: res.status });
  } catch (error) {
    console.error('Failed to delete client in Express:', error);
    const msg = error instanceof Error && error.message.includes('ECONNREFUSED')
      ? 'Backend server is not running. Please start it with: npm run dev (in /backend)'
      : 'Failed to delete lead';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
