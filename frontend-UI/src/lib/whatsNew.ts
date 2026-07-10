/**
 * "What's new" announcement gating — localStorage only, no server/DB.
 *
 * Dismissal is per-browser, which is the right trade-off for a one-time
 * feature announcement (unlike the survey, which needs server truth to record
 * responses). Bump WHATS_NEW_VERSION to re-announce to everyone.
 */

export const WHATS_NEW_VERSION = "2026-07-growth";

const DISMISS_KEY = "sc-toolkit-whatsnew-dismissed";
const SESSION_KEY = "sc-toolkit-whatsnew-shown";

/** True once the user has dismissed the current announcement version. */
export function isWhatsNewDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === WHATS_NEW_VERSION;
  } catch {
    return false;
  }
}

/** Persist dismissal so this version never shows again. */
export function dismissWhatsNew() {
  try {
    localStorage.setItem(DISMISS_KEY, WHATS_NEW_VERSION);
  } catch {
    // ignore quota / privacy errors
  }
}

/** Marks the announcement as shown this session (used to defer the survey). */
export function markWhatsNewShownThisSession() {
  try {
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    // ignore
  }
}

export function whatsNewShownThisSession(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}
