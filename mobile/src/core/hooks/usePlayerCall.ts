// expo-video's useVideoPlayer releases its player on unmount (and when the source changes); a released player rejects every
// call: "Call to function 'VideoPlayer.pause' has been rejected ... Cannot use shared object that was already released".
// Every player call (play, pause, replay, seek / currentTime, replace) goes through here: nothing runs after unmount, and that
// one error is ignored (a cleanup or event landing after the release). Any other error still throws.
import { useCallback, useLayoutEffect, useRef } from "react";

const released = (e: unknown) => /already released/i.test(e instanceof Error ? e.message : String(e));

/** Runs one player call; a player that is already released is ignored. */
export function safePlayerCall<T>(fn: () => T): T | undefined {
  try {
    return fn();
  } catch (e) {
    if (released(e)) return undefined;
    throw e;
  }
}

/** `call(fn)` runs `fn` only while the component is mounted, through safePlayerCall. */
export function usePlayerCall() {
  const mounted = useRef(true);
  // a layout-effect cleanup runs before every passive cleanup, so this flips before useVideoPlayer releases the player
  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return useCallback(<T,>(fn: () => T) => (mounted.current ? safePlayerCall(fn) : undefined), []);
}
