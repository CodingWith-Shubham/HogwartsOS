import { NextResponse } from 'next/server';
import { getBackendUrl } from '@/lib/backend-url';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const headers = request.headers; 
    // Public route, so we get the token from Authorization header or URL query
    const authHeader = headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const backendUrl = await getBackendUrl(); 
    const contentType = headers.get('content-type') || '';
    const isMultipart = contentType.includes('multipart/form-data');
    
    if (!isMultipart) {
      return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 });
    }
    
    const formData = await request.formData();
    
    const res = await fetch(`${backendUrl}/client-profiles/public/upload-attachment`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        // Do NOT set Content-Type header manually for fetch with FormData.
      },
      body: formData,
    });
    
    const data = await res.json();
    if (!res.ok || !data.success) {
      return NextResponse.json({ error: data.message || 'Upload failed' }, { status: res.status });
    }
    
    return NextResponse.json(data.data);
  } catch (error) { 
    console.error('Public upload proxy failed:', error); 
    return NextResponse.json({ error: 'Failed to upload attachment' }, { status: 500 }); 
  }
}
