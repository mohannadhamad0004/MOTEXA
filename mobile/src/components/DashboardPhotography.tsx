import {useState} from 'react';
import {Image,View,type ViewStyle} from 'react-native';
/** Decorative photographs only; no overlays or account information. */
export function DashboardPhotography({index,style}:{index:number;style?:ViewStyle}){
 const [frame,setFrame]=useState({width:86,height:78});
 const photoWidth=frame.height*4;
 return <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none" onLayout={event=>{const {width,height}=event.nativeEvent.layout;setFrame(current=>current.width===width&&current.height===height?current:{width,height});}} style={[{overflow:'hidden',backgroundColor:'#795236'},style]}><Image source={require('../../assets/images/motexa-dashboard-atlas.png')} resizeMode="stretch" style={{position:'absolute',width:photoWidth,height:frame.height*4,left:(frame.width-photoWidth)/2,top:-index*frame.height}}/></View>;
}
