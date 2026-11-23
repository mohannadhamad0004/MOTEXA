import {useEffect,useRef,useState} from 'react';
import {View} from 'react-native';
import {WebView} from 'react-native-webview';
import {mapHtml,type MapProps} from './workshop-map';
export default function WorkshopMap(p:MapProps){const ref=useRef<WebView>(null),[ready,setReady]=useState(false);useEffect(()=>{if(ready)ref.current?.injectJavaScript(`window.applyMotexaMap(${JSON.stringify(p)});true;`);},[ready,p]);return <View style={{height:290,borderRadius:22,overflow:'hidden'}}><WebView ref={ref} source={{html:mapHtml,baseUrl:'https://motexa.app/'}} originWhitelist={['*']} userAgent="MOTEXA/1.0 (Workshop navigation)" onMessage={e=>{try{const d=JSON.parse(e.nativeEvent.data);if(d.motexaMap==='ready')setReady(true);if(d.motexaMap==='pick'&&Number.isFinite(d.latitude)&&Number.isFinite(d.longitude))p.onPick?.({latitude:d.latitude,longitude:d.longitude});}catch{}}} style={{flex:1,backgroundColor:'#2B231D'}}/></View>;}
