import { NextResponse } from 'next/server';
import { getBackendUrl } from '@/lib/backend-url';
import { getAuthenticatedUser } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const user = getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { subscription } = await req.json();
    const baseUrl = await getBackendUrl();
    
    // We pass the auth-user header so the backend knows who is subscribing
    const res = await fetch(`${baseUrl}/notifications/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-User': JSON.stringify(user)
      },
      body: JSON.stringify({ subscription })
    });

    if (!res.ok) {
      throw new Error(`Failed to subscribe: ${res.statusText}`);
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in subscription route:', error);
    return NextResponse.json({ error: 'Failed to subscribe' }, { status: 500 });
  }
}
