/**
 * Local cooldown state for the monetization survey.
 *
 * Server is the source of truth for "already submitted"; localStorage tracks
 * client-side snooze + global cooldown so we don't prompt twice in a session.
 */

const KEY_PREFIX = "sc-toolkit-survey";
const GLOBAL_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

function key(name: string, campaignId: string) {
  return `${KEY_PREFIX}:${campaignId}:${name}`;
}

function safeRead(name: string, campaignId: string): string | null {
  try {
    return localStorage.getItem(key(name, campaignId));
  } catch {
    return null;
  }
}

function safeWrite(name: string, campaignId: string, value: string) {
  try {
    localStorage.setItem(key(name, campaignId), value);
  } catch {
    // ignore quota / privacy errors
  }
}

function readTs(name: string, campaignId: string): number | null {
  const raw = safeRead(name, campaignId);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function isDontShowAgain(campaignId: string): boolean {
  return safeRead("dontShowAgain", campaignId) === "1";
}

export function markDontShowAgain(campaignId: string) {
  safeWrite("dontShowAgain", campaignId, "1");
}

export function isSnoozed(campaignId: string, now = Date.now()): boolean {
  const ts = readTs("snoozeUntil", campaignId);
  return ts !== null && ts > now;
}

export function snooze(campaignId: string, now = Date.now()) {
  safeWrite("snoozeUntil", campaignId, String(now + SNOOZE_MS));
}

export function lastPromptedAt(campaignId: string): number | null {
  return readTs("lastPromptAt", campaignId);
}

export function markPromptedNow(campaignId: string, now = Date.now()) {
  safeWrite("lastPromptAt", campaignId, String(now));
}

export function isWithinGlobalCooldown(campaignId: string, now = Date.now()): boolean {
  const last = lastPromptedAt(campaignId);
  return last !== null && now - last < GLOBAL_COOLDOWN_MS;
}

export function markSubmitted(campaignId: string) {
  safeWrite("submitted", campaignId, "1");
}

export function isSubmittedLocal(campaignId: string): boolean {
  return safeRead("submitted", campaignId) === "1";
}

const DASHBOARD_SESSION_KEY = "sc-toolkit-survey-dashboard-shown";

export function dashboardShownThisSession(): boolean {
  try {
    return sessionStorage.getItem(DASHBOARD_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

export function markDashboardShownThisSession() {
  try {
    sessionStorage.setItem(DASHBOARD_SESSION_KEY, "1");
  } catch {
    // ignore
  }
}
