import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000/api/v1';

export async function GET() {
  try {
    const user = getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const res = await fetch(`${BACKEND_URL}/payments`, { cache: 'no-store' });
    const data = await res.json();
    if (res.ok && data.success) {
      return NextResponse.json({ payments: data.data.payments || [] });
    }
    return NextResponse.json({ payments: [] });
  } catch (error) {
    console.error('Failed to fetch payments from Express:', error);
    return NextResponse.json({ error: 'Failed to fetch payments', payments: [] }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const res = await fetch(`${BACKEND_URL}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      return NextResponse.json({ payment: data.data.payment }, { status: 201 });
    }
    return NextResponse.json({ error: data.message || 'Failed to record payment' }, { status: res.status });
  } catch (error) {
    console.error('Failed to create payment in Express:', error);
    return NextResponse.json({ error: 'Failed to record payment' }, { status: 500 });
  }
}
