// The 3D car (three.js in ONE WebView). Mounted only while its screen is focused, so leaving the screen disposes the WebGL
// context; the model files stay cached in the app (car3d.ts) and are re-sent on the next mount.
import { useIsFocused } from "expo-router";
import { useRef, useState } from "react";
import { StyleProp, View, ViewStyle } from "react-native";
import { WebView } from "react-native-webview";
import { Overlay } from "./Overlay";
import { CAR3D_HTML } from "./sceneHtml";
import { Car3DProps, useCar3D } from "./useCar3D";

const SOURCE = { html: CAR3D_HTML, baseUrl: "https://motexa.app/" };

export function Car3DView({ style, ...p }: Car3DProps & { style?: StyleProp<ViewStyle> }) {
  const focused = useIsFocused();
  return <View style={[{ overflow: "hidden", backgroundColor: p.bg }, style]}>{focused ? <Viewer {...p} /> : null}</View>;
}

function Viewer(p: Car3DProps) {
  const ref = useRef<WebView>(null);
  const [attempt, setAttempt] = useState(0);
  const v = useCar3D(p, (m) => ref.current?.injectJavaScript(`window.car3d(${JSON.stringify(m)});true;`));
  return (
    <>
      <WebView
        key={attempt}
        ref={ref}
        source={SOURCE}
        originWhitelist={["*"]}
        onShouldStartLoadWithRequest={(req) => req.url.startsWith(SOURCE.baseUrl) || req.url === "about:blank"}
        javaScriptEnabled
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        setSupportMultipleWindows={false}
        onMessage={(e) => v.onMessage(e.nativeEvent.data)}
        onError={() => v.onMessage(JSON.stringify({ type: "error", message: "load" }))}
        style={{ flex: 1, backgroundColor: "transparent" }}
      />
      <Overlay shown={v.shown} error={v.error} onRetry={() => (v.retry(), setAttempt((n) => n + 1))} interactive={!!p.interactive} />
    </>
  );
}
