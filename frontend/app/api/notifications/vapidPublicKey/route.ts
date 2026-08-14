import { NextResponse } from 'next/server';
import { getBackendUrl } from '@/lib/backend-url';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const baseUrl = await getBackendUrl();
    const res = await fetch(`${baseUrl}/notifications/vapidPublicKey`, { cache: 'no-store' });
    if (!res.ok) {
      throw new Error(`Failed to fetch from backend: ${res.statusText}`);
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching VAPID public key:', error);
    return NextResponse.json({ error: 'Failed to fetch VAPID public key' }, { status: 500 });
  }
}
