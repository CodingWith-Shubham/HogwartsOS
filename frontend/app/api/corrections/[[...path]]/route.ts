import { NextResponse } from 'next/server';
import { getAuthenticatedUser, getAccessToken } from '@/lib/auth-server';
import { getBackendUrl } from '@/lib/backend-url';

export const dynamic = 'force-dynamic';

async function handleProxy(request: Request, params: { path?: string[] }) {
  try {
    const user = getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const BACKEND_URL = await getBackendUrl();
    const token = getAccessToken();
    const { searchParams } = new URL(request.url);
    const qs = searchParams.toString();
    
    // Construct the backend URL
    const pathSegment = params.path ? params.path.join('/') : '';
    const targetUrl = `${BACKEND_URL}/corrections${pathSegment ? `/${pathSegment}` : ''}${qs ? `?${qs}` : ''}`;
    
    // Get body if not GET/HEAD
    let body;
    if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
      body = await request.text();
    }

    const res = await fetch(targetUrl, {
      method: request.method,
      headers: {
        'Content-Type': request.headers.get('content-type') || 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body,
      cache: 'no-store',
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        return NextResponse.json(data, { status: res.status });
    }
    return NextResponse.json(data.data || data);

  } catch (error) {
    console.error('Corrections proxy error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(request: Request, { params }: { params: { path?: string[] } }) { return handleProxy(request, params); }
export async function POST(request: Request, { params }: { params: { path?: string[] } }) { return handleProxy(request, params); }
export async function PATCH(request: Request, { params }: { params: { path?: string[] } }) { return handleProxy(request, params); }
