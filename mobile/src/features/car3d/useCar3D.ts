// The app side of the viewer protocol (see sceneHtml.ts), shared by the WebView (native) and iframe (web) versions.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {modelForViewer} from "./modelConfig";
import { useReduced } from "../../motion";
import { isModelFile, modelBase64 } from "./car3d";
import { type CarModel, modelFile } from "./models";
import type { FitAdjust } from "./car3d";
import type { AccessoryType, PartLabel, PartMap } from "./modelConfig";

/** One shop accessory on the car (sceneHtml KIT): its published file, real size, paint-to-match and the customer's Adjust. */
export type Kit = { type: AccessoryType; file: string; paintMatch: boolean; adj: FitAdjust; /** rims: the shop's finish (SILVER / BLACK / GUNMETAL / CHROME) */ finish?: string | null; size?: { widthMm?: number | null; lengthMm?: number | null; rimInches?: number | null };
  /** Owner-only preview: authenticated loader, never placed in the public asset cache. */
  assetLoader?: () => Promise<string>;
  /** the stored auto-fit to replay (validated by the viewer; a stale one is ignored and the part is fitted live) */
  fit?: unknown;
  /** the Parts Admin's correction for this car, under the customer's own adj */
  baseAdj?: FitAdjust | null };

export type Car3DProps = {
  model: CarModel;
  /** Screen-owned authenticated loader for private models; assets stay out of the public cache. */
  assetLoader?: () => Promise<string>;
  color: string;
  /** a shop accessory fitted on the car (null = none) */
  kit?: Kit | null;
  /** several at once (a body kit's front + rear bumper); used instead of kit when given */
  kits?: Kit[];
  /** the accessory could not be fitted on this car (the car itself still shows) */
  onFitError?: (message: string, kitType: AccessoryType | null) => void;
  /** Parts Admin zone editor: red = what an accessory of this type hides, green = where it goes (draft zones in model.zones) */
  zonePreview?: AccessoryType | null;
  onZone?: (info: { hidden: number; how: string | null; note: string | null }) => void;
  /** Parts Admin part-map editor: the car in pieces coloured by label (the chosen label bright); a tap reports the piece id */
  /** boxPts set = box mode: a tap reports a point on the car (onBoxPoint); with 4 points the pieces inside are reported (onBoxIds) */
  partEdit?: { label: PartLabel; labels: PartMap; boxPts?: number[][] | null; boxTurn?: boolean } | null;
  onPick?: (pieceId: string) => void;
  onPieces?: (count: number) => void;
  onBoxPoint?: (p: number[]) => void;
  onBoxIds?: (ids: string[]) => void;
  /** a Box-mode tap that did not land on the car */
  onBoxMiss?: () => void;
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
  useEffect(() => { sendRef.current = send; }, [send]);
  const m = p.model;
  const assetLoader = p.assetLoader;
  const privateKits = useMemo(() => p.kits ?? (p.kit ? [p.kit] : []), [p.kit,p.kits]);
  const onFitError = useRef(p.onFitError);
  useEffect(() => { onFitError.current = p.onFitError; }, [p.onFitError]);
  const onZone = useRef(p.onZone);
  useEffect(() => { onZone.current = p.onZone; }, [p.onZone]);
  const onPick = useRef(p.onPick), onPieces = useRef(p.onPieces), onBoxPoint = useRef(p.onBoxPoint), onBoxIds = useRef(p.onBoxIds), onBoxMiss = useRef(p.onBoxMiss);
  useEffect(() => { onPick.current = p.onPick; onPieces.current = p.onPieces; onBoxPoint.current = p.onBoxPoint; onBoxIds.current = p.onBoxIds; onBoxMiss.current = p.onBoxMiss; }, [p.onPick, p.onPieces, p.onBoxPoint, p.onBoxIds, p.onBoxMiss]);
  const state = useMemo(
    () => ({
      file: modelFile(m),
      model: modelForViewer(m),
      kits: p.kits ?? (p.kit ? [p.kit] : []),
      color: p.color,
      zonePreview: p.zonePreview ?? null,
      partEdit: p.partEdit ?? null,
      interactive: !!p.interactive,
      autoRotate: true,
      reduced,
      bg: p.bg,
    }),
    [m, p.color, p.zonePreview, p.partEdit, p.kit, p.kits, p.interactive, reduced, p.bg]
  );
  useEffect(() => {
    if (ready) sendRef.current({ type: "state", state });
  }, [ready, state]);
  useEffect(() => {
    if (shown || error) return;
    const timeout = setTimeout(() => setError("timeout"), 45_000);
    return () => clearTimeout(timeout);
  }, [ready, shown, error]);

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
    else if (x.type === "zone" && typeof x.info === "object" && x.info) {
      const i = x.info as Record<string, unknown>;
      onZone.current?.({ hidden: typeof i.hidden === "number" ? i.hidden : 0, how: typeof i.how === "string" ? i.how.slice(0, 60) : null, note: typeof i.note === "string" ? i.note.slice(0, 300) : null });
    }
    else if (x.type === "pick" && typeof x.id === "string" && /^m\d{1,5}c\d{1,6}$/.test(x.id)) onPick.current?.(x.id);
    else if (x.type === "pieces" && typeof x.count === "number") onPieces.current?.(x.count);
    else if (x.type === "boxPt" && Array.isArray(x.p) && x.p.length === 3 && x.p.every(n => typeof n === "number" && Number.isFinite(n))) onBoxPoint.current?.(x.p as number[]);
    else if (x.type === "boxMiss") onBoxMiss.current?.();
    else if (x.type === "boxIds" && Array.isArray(x.ids) && x.ids.length <= 20000) onBoxIds.current?.(x.ids.filter((id): id is string => typeof id === "string" && /^m\d{1,5}c\d{1,6}$/.test(id)));
    else if (x.type === "fitError") onFitError.current?.(typeof x.message === "string" ? x.message.slice(0, 300) : "fit", typeof x.kitType === "string" ? x.kitType as AccessoryType : null);
    else if (x.type === "error") setError(typeof x.message === "string" ? x.message : "error");
    else if (x.type === "need" && Array.isArray(x.keys))
      for (const key of x.keys.filter((key): key is string => typeof key === "string" && (key === modelFile(m) || isModelFile(key) || privateKits.some(k=>k.file===key&&!!k.assetLoader))).slice(0, 4))
        (key === modelFile(m) && assetLoader ? assetLoader() : privateKits.find(k=>k.file===key)?.assetLoader?.() ?? modelBase64(key)).then(
          (b64) => sendRef.current({ type: "asset", key, b64 }),
          (e) => setError(String(e?.message ?? e))
        );
  }, [m, assetLoader, privateKits]);
  const retry = () => {
    setReady(false);
    setShown(false);
    setError(null);
  };
  return { onMessage, shown, error, retry };
}
