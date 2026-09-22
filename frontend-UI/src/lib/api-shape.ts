/**
 * Narrowing helpers for values that came off the network.
 *
 * Every tool page reads a list out of a query payload and hands it straight to
 * `.map`. The shape those payloads are typed as is a *claim*, not a check: the
 * pages used to write
 *
 *     (query.data?.collection || []) as unknown as Playlist[]
 *
 * which asks TypeScript to vouch for an array it has never seen. `|| []`
 * catches the common case — a `{}` body from an error path leaves
 * `collection` undefined — but it lets anything else through, and
 * `as unknown as` then silences the one warning that would have caught it. A
 * response whose `collection` is an object, a string, or `null`-inside-a-list
 * reaches `.map` as if it were an array and takes the page down with a blank
 * screen rather than an empty state.
 *
 * That is not hypothetical: two `{}`-response crashes on the Growth page came
 * from exactly this cast, and the fix there was to check `Array.isArray`
 * before believing the payload. These helpers are that fix, in one place, so
 * every page gets it rather than whichever page someone remembered.
 *
 * What they promise is narrow and worth being precise about: `asArray`
 * guarantees you hold an array, NOT that its elements have the claimed shape.
 * Element-level validation is a different job and would need a schema. What it
 * removes is the whole-payload lie — the class that turns a degraded response
 * into a crash instead of an empty list.
 */

/**
 * The value as an array, or an empty array if it is anything else.
 *
 * @example
 *   const playlists = asArray<Playlist>(playlistsQuery.data?.collection);
 */
export function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/**
 * The value as a record, or `undefined` if it is not a plain object.
 *
 * For payloads read key-by-key rather than iterated — the Growth history and
 * analytics responses, where `data.sessions.length` on a `{}` was the crash.
 * Reading a key off the result is then safe; whether that key holds what you
 * expect is still `asArray`'s job (or a check of your own).
 */
export function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
