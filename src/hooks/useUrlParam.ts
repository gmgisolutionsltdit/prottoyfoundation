import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * Two-way syncs one filter value with the URL's query string, so a filtered
 * table view survives navigating away and back, and is bookmarkable/
 * shareable. Drop-in replacement for `useState(defaultValue)` — same
 * `[value, setValue]` shape, string-typed since URL params are strings.
 *
 * When the value equals `defaultValue` the param is removed rather than
 * written as e.g. `?fund=all`, so the URL only carries filters someone
 * actually changed. Uses `replace` so typing in a search box doesn't spam
 * browser history with one entry per keystroke.
 */
export function useUrlParam(key: string, defaultValue: string): [string, (next: string) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const value = searchParams.get(key) ?? defaultValue;

  const setValue = useCallback(
    (next: string) => {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          if (next === defaultValue || next === "") p.delete(key);
          else p.set(key, next);
          return p;
        },
        { replace: true }
      );
    },
    [key, defaultValue, setSearchParams]
  );

  return [value, setValue];
}

/** Same idea, for a numeric filter (e.g. page number) — 1 is treated as the default and omitted. */
export function useUrlNumberParam(key: string, defaultValue: number): [number, (next: number) => void] {
  const [raw, setRaw] = useUrlParam(key, String(defaultValue));
  const value = Number(raw);
  const set = useCallback((next: number) => setRaw(String(next)), [setRaw]);
  return [Number.isFinite(value) ? value : defaultValue, set];
}
