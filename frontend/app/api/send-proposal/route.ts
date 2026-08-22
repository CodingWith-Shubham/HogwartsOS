import { NextResponse } from 'next/server';
import { getAuthenticatedUser, getAccessToken } from '@/lib/auth-server';
import { getBackendUrl } from '@/lib/backend-url';

export const dynamic = 'force-dynamic';

const PROPOSAL_WEBHOOK_URL = 
  process.env.N8N_SEND_PROPOSAL_WEBHOOK_URL ??
  'https://n8n.hogwartsstudios.com/webhook/send-proposal';

export async function POST(request: Request) {
  try {
    const user = getAuthenticatedUser(request.headers);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    console.log("Sending proposal for lead:", body.lead_id);
    const lead_id = String(body.lead_id ?? '').trim();
    const client_email = String(body.client_email ?? '').trim();

    if (!lead_id) {
      return NextResponse.json({ error: 'Lead ID is required' }, { status: 400 });
    }

    if (!client_email) {
      return NextResponse.json({ error: 'Client email is required' }, { status: 400 });
    }

    const payload = {
      lead_id,
      client_name: String(body.client_name ?? '').trim(),
      client_email,
      client_phone: String(body.client_phone ?? '').trim(),
      service_pitched: String(body.service_pitched ?? '').trim(),
      service_notes: String(body.service_notes ?? body.service_pitched ?? '').trim(),
      sales_notes: String(body.sales_notes ?? '').trim(),
      podcast_edit: String(body.podcast_edit ?? '0').trim(),
      reel_edit: String(body.reel_edit ?? '0').trim(),
      long_format_video: String(body.long_format_video ?? '0').trim(),
      long_format_duration: String(body.long_format_duration ?? '').trim(),
      short_format_video: String(body.short_format_video ?? '0').trim(),
      short_format_duration: String(body.short_format_duration ?? '').trim(),
      teaser_edit: String(body.teaser_edit ?? '0').trim(),
      thumbnail_edit: String(body.thumbnail_edit ?? '0').trim(),
      cost: String(body.cost ?? '').trim(),
      camera: String(body.camera ?? '').trim(),
      record_time: String(body.record_time ?? '').trim(),
      studio_time: String(body.studio_time ?? '').trim(),
      salesperson_name: String(body.salesperson_name ?? '').trim(),
      deliverable_sets: body.deliverable_sets || [],
    };

    // Preserve the regular lead payload unchanged unless an upsell/cross-sell
    // identifier was explicitly supplied.
    const upsellCrossSellId = String(body.upsell_crosssell_id ?? '').trim();
    const outbound = upsellCrossSellId
      ? { ...payload, upsell_crosssell_id: upsellCrossSellId }
      : payload;

    const response = await fetch(PROPOSAL_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(outbound),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.error('n8n send-proposal webhook failed:', response.status, text);
      return NextResponse.json(
        { error: `n8n webhook failed (${response.status}): ${text || 'Unknown error'}` },
        { status: 502 }
      );
    }

    // Save deliverable sets to the UpsellCrossSell entry so they can be fetched later
    if (upsellCrossSellId && body.deliverable_sets) {
      const backendUrl = await getBackendUrl();
      const token = getAccessToken(request.headers);
      if (token) {
        await fetch(`${backendUrl}/upsell-crosssell/${upsellCrossSellId}`, {
          method: 'PATCH',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            deliverable_sets: body.deliverable_sets
          })
        }).catch(err => console.error("Failed to update upsell deliverables:", err));
      }
    }

    const data = await response.json().catch(() => ({}));
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Failed to proxy send-proposal webhook:', error);
    const message = error instanceof Error ? error.message : 'Failed to send proposal';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
