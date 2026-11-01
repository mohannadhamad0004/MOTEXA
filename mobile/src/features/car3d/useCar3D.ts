// The app side of the viewer protocol (see sceneHtml.ts), shared by the WebView (native) and iframe (web) versions.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReduced } from "../../motion";
import { isModelFile, modelBase64 } from "./car3d";
import type { CarModel } from "./models";

export type Car3DProps = {
  model: CarModel;
  color: string;
  wing: boolean;
  rack: boolean;
  /** drag / pinch / double-tap; off = a preview that only auto-rotates */
  interactive?: boolean;
  bg: string;
};

export function useCar3D(p: Car3DProps, send: (m: object) => void) {
  const reduced = useReduced();
  const [ready, setReady] = useState(false);
  const [shown, setShown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sendRef = useRef(send);
  sendRef.current = send;
  const m = p.model;
  const state = useMemo(
    () => ({
      file: m.file,
      model: { lengthM: m.lengthM, rotateY: m.rotateY, groundOffset: m.groundOffset, paintNodes: m.paintNodes, paintMaterials: m.paintMaterials, wing: m.wing, rack: m.rack },
      color: p.color,
      wing: p.wing,
      rack: p.rack,
      interactive: !!p.interactive,
      autoRotate: true,
      reduced,
      bg: p.bg,
    }),
    [m, p.color, p.wing, p.rack, p.interactive, reduced, p.bg]
  );
  useEffect(() => {
    if (ready) sendRef.current({ type: "state", state });
  }, [ready, state]);

  /** Every message from the page is untrusted: exact shapes only. */
  const onMessage = useCallback((raw: string) => {
    let msg: unknown;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (typeof msg !== "object" || msg === null) return;
    const x = msg as Record<string, unknown>;
    if (x.type === "ready") setReady(true);
    else if (x.type === "shown") setShown(true);
    else if (x.type === "error") setError(typeof x.message === "string" ? x.message : "error");
    else if (x.type === "need" && Array.isArray(x.keys))
      for (const key of x.keys.filter(isModelFile).slice(0, 2))
        modelBase64(key).then(
          (b64) => sendRef.current({ type: "asset", key, b64 }),
          (e) => setError(String(e?.message ?? e))
        );
  }, []);
  const retry = () => {
    setReady(false);
    setShown(false);
    setError(null);
  };
  return { onMessage, shown, error, retry };
}
