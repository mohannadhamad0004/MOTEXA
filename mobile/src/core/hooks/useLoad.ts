import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";

/**
 * Loads on focus and whenever `deps` change. Only the newest load may write state: an older response, or one that
 * finishes after the screen lost focus, is ignored. `reload()` returns the promise so callers can await a refresh.
 * With `pollMs` the screen also re-reads silently every `pollMs` while it is focused (never in the background):
 * a silent read shows no spinner, and if it fails the data already on screen stays.
 */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[], pollMs?: number) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const generation = useRef(0);
  const run = useCallback((silent: boolean) => {
    // A silent read does not supersede a visible load, but a visible load (or blur) supersedes it.
    const mine = silent ? generation.current : ++generation.current;
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    return fn()
      .then((d) => {
        if (mine !== generation.current) return;
        setData(d);
        if (silent) setError(null);
      })
      .catch((e) => {
        if (mine === generation.current && !silent) setError(e?.message ?? "Error");
      })
      .finally(() => {
        if (mine === generation.current && !silent) setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  const reload = useCallback(() => run(false), [run]);
  // Reload whenever the screen regains focus so lists reflect edits made on a pushed screen.
  useFocusEffect(
    useCallback(() => {
      reload();
      const timer = pollMs ? setInterval(() => run(true), pollMs) : null;
      return () => {
        generation.current++;
        if (timer) clearInterval(timer);
      };
    }, [reload, run, pollMs])
  );
  return { data, error, loading, reload };
}
