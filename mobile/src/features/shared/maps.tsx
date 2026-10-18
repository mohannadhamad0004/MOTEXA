import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import { Button } from "../../components/ui/Button";
import { Skeleton } from "../../components/ui/Skeleton";
import { Text } from "../../components/ui/Text";
import { useL } from "../../core/hooks/useL";
import { useTheme } from "../../theme/useTheme";
import { Point, roundPoint } from "../../core/constants/geo";

// Maps: Leaflet + OpenStreetMap tiles inside a WebView (runs in Expo Go; no Google key, no native map module).
// Every map is small and optional: the screens always have the text too. Web has no WebView map, so maps.web.tsx
// replaces this file there.

export const MAPS_AVAILABLE = true;

export type Pin = { id: string; name: string; lat: number; lng: number; free: boolean };

type Kind = "free" | "busy" | "selected" | "pin" | "a" | "b";
type MapData = {
  mode: "companies" | "pin" | "trip";
  pins: { id: string; name: string; lat: number; lng: number; kind: Kind }[];
  me: Point | null;
  /** the single pin can be dragged, and a tap on the map moves it */
  movable: boolean;
  /** changes when the set of points changes: the map re-fits to them */
  fitKey: string;
  theme: { accent: string; busy: string; bg: string };
};

const LEAFLET = "1.9.4"; // pinned
const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = "© OpenStreetMap contributors";

