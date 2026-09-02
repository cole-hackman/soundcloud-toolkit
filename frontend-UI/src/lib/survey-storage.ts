/**
 * Local mirror of "this user already voted".
 *
 * The server is the source of truth via /api/feedback/survey/status; this only
 * suppresses the modal instantly after a submit, before the next status fetch.
 *
 * The rebrand vote is mandatory, so the snooze / don't-show-again / re-prompt
 * cooldown helpers this file used to carry are gone — there is no longer any
 * way to dismiss the prompt without voting, and honouring stale dismissals
 * would have let earlier dismissers skip it forever.
 *
 * Keys stay namespaced by campaign id, so a future survey starts clean.
 */

const KEY_PREFIX = "sc-toolkit-survey";

function key(name: string, campaignId: string) {
  return `${KEY_PREFIX}:${campaignId}:${name}`;
}

export function markSubmitted(campaignId: string) {
  try {
    localStorage.setItem(key("submitted", campaignId), "1");
  } catch {
    // ignore quota / privacy errors — the server still has the vote
  }
}

export function isSubmittedLocal(campaignId: string): boolean {
  try {
    return localStorage.getItem(key("submitted", campaignId)) === "1";
  } catch {
    return false;
  }
}
