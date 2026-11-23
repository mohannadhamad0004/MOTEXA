import type {ReactNode} from 'react';
import {View,Image,type ImageSourcePropType} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import {OwnerEditorial} from './CustomerType';
import {Text} from './MotexaVisual';
import {useMechanicTheme} from './MechanicUI';
import {OwnerScrollReveal} from './OwnerScroll';

/** Unframed owner journey photography, with scroll depth rather than an unrelated light loop. */
export default function OwnerPhotoScene({source,height=190,title,eyebrow,caption,paused=false,children}:{source:ImageSourcePropType;height?:number;title?:string;eyebrow?:string;caption?:string;paused?:boolean;children?:ReactNode}){
 const m=useMechanicTheme();
 return <View testID="owner-photo-scene" style={{height,marginHorizontal:-18,overflow:'hidden',backgroundColor:'#17120F'}}>
  <View pointerEvents="none" style={{position:'absolute',inset:0}}><OwnerScrollReveal enabled={!paused}><Image accessible={false} source={source} resizeMode="cover" style={{width:'100%',height:height+45,marginTop:-15}}/></OwnerScrollReveal></View>
  <LinearGradient pointerEvents="none" colors={['#17120FCB','#17120F20','#17120FEF']} locations={[0,.4,1]} style={{position:'absolute',inset:0}}/>
  <View style={{flex:1,paddingHorizontal:22,paddingVertical:17,justifyContent:'space-between'}}>{eyebrow?<Text style={{fontSize:10,lineHeight:20,letterSpacing:m.ar?0:1.5,color:'#E3B685',textAlign:m.align}}>{eyebrow}</Text>:<View/>}<View style={{gap:7}}>{!!title&&<OwnerEditorial style={{color:'#FFF2E0',fontSize:m.ar?28:38,lineHeight:m.ar?42:47}}>{title}</OwnerEditorial>}{children}{!!caption&&<Text style={{fontSize:10,lineHeight:19,color:'#D4C0A9',textAlign:m.align}}>{caption}</Text>}</View></View>
 </View>;
}
