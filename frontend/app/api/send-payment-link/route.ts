import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

const PAYMENT_LINK_WEBHOOK_URL = (
  process.env.N8N_SEND_PAYMENT_LINK_WEBHOOK_URL ??
  'https://hogwartsautomation.app.n8n.cloud/webhook/send-payment-link'
).replace('n8n.hogwartsstudios.com', 'hogwartsautomation.app.n8n.cloud');

export async function POST(request: Request) {
  try {
    const user = getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const lead_id = String(formData.get('lead_id') ?? '').trim();
    const client_email = String(formData.get('client_email') ?? '').trim();
    const invoiceFile = formData.get('invoice_file');

    if (!lead_id) {
      return NextResponse.json({ error: 'Lead ID is required' }, { status: 400 });
    }

    if (!client_email) {
      return NextResponse.json({ error: 'Client email is required' }, { status: 400 });
    }

    if (!(invoiceFile instanceof File) || invoiceFile.size === 0) {
      return NextResponse.json({ error: 'An invoice or supporting document is required' }, { status: 400 });
    }

    const payload = new FormData();
    const fields = [
      'client_name',
      'cost',
      'total_cost',
      'amount_to_collect',
      'remaining_amount',
      'amount_paid_so_far',
      'payment_percentage',
      'payment_type',
      'salesperson_name',
      'salesperson_email',
      'additional_emails',
      'payment_mode',
      'cash_collected_by',
      'installment_label',
    ];

    payload.append('lead_id', lead_id);
    payload.append('client_email', client_email);
    for (const field of fields) {
      payload.append(field, String(formData.get(field) ?? '').trim());
    }

    payload.append('invoice_file', invoiceFile);

    const response = await fetch(PAYMENT_LINK_WEBHOOK_URL, {
      method: 'POST',
      body: payload,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.error('n8n send-payment-link webhook failed:', response.status, text);
      return NextResponse.json(
        { error: 'Failed to send payment link via automation' },
        { status: 502 }
      );
    }

    const data = await response.json().catch(() => ({}));
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Failed to proxy send-payment-link webhook:', error);
    const message = error instanceof Error ? error.message : 'Failed to send payment link';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
