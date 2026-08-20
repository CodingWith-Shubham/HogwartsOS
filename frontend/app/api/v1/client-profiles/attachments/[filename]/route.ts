import { NextResponse } from 'next/server';
import { getBackendUrl } from '@/lib/backend-url';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { filename: string } }
) {
  try {
    const backendUrl = await getBackendUrl();
    
    // The backend serves this at GET /api/v1/client-profiles/attachments/:filename
    const res = await fetch(`${backendUrl}/client-profiles/attachments/${params.filename}`, {
      cache: 'no-store'
    });
    
    if (!res.ok) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: res.status });
    }
    
    const buffer = await res.arrayBuffer();
    
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': res.headers.get('content-type') || 'application/octet-stream',
        'Content-Disposition': res.headers.get('content-disposition') || 'inline'
      }
    });
  } catch (error) {
    console.error('Failed to proxy attachment GET:', error);
    return NextResponse.json({ error: 'Failed to fetch attachment' }, { status: 500 });
  }
}
