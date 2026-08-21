/**
 * Backend URL resolver.
 * Priority:
 *  1. NEXT_PUBLIC_BACKEND_URL or NEXT_PUBLIC_EXPRESS_API_URL env var (e.g. from .env.local)
 *  2. https://api.hogwartsstudios.com (Default VPS Express backend)
 *
 * Formats URL to consistently include `/api/v1` path prefix for API calls.
 */

const DEFAULT_HOSTED_BACKEND = 'https://api.hogwartsstudios.com';
const LOCAL_BACKEND = 'http://127.0.0.1:8000';

let cachedBackendUrl: string | null = null;
let isChecking = false;

export function formatBackendUrl(rawUrl: string): string {
  let url = rawUrl.trim().replace(/\/+$/, '');
  if (!/\/api\/v\d+$/i.test(url)) {
    url = `${url}/api/v1`;
  }
  return url;
}

export function getBackendUrlSync(): string {
  if (process.env.NODE_ENV === 'development') {
    return formatBackendUrl(LOCAL_BACKEND);
  }

  if (cachedBackendUrl) return cachedBackendUrl;
  
  // If we haven't resolved yet, fallback to env var or hosted
  const envUrl = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_EXPRESS_API_URL;
  return formatBackendUrl(envUrl || DEFAULT_HOSTED_BACKEND);
}

export async function getBackendUrl(): Promise<string> {
  if (process.env.NODE_ENV === 'development') {
    return formatBackendUrl(LOCAL_BACKEND);
  }

  if (cachedBackendUrl) return cachedBackendUrl;
  
  if (isChecking) {
     return getBackendUrlSync();
  }
  
  isChecking = true;
  try {
    const localUrl = formatBackendUrl(LOCAL_BACKEND);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 seconds timeout
    
    try {
      // try to hit healthcheck
      const res = await fetch(`${localUrl.replace(/\/api\/v1$/, '')}/api/v1/healthcheck`, { 
        signal: controller.signal 
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        cachedBackendUrl = localUrl;
        return localUrl;
      }
    } catch (err) {
      clearTimeout(timeoutId);
      // Fetch failed, local dev server is likely down
    }
    
    const hostedUrl = formatBackendUrl(DEFAULT_HOSTED_BACKEND);
    cachedBackendUrl = hostedUrl;
    return hostedUrl;
  } finally {
    isChecking = false;
  }
}

export function resetBackendUrlCache() {
  cachedBackendUrl = null;
}

