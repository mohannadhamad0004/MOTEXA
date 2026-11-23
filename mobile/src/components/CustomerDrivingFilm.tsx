import {useEffect,useState} from 'react';
import {AppState,Image,StyleSheet,View} from 'react-native';
import {VideoView,useVideoPlayer} from 'expo-video';
import {useReducedMotion} from './MotexaVisual';

/** Local, silent real driving footage. The poster is from this exact clip. */
export default function CustomerDrivingFilm({paused,interior=false}:{paused:boolean;interior?:boolean}){
 const reduced=useReducedMotion(),[active,setActive]=useState(AppState.currentState!=='background'),[ready,setReady]=useState(false),[failed,setFailed]=useState(false);
 const player=useVideoPlayer(interior?require('../../assets/videos/motexa-interior-driving.mp4'):require('../../assets/videos/motexa-driving.mp4'),p=>{p.loop=true;p.muted=true;p.audioMixingMode='mixWithOthers';p.staysActiveInBackground=false;p.keepScreenOnWhilePlaying=false;});
 useEffect(()=>{const sub=AppState.addEventListener('change',s=>setActive(s==='active'));return()=>sub.remove();},[]);
 useEffect(()=>{const sub=player.addListener('statusChange',({status})=>{if(status==='error'){setFailed(true);setReady(false);}});return()=>sub.remove();},[player]);
 useEffect(()=>{try{if(paused||reduced||!active||failed)player.pause();else player.play();}catch{/* Keep the poster visible if playback cannot start. */}return()=>{try{player.pause();}catch{/* Released by the player hook. */}};},[player,paused,reduced,active,failed]);
 return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
  {!failed&&<VideoView testID="customer-driving-film" player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} playsInline allowsPictureInPicture={false} surfaceType="textureView" onFirstFrameRender={()=>setReady(true)}/>}
  {(!ready||failed)&&<Image source={interior?require('../../assets/images/motexa-interior-poster.jpg'):require('../../assets/images/motexa-driving-poster.jpg')} resizeMode="cover" style={StyleSheet.absoluteFill}/>}
 </View>;
}
