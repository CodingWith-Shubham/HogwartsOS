/**
 * Backend URL resolver.
 * Priority:
 *  1. NEXT_PUBLIC_BACKEND_URL or NEXT_PUBLIC_EXPRESS_API_URL env var (e.g. from .env.local)
 *  2. https://api.hogwartsstudios.com (Default VPS Express backend)
 *
 * Formats URL to consistently include `/api/v1` path prefix for API calls.
 */

const DEFAULT_BACKEND_HOST = 'https://api.hogwartsstudios.com';

export function formatBackendUrl(rawUrl: string): string {
  let url = rawUrl.trim().replace(/\/+$/, '');
  if (!/\/api\/v\d+$/i.test(url)) {
    url = `${url}/api/v1`;
  }
  return url;
}

export function getBackendUrlSync(): string {
  const envUrl = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_EXPRESS_API_URL;
  return formatBackendUrl(envUrl || DEFAULT_BACKEND_HOST);
}

export async function getBackendUrl(): Promise<string> {
  return getBackendUrlSync();
}

export function resetBackendUrlCache() {
  // Kept for backwards compatibility
}

