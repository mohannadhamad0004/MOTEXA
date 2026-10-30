// Parts shops map, web preview: Expo web has no WebView, so the same kind of Leaflet / OpenStreetMap page runs in an iframe.
// Same props as the native file. Only real, stored coordinates are drawn.
import { createElement, useEffect, useMemo, useRef } from "react";
import { View } from "react-native";

export type MapPin = { id: string; name: string; lat: number; lng: number; dim?: boolean };
export type MapRoute = { coords: [number, number][]; key: string };

const LEAFLET = "1.9.4";
const PAGE = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@${LEAFLET}/dist/leaflet.css">
<style>
html,body,#map{margin:0;height:100%;width:100%;background:#2D1F18}
.leaflet-container{font:11px/1.4 sans-serif}
.shop{display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.55);box-sizing:border-box;background:#7A4B24}
.shop svg{transform:rotate(45deg);width:18px;height:18px}
.shop.sel{width:44px;height:44px;background:#E0A36F;box-shadow:0 0 0 4px rgba(224,163,111,.55),0 1px 8px rgba(0,0,0,.6)}
.shop.sel svg{width:22px;height:22px}
.shop.dim{background:#8D8178}
.me{width:16px;height:16px;border-radius:50%;background:#2F7BFF;border:3px solid #fff;box-sizing:border-box;box-shadow:0 0 0 6px rgba(47,123,255,.25)}
</style></head><body><div id="map"></div>
<script src="https://unpkg.com/leaflet@${LEAFLET}/dist/leaflet.js"></script>
<script>
var G='<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l1.5-5h15L21 9M3 9h18M3 9v1a3 3 0 0 0 6 0M9 10a3 3 0 0 0 6 0M15 10a3 3 0 0 0 6 0M5 12v8h14v-8M10 20v-5h4v5"/></svg>';
var map=L.map("map",{zoomControl:false,attributionControl:true}).setView([32.0,35.2],8),layer=L.layerGroup().addTo(map),lastFit="",lastSel="";
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"© OpenStreetMap contributors"}).addTo(map);
map.on("click",function(){parent.postMessage({motexaMap:"background"},"*");});
window.addEventListener("message",function(e){
  var d=e.data;if(!d||!d.motexaPins)return;
  layer.clearLayers();var pts=[];
  d.pins.forEach(function(p){
    var sel=p.id===d.selectedId,s=sel?44:36;
    var m=L.marker([p.lat,p.lng],{icon:L.divIcon({html:'<div class="shop'+(sel?' sel':'')+(p.dim?' dim':'')+'">'+G+'</div>',className:"",iconSize:[s,s],iconAnchor:[s/2,s]}),title:p.name,zIndexOffset:sel?1000:0}).addTo(layer);
    m.on("click",function(ev){L.DomEvent.stopPropagation(ev);parent.postMessage({motexaMap:"select",id:p.id},"*");});
    pts.push([p.lat,p.lng]);
  });
  if(d.me){L.marker([d.me.lat,d.me.lng],{icon:L.divIcon({html:'<div class="me"></div>',className:"",iconSize:[16,16],iconAnchor:[8,8]}),interactive:false,keyboard:false}).addTo(layer);}
  if(d.route&&d.route.coords.length>1){L.polyline(d.route.coords,{color:"#E0A36F",weight:5,opacity:.95,lineCap:"round"}).addTo(layer);}
  if(d.fitKey!==lastFit){lastFit=d.fitKey;var f=d.route?d.route.coords:pts;if(f.length>1)map.fitBounds(f,{paddingTopLeft:[40,90],paddingBottomRight:[40,d.route?300:60],maxZoom:15});else if(f.length===1)map.setView(f[0],14);}
  if(!d.route&&d.selectedId&&d.selectedId!==lastSel){var s2=d.pins.filter(function(p){return p.id===d.selectedId})[0];if(s2)map.flyTo([s2.lat,s2.lng],Math.max(map.getZoom(),14),{duration:.4});}
  lastSel=d.selectedId||"";
});
parent.postMessage({motexaMap:"ready"},"*");
</script></body></html>`;

export function ShopsMap({ pins, selectedId, onSelect, onBackground, height, me = null, route = null, fitKey = "" }: { pins: MapPin[]; selectedId: string | null; onSelect: (id: string) => void; onBackground: () => void; height: number; bottomInset?: number; me?: { lat: number; lng: number } | null; route?: MapRoute | null; fitKey?: string }) {
  const frame = useRef<HTMLIFrameElement | null>(null);
  const ready = useRef(false);
  const msg = useMemo(() => ({ motexaPins: true, pins, selectedId, me, route, fitKey: route ? `route|${route.key}` : pins.map((p) => p.id).join("|") + fitKey }), [pins, selectedId, me, route, fitKey]);
  const last = useRef(msg);
  last.current = msg;
  const send = () => frame.current?.contentWindow?.postMessage(last.current, "*");
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow || !e.data || typeof e.data !== "object") return;
      const m = e.data as { motexaMap?: string; id?: unknown };
      if (m.motexaMap === "ready") {
        ready.current = true;
        send();
      } else if (m.motexaMap === "select" && typeof m.id === "string" && pins.some((p) => p.id === m.id)) onSelect(m.id);
      else if (m.motexaMap === "background") onBackground();
    };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pins, onSelect, onBackground]);
  useEffect(() => {
    if (ready.current) send();
  }, [msg]);
  return (
    <View style={{ height, backgroundColor: "#2D1F18" }}>
      {createElement("iframe", { ref: frame, srcDoc: PAGE, title: "Parts shops map", style: { border: 0, width: "100%", height: "100%" } })}
    </View>
  );
}
