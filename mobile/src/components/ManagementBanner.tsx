import {useState,type ReactNode} from 'react';
import {Image,View,type ViewStyle} from 'react-native';
/** Decorative banner atlas. Layout never depends on account information. */
export function ManagementBanner({index,style,children}:{index:number;style?:ViewStyle;children?:ReactNode}){
 const [frame,setFrame]=useState({width:350,height:150});const w=Math.max(frame.width,frame.height*4.5),h=w/4.5;
 return <View onLayout={e=>{const {width,height}=e.nativeEvent.layout;setFrame(c=>c.width===width&&c.height===height?c:{width,height});}} style={[{overflow:'hidden'},style]}><Image accessible={false} source={require('../../assets/images/motexa-management-banners.png')} resizeMode="stretch" style={{position:'absolute',width:w,height:h*3,left:(frame.width-w)/2,top:-index*h+(frame.height-h)/2}}/>{children}</View>;
}


