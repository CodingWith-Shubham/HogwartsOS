import { NextResponse } from 'next/server';
import { getBackendUrl } from '@/lib/backend-url';
import { getAuthenticatedUser, getAccessToken } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const user = getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { subscription } = await req.json();
    const baseUrl = await getBackendUrl();
    const reqHeaders = new Headers(req.headers);
    const token = getAccessToken(reqHeaders);
    
    const headersInit: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headersInit['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${baseUrl}/notifications/subscribe`, {
      method: 'POST',
      headers: headersInit,
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
