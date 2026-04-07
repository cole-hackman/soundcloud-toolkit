/**
 * Authenticated fetch wrapper with global 401 interceptor.
 *
 * Every authenticated API call in the app should go through `apiFetch`
 * instead of raw `fetch`. When *any* response comes back 401 the wrapper
 * clears the stale session cookie, resets the in-memory auth state, and
 * redirects the user to /login so they can re-authenticate.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

/** Callback set by AuthProvider so the interceptor can clear React state */
let onSessionExpired: (() => void) | null = null;

/**
 * Register a callback that the 401 interceptor will invoke.
 * Called once from AuthProvider on mount.
 */
export function registerSessionExpiredHandler(handler: () => void) {
  onSessionExpired = handler;
}

/** Avoid redirect storms — only allow one redirect at a time */
let isRedirecting = false;

function handleExpiredSession() {
  if (isRedirecting) return;
  isRedirecting = true;

  // Clear the session cookie from the browser
  document.cookie = "session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";

  // Reset React auth state if handler is registered
  onSessionExpired?.();

  // Redirect to login
  window.location.href = "/login";
}

/**
 * Drop-in replacement for `fetch()` that:
 *  1. Prepends API_BASE automatically
 *  2. Sends credentials: "include" by default
 *  3. Intercepts 401 responses → clears session + redirects to /login
 *
 * Usage:
 *   import { apiFetch } from "@/lib/api";
 *   const res = await apiFetch("/api/playlists");
 */
export async function apiFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;

  const response = await fetch(url, {
    credentials: "include",
    ...init,
    headers: {
      ...init?.headers,
    },
  });

  if (response.status === 401) {
    handleExpiredSession();
  }

  return response;
}
