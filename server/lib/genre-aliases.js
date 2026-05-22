import { normalizeGenre } from './genre-utils.js';

/**
 * Each equivalence class is a set of normalized strings that should be
 * treated as the same genre for matching purposes.
 */
const EQUIVALENCE_CLASSES = [
  ['drum and bass', 'dnb', 'd b', 'jungle'],
  ['tech house', 'techhouse'],
  ['deep house', 'deephouse'],
  ['future house', 'futurehouse'],
  ['hip hop', 'hiphop', 'rap'],
  ['edm', 'electronic dance music', 'electronic'],
  ['r b', 'rnb', 'r and b', 'rhythm and blues'],
  ['lo fi', 'lofi', 'lo fi hip hop', 'chillhop'],
  ['drum n bass', 'drum and bass', 'dnb'],
  ['indie rock', 'indie'],
];

const LOOKUP = new Map();
for (const cls of EQUIVALENCE_CLASSES) {
  const expanded = new Set();
  for (const member of cls) expanded.add(member);
  for (const member of cls) {
    const existing = LOOKUP.get(member);
    if (existing) {
      for (const e of existing) expanded.add(e);
    }
  }
  for (const member of expanded) LOOKUP.set(member, expanded);
}

/**
 * Expand a genre query to all normalized synonyms.
 * - Returns [] for empty/non-string input.
 * - Returns just [normalized] if no alias is registered.
 * - Otherwise returns every member of the equivalence class (always includes
 *   the normalized input).
 */
export function expandGenreAliases(raw) {
  const normalized = normalizeGenre(raw);
  if (!normalized) return [];
  const cls = LOOKUP.get(normalized);
  if (!cls) return [normalized];
  // Ensure the input itself is present even if not literally in the class.
  return [...new Set([normalized, ...cls])];
}