const PAGE = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@${LEAFLET}/dist/leaflet.css">
<style>
html,body,#map{margin:0;height:100%;width:100%;background:#2D1F18}
.leaflet-container{font:11px/1.4 sans-serif;-webkit-tap-highlight-color:transparent}
.leaflet-control-attribution{background:rgba(255,255,255,.85)!important;color:#333;padding:1px 6px}
.pin{display:flex;align-items:center;justify-content:center;border-radius:50%;border:3px solid #fff;
 box-shadow:0 1px 5px rgba(0,0,0,.5);color:#fff;font:700 12px sans-serif;box-sizing:border-box}
.dot{width:16px;height:16px;border-radius:50%;background:#2F7BFF;border:3px solid #fff;box-shadow:0 0 0 6px rgba(47,123,255,.25)}
</style></head><body><div id="map"></div>
<script src="https://unpkg.com/leaflet@${LEAFLET}/dist/leaflet.js"></script>
<script>
function post(m){window.ReactNativeWebView.postMessage(JSON.stringify(m));}
var map=null,layer=null,meMarker=null,tilesOk=0,tilesBad=0,lastFit="",data=null,failed=false;
function fail(){if(!failed){failed=true;post({type:"tilesfailed"});}}
function recover(){tilesBad=0;if(failed||tilesOk===1){failed=false;post({type:"tiles"});}}
if(typeof L==="undefined"){post({type:"libfailed"});}
else{
  map=L.map("map",{zoomControl:false,attributionControl:false,tap:true}).setView([32.0,35.2],8);
  var tiles=L.tileLayer("${TILE_URL}",{maxZoom:19,attribution:"${ATTRIBUTION}"}).addTo(map);
  L.control.attribution({prefix:false}).addAttribution("${ATTRIBUTION}").addTo(map);
  L.control.zoom({position:"topright"}).addTo(map);
  layer=L.layerGroup().addTo(map);
  tiles.on("tileload",function(){tilesOk++;recover();});
  tiles.on("tileerror",function(){tilesBad++;if(tilesBad>=4)fail();});
  setTimeout(function(){if(tilesOk===0)fail();},9000);
  map.on("click",function(e){if(data&&data.movable)post({type:"move",lat:e.latlng.lat,lng:e.latlng.lng});});
  post({type:"init"});
}
function icon(kind,t,label){
  var size=kind==="pin"?30:kind==="selected"?32:26;
  var bg=kind==="busy"?t.busy:kind==="selected"?"#C8372D":t.accent;
  var html='<div class="pin" style="width:'+size+'px;height:'+size+'px;background:'+bg+'">'+(label||"")+'</div>';
  return L.divIcon({html:html,className:"",iconSize:[size,size],iconAnchor:[size/2,size/2]});
}
window.setData=function(d){
  if(!map)return;
  data=d;document.body.style.background=d.theme.bg;
  layer.clearLayers();
  var pts=[];
  d.pins.forEach(function(p){
    var m=L.marker([p.lat,p.lng],{icon:icon(p.kind,d.theme,p.kind==="a"?"A":p.kind==="b"?"B":""),title:p.name,
      draggable:d.movable&&p.kind==="pin",keyboard:false});
    if(d.mode==="companies")m.on("click",function(){post({type:"select",id:p.id});});
    if(d.movable&&p.kind==="pin")m.on("dragend",function(){var ll=m.getLatLng();post({type:"move",lat:ll.lat,lng:ll.lng});});
    m.addTo(layer);pts.push([p.lat,p.lng]);
  });
  if(meMarker){map.removeLayer(meMarker);meMarker=null;}
  if(d.me){meMarker=L.marker([d.me.lat,d.me.lng],{icon:L.divIcon({html:'<div class="dot"></div>',className:"",iconSize:[16,16],iconAnchor:[8,8]}),interactive:false,keyboard:false}).addTo(map);pts.push([d.me.lat,d.me.lng]);}
  if(d.mode==="pin"){
    var ll=L.latLng(d.pins[0].lat,d.pins[0].lng);
    if(lastFit===""){map.setView(ll,15);}else if(!map.getBounds().contains(ll)){map.flyTo(ll,map.getZoom(),{duration:.25});}
    lastFit="pin";
  }else if(d.fitKey!==lastFit){
    lastFit=d.fitKey;
    if(pts.length>1)map.fitBounds(pts,{padding:[34,34],maxZoom:15});
    else if(pts.length===1)map.setView(pts[0],14);
  }
};
</script></body></html>`;

const SOURCE = { html: PAGE, baseUrl: "https://motexa.app/" }; // a real https origin so tile servers get a Referer

function LeafletMap({
  height,
  data,
  onSelect,
  onMove,
  onFailedChange,
}: {
  height: number;
  data: MapData;
  onSelect?: (id: string) => void;
  onMove?: (p: Point) => void;
  /** true while the map is showing its "could not load" box, so a screen can fall back to its list */
  onFailedChange?: (failed: boolean) => void;
}) {
  const { c, r } = useTheme();
  const { t } = useL();
  const ref = useRef<WebView>(null);
  const [inited, setInited] = useState(false);
  const initRef = useRef(false);
  const [tiles, setTiles] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const json = useMemo(() => JSON.stringify(data), [data]);
  const dataRef = useRef(data);
  dataRef.current = data;

  // Push the current data into the page once it is initialised, and again whenever it changes.
  useEffect(() => {
    if (inited) ref.current?.injectJavaScript(`window.setData(${json});true;`);
  }, [inited, json]);

  // The page never reported in (no internet for the Leaflet files): same message as failed tiles.
  useEffect(() => {
    const h = setTimeout(() => {
      if (!initRef.current) setFailed(true);
    }, 12000);
    return () => clearTimeout(h);
  }, [attempt]);

  useEffect(() => onFailedChange?.(failed && !tiles), [failed, tiles, onFailedChange]);

  const retry = () => {
    initRef.current = false;
    setInited(false);
    setTiles(false);
    setFailed(false);
    setAttempt((n) => n + 1);
  };

  const onMessage = useCallback(
    (e: WebViewMessageEvent) => {
      // The page is ours, but every message is treated as untrusted input: exact shapes only.
      let m: unknown;
      try {
        m = JSON.parse(e.nativeEvent.data);
      } catch {
        return;
      }
      if (typeof m !== "object" || m === null) return;
      const msg = m as Record<string, unknown>;
      const cur = dataRef.current;
      switch (msg.type) {
        case "init":
          initRef.current = true;
          setInited(true);
          break;
        case "tiles":
          setTiles(true);
          setFailed(false);
          break;
        case "tilesfailed":
        case "libfailed":
          setFailed(true);
          break;
        case "select":
          if (typeof msg.id === "string" && cur.mode === "companies" && cur.pins.some((p) => p.id === msg.id)) onSelect?.(msg.id);
          break;
        case "move":
          if (cur.movable && typeof msg.lat === "number" && typeof msg.lng === "number" && Math.abs(msg.lat) <= 90 && Math.abs(msg.lng) <= 180)
            onMove?.(roundPoint({ lat: msg.lat, lng: msg.lng }));
          break;
      }
    },
    [onSelect, onMove]
  );

  return (
    <View style={{ height, borderRadius: r.md + 2, overflow: "hidden", borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, marginBottom: 12 }}>
      <WebView
        key={attempt}
        ref={ref}
        source={SOURCE}
        originWhitelist={["*"]}
        // Only our own page may be the top-level document: block any navigation away from it.
        onShouldStartLoadWithRequest={(req) => req.url.startsWith(SOURCE.baseUrl) || req.url === "about:blank"}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        nestedScrollEnabled
        setSupportMultipleWindows={false}
        onMessage={onMessage}
        onError={() => setFailed(true)}
        onHttpError={() => undefined}
        style={{ flex: 1, backgroundColor: "transparent" }}
      />
      {!tiles && !failed ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Skeleton width="100%" height={height} radius={0} />
        </View>
      ) : null}
      {failed && !tiles ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: c.surface, alignItems: "center", justifyContent: "center", padding: 18, gap: 8 }]}>
          <Ionicons name="cloud-offline-outline" size={26} color={c.textDim} />
          <Text style={{ color: c.textMuted, fontSize: 12, textAlign: "center" }}>
            {t("The map could not load. Check your internet connection. The list below still works.", "تعذّر تحميل الخريطة. تحقق من اتصال الإنترنت. القائمة تعمل كالمعتاد.")}
          </Text>
          <Button label={t("Retry", "إعادة المحاولة")} variant="ghost" size="sm" icon="refresh-outline" onPress={retry} />
        </View>
      ) : null}
      {failed && tiles ? (
        <View style={{ position: "absolute", left: 8, right: 8, top: 8, flexDirection: "row", alignItems: "center", gap: 8, padding: 8, borderRadius: 12, backgroundColor: c.surface, borderWidth: 1, borderColor: c.dangerBorder }}>
          <Text style={{ color: c.danger, fontSize: 11, flex: 1 }}>{t("Part of the map could not load.", "تعذّر تحميل جزء من الخريطة.")}</Text>
          <Button label={t("Reload", "إعادة تحميل")} variant="ghost" size="sm" onPress={retry} />
        </View>
      ) : null}
    </View>
  );
}

function useMapTheme() {
  const { c } = useTheme();
  return useMemo(() => ({ accent: c.accent, busy: "#8D8178", bg: c.surface }), [c.accent, c.surface]);
}

/** Tow companies as pins (the selected one is highlighted), and your own position as a blue dot. */
export function CompaniesMap({
  pins,
  me,
  selectedId,
  onSelect,
  onFailedChange,
  height = 320,
}: {
  pins: Pin[];
  me: Point | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onFailedChange?: (failed: boolean) => void;
  height?: number;
}) {
  const theme = useMapTheme();
  // pins / me are rebuilt on every render, so the memo is keyed on their full serialized content (ids and names too).
  const pinsKey = JSON.stringify(pins);
  const meKey = me ? JSON.stringify(me) : "";
  const fitKey = pins.map((p) => `${p.lat},${p.lng}`).join("|") + (me ? `|${me.lat},${me.lng}` : "");
  const data = useMemo<MapData>(
    () => ({
      mode: "companies",
      pins: (JSON.parse(pinsKey) as Pin[]).map((p) => ({ id: p.id, name: p.name, lat: p.lat, lng: p.lng, kind: p.id === selectedId ? "selected" : p.free ? "free" : "busy" })),
      me: meKey ? (JSON.parse(meKey) as Point) : null,
      movable: false,
      fitKey,
      theme,
    }),
    [pinsKey, meKey, selectedId, fitKey, theme]
  );
  return <LeafletMap height={height} data={data} onSelect={onSelect} onFailedChange={onFailedChange} />;
}

/** One movable pin. Tap the map or drag the pin to move it. */
export function PinMap({ point, onChange, height = 200 }: { point: Point; onChange?: (p: Point) => void; height?: number }) {
  const theme = useMapTheme();
  const data = useMemo<MapData>(
    () => ({ mode: "pin", pins: [{ id: "pin", name: "", lat: point.lat, lng: point.lng, kind: "pin" }], me: null, movable: !!onChange, fitKey: "pin", theme }),
    [point.lat, point.lng, onChange, theme]
  );
  return <LeafletMap height={height} data={data} onMove={onChange} />;
}

/** Pickup (and, when there is one, destination) of a tow request. Read only. */
export function TripMap({ pickup, dropoff, height = 200 }: { pickup: Point; dropoff?: Point | null; height?: number }) {
  const theme = useMapTheme();
  const data = useMemo<MapData>(() => {
    const pins: MapData["pins"] = [{ id: "a", name: "A", lat: pickup.lat, lng: pickup.lng, kind: "a" }];
    if (dropoff) pins.push({ id: "b", name: "B", lat: dropoff.lat, lng: dropoff.lng, kind: "b" });
    return { mode: "trip", pins, me: null, movable: false, fitKey: pins.map((p) => `${p.lat},${p.lng}`).join("|"), theme };
  }, [pickup.lat, pickup.lng, dropoff?.lat, dropoff?.lng, theme]);
  return <LeafletMap height={height} data={data} />;
}
