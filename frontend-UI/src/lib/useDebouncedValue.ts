"use client";

import { useEffect, useState } from "react";

/**
 * Returns a copy of `value` that only updates after `delayMs` has passed
 * without `value` changing.
 *
 * Use this for search/filter text inputs (and similarly "typed" inputs like
 * a keep-list textarea) so the input itself stays snappy while the
 * expensive derived pipeline that reads it (filter/sort/regex-compile/etc.)
 * only re-runs once the user pauses, instead of on every keystroke.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
