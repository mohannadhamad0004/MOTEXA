import React from 'react';
import {ImageBackground,StyleSheet,View} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import {Ionicons} from '@expo/vector-icons';
import {useAppearance} from './Appearance';
import {useLanguage} from '../i18n/LanguageContext';
import {Text} from './MotexaVisual';
import {EditorialTitle} from './PremiumUI';

/** Shared photographic opening and ivory curve for workspace and administrator selection. */
export default function CurvedPhotoHero({eyebrow,title,caption,description,icon='person-outline'}:{eyebrow:string;title:string;caption:string;description:string;icon?:keyof typeof Ionicons.glyphMap}){
 const {dark}=useAppearance();const {isArabic:ar}=useLanguage();const paper=dark?'#30231B':'#FFF9EF',ink=dark?'#FFF1DF':'#432D1E',muted=dark?'#D8BE9B':'#80664E';
 return <View><ImageBackground source={require('../../assets/images/motexa-workspace-garage.png')} resizeMode="cover" style={s.photo}>
  <LinearGradient colors={['rgba(20,13,8,.16)','rgba(20,13,8,.3)']} style={StyleSheet.absoluteFill}/>
  <View style={{position:'absolute',top:31,left:ar?undefined:23,right:ar?23:undefined,width:'65%'}}><Text style={{fontSize:8,lineHeight:17,letterSpacing:ar?0:1.7,color:'#E6C6A1',textAlign:ar?'right':'left'}}>{eyebrow}</Text><EditorialTitle accent style={{fontSize:33,lineHeight:41,color:'#FFF4E6',marginTop:8,textAlign:ar?'right':'left'}}>{title}</EditorialTitle></View>
  <View pointerEvents="none" style={[s.curve,{backgroundColor:paper,transform:[{rotate:ar?'-5deg':'5deg'}]}]}/>
 </ImageBackground>
 <View style={[s.caption,{backgroundColor:paper,flexDirection:ar?'row-reverse':'row'}]}><View style={[s.avatar,{backgroundColor:paper,borderColor:dark?'#BD925E':'#B98B54'}]}><Ionicons name={icon} size={28} color={muted}/></View><View style={{flex:1,minWidth:0}}><EditorialTitle accent style={{fontSize:20,lineHeight:29,color:ink,textAlign:ar?'right':'left'}}>{caption}</EditorialTitle><Text style={{fontSize:11,lineHeight:19,color:muted,textAlign:ar?'right':'left'}}>{description}</Text></View></View>
 </View>;
}
const s=StyleSheet.create({photo:{width:'100%',height:232,overflow:'hidden'},curve:{position:'absolute',bottom:-68,left:'-16%',width:'138%',height:116,borderTopLeftRadius:190,borderTopRightRadius:280},caption:{paddingHorizontal:23,paddingTop:0,paddingBottom:17,gap:12,alignItems:'center',minHeight:65},avatar:{width:58,height:58,borderRadius:30,borderWidth:1,marginTop:-27,alignItems:'center',justifyContent:'center'}});
