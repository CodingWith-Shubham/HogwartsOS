import { NextResponse } from 'next/server';
import { getBackendUrl } from '@/lib/backend-url';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email ?? '').trim().toLowerCase();

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email or username is required' },
        { status: 400 }
      );
    }

    const BACKEND_URL = await getBackendUrl();
    const expressRes = await fetch(`${BACKEND_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    const resData = await expressRes.json().catch(() => null);

    if (!expressRes.ok || !resData?.success) {
      const errorMsg = resData?.message || resData?.error || 'Failed to send password reset request';
      return NextResponse.json(
        { success: false, error: errorMsg },
        { status: expressRes.status && expressRes.status >= 400 && expressRes.status < 600 ? expressRes.status : 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: resData.message || 'Password reset link has been sent to your email',
    });
  } catch (error) {
    console.error('Forgot Password API Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error connecting to backend' },
      { status: 500 }
    );
  }
}
