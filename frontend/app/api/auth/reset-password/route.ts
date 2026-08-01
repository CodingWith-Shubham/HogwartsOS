import { NextResponse } from 'next/server';
import { getBackendUrl } from '@/lib/backend-url';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const token = String(body.token ?? '').trim();
    const newPassword = String(body.newPassword ?? '');

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Password reset token is missing' },
        { status: 400 }
      );
    }

    if (!newPassword || newPassword.length < 8) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 8 characters long' },
        { status: 400 }
      );
    }

    const BACKEND_URL = await getBackendUrl();
    const expressRes = await fetch(`${BACKEND_URL}/auth/reset-password/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPassword }),
    });

    const resData = await expressRes.json();

    if (!expressRes.ok || !resData.success) {
      return NextResponse.json(
        { success: false, error: resData.message || 'Invalid or expired password reset token' },
        { status: expressRes.status || 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: resData.message || 'Password has been reset successfully',
    });
  } catch (error) {
    console.error('Reset Password API Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error connecting to backend' },
      { status: 500 }
    );
  }
}
