/**
 * Typed fetch wrapper for the ReflectAI API.
 *
 * Features:
 * - Includes credentials (httpOnly cookies) on every request.
 * - Normalises error responses into typed ApiError instances.
 * - Handles 204 No Content gracefully.
 * - On 401, automatically attempts a token refresh and retries once.
 *   If the refresh also fails, redirects to /login.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Singleton refresh promise — prevents concurrent refresh races when multiple
// requests get 401 simultaneously.
let _refreshPromise: Promise<boolean> | null = null;

async function tryRefreshToken(): Promise<boolean> {
  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = fetch(`${API_BASE}/api/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    // Body is empty: the backend reads the refresh token from its httpOnly cookie.
    body: JSON.stringify({}),
  })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      _refreshPromise = null;
    });

  return _refreshPromise;
}

async function parseErrorBody(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: unknown };
    if (typeof body.detail === 'string') return body.detail;
    // FastAPI validation errors return detail as an array of objects
    if (Array.isArray(body.detail)) {
      const msgs = body.detail
        .map((e: unknown) =>
          typeof e === 'object' && e !== null && 'msg' in e
            ? String((e as Record<string, unknown>).msg)
            : JSON.stringify(e),
        )
        .join('; ');
      return msgs || `Request failed with status ${response.status}`;
    }
    if (body.detail) return String(body.detail);
  } catch {
    // ignore JSON parse failures
  }
  return `Request failed with status ${response.status}`;
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${path}`;
  const init: RequestInit = {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
  };

  const response = await fetch(url, init);

  // ── 401 handling: attempt token refresh then retry once ─────────────────
  if (response.status === 401) {
    // Don't recurse on auth endpoints themselves
    const isAuthPath = path.includes('/auth/refresh') || path.includes('/auth/login');

    if (!isAuthPath) {
      const refreshed = await tryRefreshToken();

      if (refreshed) {
        // Retry the original request — new access token cookie is now set
        const retry = await fetch(url, init);

        if (retry.status === 204) return undefined as T;

        if (retry.ok) return retry.json() as Promise<T>;

        // Still failing after refresh — fall through to error handling below
        if (retry.status === 401) {
          // Refresh worked but the endpoint still rejects — redirect to login
          if (typeof window !== 'undefined') window.location.href = '/login';
          throw new ApiError(401, 'Session expired. Please sign in again.');
        }

        const retryMsg = await parseErrorBody(retry);
        throw new ApiError(retry.status, retryMsg);
      }

      // Refresh itself failed — session is gone, redirect to login
      if (typeof window !== 'undefined') window.location.href = '/login';
      throw new ApiError(401, 'Session expired. Please sign in again.');
    }

    // It is an auth path — just throw the error
    const msg = await parseErrorBody(response);
    throw new ApiError(401, msg);
  }

  // ── Generic error handling ───────────────────────────────────────────────
  if (!response.ok) {
    const msg = await parseErrorBody(response);
    throw new ApiError(response.status, msg);
  }

  if (response.status === 204) return undefined as T;

  return response.json() as Promise<T>;
}
