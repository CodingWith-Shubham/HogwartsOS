import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAuthenticatedUser } from '@/lib/auth-server';
import { fetchBackendUsersFromSheet, updateBackendUserInSheet } from '@/lib/google/sheets';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const authenticatedUser = getAuthenticatedUser();
    if (!authenticatedUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Only managers and admins can edit profile details directly
    if (!['manager', 'admin'].includes(authenticatedUser.role)) {
      return NextResponse.json({ success: false, error: 'Forbidden. Please contact a manager to update your account details.' }, { status: 403 });
    }

    const body = await request.json();
    const email = String(body.email ?? '').trim();
    const username = String(body.username ?? '').trim().toLowerCase();
    const password = String(body.password ?? '').trim();

    if (!email) {
      return NextResponse.json({ success: false, error: 'Email cannot be empty' }, { status: 400 });
    }

    if (!username) {
      return NextResponse.json({ success: false, error: 'Username cannot be empty' }, { status: 400 });
    }

    const users = await fetchBackendUsersFromSheet();

    // Check if email or username is already taken by another user
    const emailExists = users.some(
      (u) => u.id !== authenticatedUser.id && u.email.toLowerCase() === email.toLowerCase()
    );
    if (emailExists) {
      return NextResponse.json({ success: false, error: 'Email address is already in use' }, { status: 400 });
    }

    const usernameExists = users.some(
      (u) => u.id !== authenticatedUser.id && u.username.toLowerCase() === username.toLowerCase()
    );
    if (usernameExists) {
      return NextResponse.json({ success: false, error: 'Username is already in use' }, { status: 400 });
    }

    const success = await updateBackendUserInSheet(authenticatedUser.id, {
      email,
      username,
      password: password || undefined,
    });

    if (!success) {
      return NextResponse.json({ success: false, error: 'Failed to update profile or user not found' }, { status: 500 });
    }

    // Retrieve updated user to synchronize the session cookie
    const updatedUsers = await fetchBackendUsersFromSheet();
    const updatedUser = updatedUsers.find((u) => u.id === authenticatedUser.id);
    if (!updatedUser) {
      return NextResponse.json({ success: false, error: 'Error retrieving updated user details' }, { status: 500 });
    }

    const { password: _, ...sanitizedUser } = updatedUser;

    cookies().set('howgarts_session', JSON.stringify(sanitizedUser), {
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
      httpOnly: false,
    });

    return NextResponse.json({ success: true, user: sanitizedUser });
  } catch (error) {
    console.error('Update profile API error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
