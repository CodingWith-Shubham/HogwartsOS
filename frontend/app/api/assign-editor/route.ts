import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

const ASSIGN_EDITOR_WEBHOOK_URL =
  process.env.N8N_ASSIGN_EDITOR_WEBHOOK_URL ??
  'https://n8n.hogwartsstudios.com/webhook/assign-editor';

function value(body: Record<string, unknown>, key: string, fallback = '') {
  return String(body[key] ?? fallback).trim();
}

export async function POST(request: Request) {
  try {
    const user = getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'manager' && user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json() as Record<string, unknown>;
    const shootId = value(body, 'shoot_id');
    const editorName = value(body, 'editor_name');
    const editorEmail = value(body, 'editor_email');
    const dataLink = value(body, 'data_link');

    if (!shootId || !editorName || !editorEmail || !dataLink) {
      return NextResponse.json(
        { error: 'Shoot, editor, editor email, and data link are required' },
        { status: 400 }
      );
    }

    const payload = {
      shoot_id: shootId,
      lead_id: value(body, 'lead_id'),
      client_name: value(body, 'client_name'),
      email_id: value(body, 'email_id'),
      client_email: value(body, 'client_email'),
      data_link: dataLink,
      service_type: value(body, 'service_type'),
      editor_name: editorName,
      editor_email: editorEmail,
      podcast_edit: value(body, 'podcast_edit', '0'),
      teaser_edit: value(body, 'teaser_edit', '0'),
      reel_edit: value(body, 'reel_edit', '0'),
      thumbnail_edit: value(body, 'thumbnail_edit', '0'),
      long_format_video: value(body, 'long_format_video', '0'),
      long_format_duration: value(body, 'long_format_duration'),
      short_format_video: value(body, 'short_format_video', '0'),
      short_format_duration: value(body, 'short_format_duration'),
      additional_product: value(body, 'additional_product'),
      additional_product_quantity: value(body, 'additional_product_quantity', '0'),
      manager_comment: value(body, 'manager_comment'),
    };

    const response = await fetch(ASSIGN_EDITOR_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const details = await response.text().catch(() => '');
      console.error('n8n assign-editor webhook failed:', response.status, details);
      return NextResponse.json({ error: 'Failed to assign editor via automation' }, { status: 502 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to proxy assign-editor webhook:', error);
    const message = error instanceof Error ? error.message : 'Failed to assign editor';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
