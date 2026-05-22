/**
 * Normalize a genre/tag string for fuzzy matching.
 * Lowercases, replaces non-alphanumerics with spaces, collapses whitespace.
 * Returns null for empty/non-string input.
 */
export function normalizeGenre(raw) {
  if (typeof raw !== 'string') return null;
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || null;
}
