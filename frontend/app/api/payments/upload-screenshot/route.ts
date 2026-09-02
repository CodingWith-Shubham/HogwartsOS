import { NextResponse } from 'next/server';
import { getAuthenticatedUser, getAccessToken } from '@/lib/auth-server';
import { getBackendUrl } from '@/lib/backend-url';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const headers = request.headers; 
    if (!getAuthenticatedUser(headers)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const backendUrl = await getBackendUrl(); 
    const token = getAccessToken(headers); 
    const contentType = headers.get('content-type') || '';
    const isMultipart = contentType.includes('multipart/form-data');
    
    if (!isMultipart) {
      return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 });
    }
    
    const formData = await request.formData();
    
    const res = await fetch(`${backendUrl}/payments/upload-screenshot`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });
    
    const data = await res.json();
    if (!res.ok || !data.success) {
      return NextResponse.json({ error: data.message || 'Upload failed' }, { status: res.status });
    }
    
    return NextResponse.json(data);
  } catch (error) { 
    console.error('Upload proxy failed:', error); 
    return NextResponse.json({ error: 'Failed to upload screenshot' }, { status: 500 }); 
  }
}
