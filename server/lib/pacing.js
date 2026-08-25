/**
 * Pacing for sequential SoundCloud API writes. SoundCloud's rate limits are
 * undocumented; 300ms between mutating calls is the empirically safe floor
 * used across merge, clone, and bulk operations.
 */
export const SC_WRITE_PACING_MS = 300;

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
