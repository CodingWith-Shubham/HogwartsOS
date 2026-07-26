/**
 * Backend URL resolver with localhost-first, VPS-fallback strategy.
 *
 * Priority:
 *  1. NEXT_PUBLIC_BACKEND_URL env var (if explicitly set)
 *  2. http://127.0.0.1:8000/api/v1 (local dev)  ← tried first at runtime
 *  3. https://api.hogwartsstudios.com/api/v1     ← VPS fallback
 */

const LOCAL_BACKEND = 'http://127.0.0.1:8000/api/v1';
const VPS_BACKEND = 'https://api.hogwartsstudios.com/api/v1';

let _resolvedUrl: string | null = null;

/**
 * Returns the base backend URL.
 * On first call it pings localhost; if unreachable it falls back to VPS.
 * The result is cached for the lifetime of the server process.
 */
export async function getBackendUrl(): Promise<string> {
  // If an explicit env override is set, always use it (no fallback needed).
  if (process.env.NEXT_PUBLIC_BACKEND_URL) {
    return process.env.NEXT_PUBLIC_BACKEND_URL;
  }

  // Return cached value after first resolution
  if (_resolvedUrl) return _resolvedUrl;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500); // 1.5s timeout
    await fetch(`${LOCAL_BACKEND}/healthcheck`, {
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timeout);
    console.log('[backend-url] ✅ Using local backend:', LOCAL_BACKEND);
    _resolvedUrl = LOCAL_BACKEND;
  } catch {
    console.log('[backend-url] ⚠️  Local backend unreachable, falling back to VPS:', VPS_BACKEND);
    _resolvedUrl = VPS_BACKEND;
  }

  return _resolvedUrl;
}

/**
 * Resets the cached resolved URL.
 * Call this if you want the next request to re-probe localhost.
 */
export function resetBackendUrlCache() {
  _resolvedUrl = null;
}
