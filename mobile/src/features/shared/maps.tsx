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

type Kind = "free" | "busy" | "selected" | "pin" | "a" | "b" | "tow" | "mech";
type MapData = {
  mode: "companies" | "pin" | "trip" | "service";
  pins: { id: string; name: string; lat: number; lng: number; kind: Kind; dim?: boolean }[];
  me: Point | null;
  // service mode (the full-screen Tow / Mechanics map pages)
  selectedId?: string | null;
  route?: { coords: [number, number][]; dashed: boolean; key?: string } | null;
  pickup?: Point | null;
  movePickup?: boolean;
  /** motion, triggered from React Native: sonar while really searching, one highlight of the nearest pin, reduced motion */
  anim?: { radar: boolean; reduced: boolean; hl: { id: string; key: string } | null };
  /** hero preview: no gestures, no zoom buttons, smaller pins, one sonar ring */
  mini?: boolean;
  /** points the map fits itself to when `fitKey` changes, kept clear of the overlays by `pad` */
  fit?: [number, number][];
  pad?: { top: number; bottom: number; left: number; right: number };
  focus?: { lat: number; lng: number; key: string; zoom?: number } | null;
  /** the single pin can be dragged, and a tap on the map moves it */
  movable: boolean;
  /** changes when the set of points changes: the map re-fits to them */
  fitKey: string;
  theme: { accent: string; busy: string; bg: string; route?: string };
  /** px kept free at the bottom (attribution moves up) when a sheet overlaps the map */
  bottomInset?: number;
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
.leaflet-bottom{margin-bottom:var(--bi,0px)}
.hide-attr .leaflet-control-attribution{display:none}
.hide-attr .leaflet-top.leaflet-right{top:auto;bottom:calc(var(--bi,0px) + 28px)}
.dot{position:relative;width:16px;height:16px;border-radius:50%;background:#2F7BFF;border:3px solid #fff;box-sizing:border-box;box-shadow:0 0 0 6px rgba(47,123,255,.25)}
.dot.pulse::after{content:"";position:absolute;left:-3px;top:-3px;width:16px;height:16px;border-radius:50%;border:2px solid #2F7BFF;animation:pl 2s ease-out infinite}
@keyframes pl{0%{transform:scale(.6);opacity:.8}100%{transform:scale(2.6);opacity:0}}
.svc{display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.55);box-sizing:border-box}
.svc svg{transform:rotate(45deg);width:18px;height:18px}
.svc.sel{width:44px;height:44px;box-shadow:0 0 0 4px rgba(224,163,111,.55),0 1px 8px rgba(0,0,0,.6)}
.svc.sel svg{width:22px;height:22px}
.svc{position:relative}
.svc.pin-in{animation:pinIn .27s cubic-bezier(.2,0,0,1) both}
@keyframes pinIn{from{opacity:0;transform:rotate(-45deg) scale(.8)}to{opacity:1;transform:rotate(-45deg) scale(1)}}
@keyframes fadeOnly{from{opacity:0}to{opacity:1}}
.rm .svc.pin-in{animation:fadeOnly .15s linear both}
.svc.hl{transform:rotate(-45deg) scale(1.12)}
.svc.hl::before{content:"";position:absolute;left:-9px;top:-9px;right:-9px;bottom:-9px;border-radius:50% 50% 50% 0;border:3px solid #E0A36F;opacity:.95}
.svc.hl.go{animation:hlPop .45s cubic-bezier(.2,0,0,1)}
.svc.hl.go::before{animation:ringOut .45s cubic-bezier(.2,0,0,1)}
@keyframes hlPop{0%{transform:rotate(-45deg) scale(1)}60%{transform:rotate(-45deg) scale(1.22)}100%{transform:rotate(-45deg) scale(1.12)}}
@keyframes ringOut{0%{opacity:0;transform:scale(.8)}100%{opacity:.95;transform:scale(1)}}
.rm .svc.hl.go,.rm .svc.hl.go::before{animation:none}
.meWrap{position:relative;width:16px;height:16px}
.meWrap .ring{position:absolute;left:-3px;top:-3px;width:16px;height:16px;border-radius:50%;border:2px solid #2F7BFF;opacity:0;pointer-events:none}
.radar .ring{animation:sonar 1.4s cubic-bezier(.2,0,0,1) infinite}
.radar .ring.r2{animation-delay:.45s}
.radar .ring.r3{animation-delay:.9s}
@keyframes sonar{0%{transform:scale(.6);opacity:.8}100%{transform:scale(7);opacity:0}}
.dot.in{animation:dotIn .27s cubic-bezier(.2,0,0,1) both}
@keyframes dotIn{from{transform:scale(.7);opacity:0}to{transform:scale(1);opacity:1}}
.rm .dot.in{animation:fadeOnly .15s linear both}
.rm .radar .ring{animation:none}
.mini .leaflet-control-zoom{display:none}
.mini .svc{width:24px;height:24px;border-width:2px}
.mini .svc svg{width:12px;height:12px}
.mini .ring.r2,.mini .ring.r3{display:none}
.mini .dot{width:12px;height:12px}
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
  map.on("click",function(e){if(data&&data.mode==="service")post({type:"background"});else if(data&&data.movable)post({type:"move",lat:e.latlng.lat,lng:e.latlng.lng});});
  post({type:"init"});
}
function icon(kind,t,label){
  var size=kind==="pin"?30:kind==="selected"?32:26;
  var bg=kind==="busy"?t.busy:kind==="selected"?"#C8372D":t.accent;
  var html='<div class="pin" style="width:'+size+'px;height:'+size+'px;background:'+bg+'">'+(label||"")+'</div>';
  return L.divIcon({html:html,className:"",iconSize:[size,size],iconAnchor:[size/2,size/2]});
}
var GLYPH={tow:'<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 16V11H8L10 7H14V16M14 13H22V16"/><circle cx="7" cy="17" r="2"/><circle cx="18" cy="17" r="2"/></svg>',mech:'<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 6a4 4 0 0 0 5 5L11 19a2 2 0 0 1-3-3Z"/></svg>'};
var MINI=false;
function svcIcon(p,sel,t,cls,delay){
  var bg=p.dim?t.busy:t.accent,size=MINI?(sel?30:24):(sel?44:36);
  return L.divIcon({html:'<div class="svc'+(sel?' sel':'')+(cls||'')+'" style="background:'+bg+(delay!=null?';animation-delay:'+delay+'ms':'')+'">'+GLYPH[p.kind]+'</div>',className:"",iconSize:[size,size],iconAnchor:[size/2,size]});
}
var lastFocus="",seen={},lastHlKey="",lastRouteKey="",miniDone=false;
function service(d){
  var an=d.anim||{radar:false,reduced:false,hl:null},order=0,hlUsed=false;
  d.pins.forEach(function(p){
    var cls="",delay=null;
    if(!seen[p.id]){seen[p.id]=1;cls+=" pin-in";delay=order++*35;}
    if(an.hl&&an.hl.id===p.id){cls+=" hl";if(an.hl.key!==lastHlKey){cls+=" go";hlUsed=true;}}
    var m=L.marker([p.lat,p.lng],{icon:svcIcon(p,p.id===d.selectedId,d.theme,cls,delay),title:p.name,keyboard:false,interactive:!d.mini,zIndexOffset:(p.id===d.selectedId||(an.hl&&an.hl.id===p.id))?1000:0});
    m.on("click",function(){post({type:"select",id:p.id});});
    m.addTo(layer);
  });
  if(hlUsed)lastHlKey=an.hl.key;
  if(d.route&&d.route.coords.length>1){
    var pl=L.polyline(d.route.coords,{color:d.theme.route||d.theme.accent,weight:5,opacity:.95,lineCap:"round",dashArray:d.route.dashed?"8 10":null}).addTo(layer);
    var rk=d.route.key||"";
    if(rk!==lastRouteKey){
      lastRouteKey=rk;
      var pe=pl.getElement();
      if(pe){
        if(an.reduced||d.route.dashed){pe.style.opacity=0;pe.getBoundingClientRect();pe.style.transition="opacity "+(an.reduced?.15:.8)+"s linear";pe.style.opacity=.95;}
        else if(pe.getTotalLength){
          var len=pe.getTotalLength();
          pe.style.strokeDasharray=len;pe.style.strokeDashoffset=len;pe.getBoundingClientRect();
          pe.style.transition="stroke-dashoffset .8s cubic-bezier(.2,0,0,1)";pe.style.strokeDashoffset=0;
          setTimeout(function(){pe.style.strokeDasharray="";pe.style.transition="";},900);
        }
      }
    }
  }
  if(d.pickup){
    var pm=L.marker([d.pickup.lat,d.pickup.lng],{icon:icon("a",d.theme,"A"),draggable:!!d.movePickup,keyboard:false,zIndexOffset:900}).addTo(layer);
    if(d.movePickup)pm.on("dragend",function(){var ll=pm.getLatLng();post({type:"pickup",lat:ll.lat,lng:ll.lng});});
  }
  if(d.me){
    if(!meMarker){meMarker=L.marker([d.me.lat,d.me.lng],{icon:L.divIcon({html:'<div class="meWrap"><i class="ring"></i><i class="ring r2"></i><i class="ring r3"></i><div class="dot pulse in"></div></div>',className:"",iconSize:[16,16],iconAnchor:[8,8]}),interactive:false,keyboard:false}).addTo(map);}
    else meMarker.setLatLng([d.me.lat,d.me.lng]);
    var me_el=meMarker.getElement();if(me_el)me_el.classList.toggle("radar",!!an.radar&&!an.reduced);
  }else if(meMarker){map.removeLayer(meMarker);meMarker=null;}
  var pad=d.pad||{top:0,bottom:0,left:0,right:0};
  if(d.fitKey!==lastFit){
    lastFit=d.fitKey;
    var f=d.fit||[];
    if(f.length>1)map.fitBounds(f,{paddingTopLeft:[pad.left+24,pad.top+24],paddingBottomRight:[pad.right+24,pad.bottom+24],maxZoom:15});
    else if(f.length===1)map.setView(f[0],14);
  }
  if(d.focus&&d.focus.key!==lastFocus){
    lastFocus=d.focus.key;
    map.flyTo([d.focus.lat,d.focus.lng],d.focus.zoom||Math.max(map.getZoom(),14),{duration:.4});
  }
}
window.setData=function(d){
  if(!map)return;
  data=d;document.body.style.background=d.theme.bg;document.documentElement.style.setProperty("--bi",(d.bottomInset||0)+"px");document.body.className=(d.mode==="service"?"hide-attr":"")+(d.anim&&d.anim.reduced?" rm":"")+(d.mini?" mini":"");MINI=!!d.mini;if(d.mini&&!miniDone){miniDone=true;map.dragging.disable();map.touchZoom.disable();map.doubleClickZoom.disable();map.scrollWheelZoom.disable();map.boxZoom.disable();map.keyboard.disable();if(map.tap)map.tap.disable();}
  layer.clearLayers();
  if(d.mode==="service"){service(d);return;}
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
  onBackground,
  onPickup,
  bare = false,
  bottomInset = 0,
}: {
  onBackground?: () => void;
  onPickup?: (p: Point) => void;
  height: number;
  /** no border, radius or bottom margin: the map fills a frame */
  bare?: boolean;
  bottomInset?: number;
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
  const json = useMemo(() => JSON.stringify({ ...data, bottomInset }), [data, bottomInset]);
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
          if (typeof msg.id === "string" && (cur.mode === "companies" || cur.mode === "service") && cur.pins.some((p) => p.id === msg.id)) onSelect?.(msg.id);
          break;
        case "background":
          if (cur.mode === "service") onBackground?.();
          break;
        case "pickup":
          if (cur.mode === "service" && cur.movePickup && typeof msg.lat === "number" && typeof msg.lng === "number" && Math.abs(msg.lat) <= 90 && Math.abs(msg.lng) <= 180)
            onPickup?.(roundPoint({ lat: msg.lat, lng: msg.lng }));
          break;
        case "move":
          if (cur.movable && typeof msg.lat === "number" && typeof msg.lng === "number" && Math.abs(msg.lat) <= 90 && Math.abs(msg.lng) <= 180)
            onMove?.(roundPoint({ lat: msg.lat, lng: msg.lng }));
          break;
      }
    },
    [onSelect, onMove, onBackground, onPickup]
  );

  return (
    <View style={bare ? { height, overflow: "hidden", backgroundColor: c.surface } : { height, borderRadius: r.md + 2, overflow: "hidden", borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, marginBottom: 12 }}>
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
  return useMemo(() => ({ accent: c.accent, busy: "#8D8178", bg: c.surface, route: c.accent }), [c.accent, c.surface]);
}

/** Tow companies as pins (the selected one is highlighted), and your own position as a blue dot. */
export function CompaniesMap({
  pins,
  me,
  selectedId,
  onSelect,
  onFailedChange,
  height = 320,
  bare,
  bottomInset,
}: {
  bare?: boolean;
  bottomInset?: number;
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
  return <LeafletMap height={height} data={data} onSelect={onSelect} onFailedChange={onFailedChange} bare={bare} bottomInset={bottomInset} />;
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
export function TripMap({ pickup, dropoff, height = 200, bare, bottomInset }: { pickup: Point; dropoff?: Point | null; height?: number; bare?: boolean; bottomInset?: number }) {
  const theme = useMapTheme();
  const data = useMemo<MapData>(() => {
    const pins: MapData["pins"] = [{ id: "a", name: "A", lat: pickup.lat, lng: pickup.lng, kind: "a" }];
    if (dropoff) pins.push({ id: "b", name: "B", lat: dropoff.lat, lng: dropoff.lng, kind: "b" });
    return { mode: "trip", pins, me: null, movable: false, fitKey: pins.map((p) => `${p.lat},${p.lng}`).join("|"), theme };
  }, [pickup.lat, pickup.lng, dropoff?.lat, dropoff?.lng, theme]);
  return <LeafletMap height={height} data={data} bare={bare} bottomInset={bottomInset} />;
}

export type ServicePin = { id: string; name: string; lat: number; lng: number; kind: "tow" | "mech"; dim: boolean };

/**
 * The full-screen Tow / Mechanics map: provider pins (a truck or wrench glyph, greyed when unavailable), the selected
 * pin enlarged, your position as a pulsing blue dot, an optional pickup pin (draggable only when `movePickup`) and a
 * route line. Pan, pinch and double-tap never move the pickup pin; only dragging the pin itself does.
 */
export function ServiceMap({
  pins,
  selectedId,
  me,
  pickup,
  movePickup = false,
  route,
  fit,
  fitKey,
  pad,
  focus,
  radar = false,
  highlight = null,
  reduced = false,
  mini = false,
  onSelect,
  onBackground,
  onPickupMove,
  onFailedChange,
  height,
  bottomInset = 0,
}: {
  pins: ServicePin[];
  selectedId: string | null;
  me: Point | null;
  pickup?: Point | null;
  movePickup?: boolean;
  route?: { coords: [number, number][]; dashed: boolean; key?: string } | null;
  fit: [number, number][];
  fitKey: string;
  pad: { top: number; bottom: number; left: number; right: number };
  focus?: { lat: number; lng: number; key: string; zoom?: number } | null;
  /** sonar rings around your dot while a search is really running */
  radar?: boolean;
  /** the nearest valid pin gets one ring + scale highlight when its key is new */
  highlight?: { id: string; key: string } | null;
  reduced?: boolean;
  /** hero preview (see MiniMap) */
  mini?: boolean;
  onSelect: (id: string) => void;
  onBackground: () => void;
  onPickupMove?: (p: Point) => void;
  onFailedChange?: (failed: boolean) => void;
  height: number;
  bottomInset?: number;
}) {
  const theme = useMapTheme();
  const pinsKey = JSON.stringify(pins);
  const data = useMemo<MapData>(
    () => ({
      mode: "service",
      pins: (JSON.parse(pinsKey) as ServicePin[]).map((p) => ({ id: p.id, name: p.name, lat: p.lat, lng: p.lng, kind: p.kind, dim: p.dim })),
      me,
      selectedId,
      pickup: pickup ?? null,
      movePickup,
      route: route ?? null,
      movable: false,
      fit,
      fitKey,
      pad,
      focus: focus ?? null,
      anim: { radar, reduced, hl: highlight },
      mini,
      theme,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pinsKey, JSON.stringify(me), selectedId, JSON.stringify(pickup), movePickup, JSON.stringify(route), JSON.stringify(fit), fitKey, JSON.stringify(pad), JSON.stringify(focus), radar, reduced, JSON.stringify(highlight), mini, theme]
  );
  return <LeafletMap bare height={height} data={data} bottomInset={bottomInset} onSelect={onSelect} onBackground={onBackground} onPickup={onPickupMove} onFailedChange={onFailedChange} />;
}
