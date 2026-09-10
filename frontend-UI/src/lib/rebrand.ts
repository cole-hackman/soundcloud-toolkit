/**
 * Track Toolkit rebrand — product naming and announcement gating.
 *
 * SoundCloud's API Terms of Use forbid "SoundCloud" in an app's name or its
 * domain, so the product renamed from SoundCloud Toolkit (shown in the UI as
 * "SC Toolkit") to Track Toolkit. References to SoundCloud itself — the
 * platform, the OAuth connection, the API — stay, because those are factual.
 *
 * Both announcements are gated in localStorage only, no server call and no
 * database, exactly like lib/whatsNew.ts: a name change is a one-time notice,
 * not something that needs a per-account record. Per-browser dismissal is the
 * right trade-off — the cost of a user seeing it once more on a second device
 * is far lower than the cost of a round trip and a table.
 *
 * Bump REBRAND_ANNOUNCEMENT_VERSION to re-announce to everyone; the keys are
 * namespaced by it, so an old dismissal never suppresses a new announcement.
 */

export const PRODUCT_NAME = "Track Toolkit";
export const PREVIOUS_PRODUCT_NAME = "SoundCloud Toolkit";

export const REBRAND_ANNOUNCEMENT_VERSION = "2026-09-track-toolkit";

const BANNER_KEY = "track-toolkit-rebrand-banner";
const ACK_KEY = "track-toolkit-rebrand-ack";

/**
 * Fired when the announcement state changes in this tab.
 *
 * The banner and the modal are mounted by different components, so
 * acknowledging the modal has to tell the banner to re-check — otherwise the
 * strip keeps repeating news the user just read, until the next reload. The
 * native `storage` event only fires in OTHER tabs, so it cannot do this job.
 */
export const REBRAND_STATE_EVENT = "track-toolkit:rebrand-state";

function announceChange() {
  try {
    window.dispatchEvent(new Event(REBRAND_STATE_EVENT));
  } catch {
    // no window (prerender) — nothing is listening anyway
  }
}

function readKey(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    // Private mode / blocked storage: treat as "not yet seen". Showing the
    // announcement again is a far better failure than throwing inside render.
    return null;
  }
}

function writeKey(key: string) {
  try {
    localStorage.setItem(key, REBRAND_ANNOUNCEMENT_VERSION);
  } catch {
    // ignore quota / privacy errors — the announcement is not load-bearing
  }
}

/** True once this browser has dismissed the current banner. */
export function isRebrandBannerDismissed(): boolean {
  return readKey(BANNER_KEY) === REBRAND_ANNOUNCEMENT_VERSION;
}

export function dismissRebrandBanner() {
  writeKey(BANNER_KEY);
  announceChange();
}

/**
 * True once the user has acknowledged the announcement modal.
 *
 * Also consulted by the dashboard before it opens "What's new", so the two
 * never stack in one session — see WhatsNewModal and lib/whatsNew.ts.
 */
export function isRebrandAcknowledged(): boolean {
  return readKey(ACK_KEY) === REBRAND_ANNOUNCEMENT_VERSION;
}

export function acknowledgeRebrand() {
  writeKey(ACK_KEY);
  // Acknowledging the full explanation also settles the banner: repeating the
  // same news in a strip across the top of every page afterwards is the
  // "intrusive" failure mode the banner is meant to avoid.
  writeKey(BANNER_KEY);
  announceChange();
}
