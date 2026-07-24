import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-server';
import { fetchLeadsWithPayments, clearSheetsCache } from '@/lib/google/sheets';

export const dynamic = 'force-dynamic';

const CONFIRM_PAYMENT_WEBHOOK_URL = (
  process.env.N8N_CONFIRM_PAYMENT_WEBHOOK_URL ??
  'https://hogwartsautomation.app.n8n.cloud/webhook/confirm-payment-link'
).replace('n8n.hogwartsstudios.com', 'hogwartsautomation.app.n8n.cloud');

export async function POST(request: Request) {
  try {
    const user = getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    const lead_id = String(body.lead_id ?? '').trim();
    const payment_id = String(body.payment_id ?? '').trim();
    const verified_by = String(body.verified_by ?? '').trim();

    if (!lead_id) {
      return NextResponse.json({ error: 'Lead ID is required' }, { status: 400 });
    }

    if (!payment_id) {
      return NextResponse.json({ error: 'Payment ID is required' }, { status: 400 });
    }

    if (!verified_by) {
      return NextResponse.json({ error: 'Verifier name is required' }, { status: 400 });
    }

    // Enforce data isolation: check if user is allowed to access this lead
    if (user.role === 'sales') {
      const leads = await fetchLeadsWithPayments();
      const isAssigned = leads.some(
        (l) =>
          l.leadId === lead_id &&
          (l.assignedTo.trim().toLowerCase() === user.name.trim().toLowerCase() ||
            l.assignedTo.trim().toLowerCase() === user.email.trim().toLowerCase() ||
            l.assignedTo.trim().toLowerCase() === user.username.trim().toLowerCase())
      );
      if (!isAssigned) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    } else if (user.role !== 'manager' && user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const url = new URL(CONFIRM_PAYMENT_WEBHOOK_URL);
    url.searchParams.set('lead_id', lead_id);
    url.searchParams.set('payment_id', payment_id);
    url.searchParams.set('verified_by', verified_by);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    const text = await response.text().catch(() => '');

    if (!response.ok) {
      console.error('n8n confirm-payment-link webhook failed:', response.status, text);
      return NextResponse.json(
        { error: text || 'Failed to confirm payment via automation' },
        { status: 502 }
      );
    }

    clearSheetsCache();

    let data: unknown = {};
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { message: text };
      }
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Failed to proxy confirm-payment webhook:', error);
    const message = error instanceof Error ? error.message : 'Failed to confirm payment';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
