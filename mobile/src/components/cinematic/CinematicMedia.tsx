import {View} from 'react-native';
import {Image} from 'expo-image';
import {Text} from '../MotexaVisual';
import {automotive} from '../DesignTokens';
import Exterior from '../../../assets/cinematic/placeholders/EXT_HERO';
import Cockpit from '../../../assets/cinematic/placeholders/INT_COCKPIT';
import Dashboard from '../../../assets/cinematic/placeholders/INT_DASH_SCREEN';
import {cinematicConfig,type MediaPath} from './scenes.config';
const placeholders:Record<string,typeof Exterior>={
 'assets/cinematic/placeholders/EXT_HERO.tsx':Exterior,
 'assets/cinematic/placeholders/INT_COCKPIT.tsx':Cockpit,
 'assets/cinematic/placeholders/INT_DASH_SCREEN.tsx':Dashboard,
};
export default function CinematicMedia({path,width,height,name}:{path:MediaPath;width:number;height:number;name:string}){const source=path==='still:EXT_HERO'?cinematicConfig.media.EXT_HERO.path:path;const Art=typeof source==='string'?placeholders[source]:undefined;return <View style={{width,height}}>{Art?<Art width={width} height={height}/>:<Image source={typeof source==='number'?source:{uri:source}} contentFit="cover" transition={0} cachePolicy="memory-disk" style={{width,height}}/>}<View pointerEvents="none" style={{position:'absolute',bottom:7,left:12,right:12}}><Text style={{fontSize:9,lineHeight:15,color:automotive.dark.ink,backgroundColor:automotive.dark.canvas,textAlign:'center'}}>{Art?'PLACEHOLDER: '+name:'REVIEW ASSET: '+name}</Text></View></View>;}
