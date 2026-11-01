// Web build of the 3D car: the same page in a sandboxed iframe (srcdoc) instead of a WebView.
import { useIsFocused } from "expo-router";
import { createElement, useEffect, useRef, useState } from "react";
import { StyleProp, View, ViewStyle } from "react-native";
import { CAR3D_HTML } from "./sceneHtml";
import { Car3DProps, useCar3D } from "./useCar3D";
import { Overlay } from "./Overlay";

export function Car3DView({ style, ...p }: Car3DProps & { style?: StyleProp<ViewStyle> }) {
  const focused = useIsFocused();
  return <View style={[{ overflow: "hidden", backgroundColor: p.bg }, style]}>{focused ? <Viewer {...p} /> : null}</View>;
}

function Viewer(p: Car3DProps) {
  const ref = useRef<HTMLIFrameElement | null>(null);
  const [attempt, setAttempt] = useState(0);
  const v = useCar3D(p, (m) => ref.current?.contentWindow?.postMessage(JSON.stringify(m), "*"));
  const { onMessage } = v;
  useEffect(() => {
    const on = (e: MessageEvent) => e.source === ref.current?.contentWindow && typeof e.data === "string" && onMessage(e.data);
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, [onMessage]);
  return (
    <>
      {createElement("iframe", { key: attempt, ref, srcDoc: CAR3D_HTML, sandbox: "allow-scripts", title: "3D car", style: { border: 0, width: "100%", height: "100%", pointerEvents: p.interactive ? "auto" : "none" } })}
      <Overlay shown={v.shown} error={v.error} onRetry={() => (v.retry(), setAttempt((n) => n + 1))} interactive={!!p.interactive} />
    </>
  );
}
