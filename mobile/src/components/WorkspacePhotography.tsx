import {useState} from 'react';
import {Image,View,type ViewStyle} from 'react-native';
export function WorkspacePhotography({index,style}:{index:number;style?:ViewStyle}){
 const [frame,setFrame]=useState({width:150,height:132});const w=Math.max(frame.width,frame.height*3),h=w/3;
 return <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none" onLayout={e=>{const {width,height}=e.nativeEvent.layout;setFrame(c=>c.width===width&&c.height===height?c:{width,height});}} style={[{overflow:'hidden',backgroundColor:'#795236'},style]}><Image source={require('../../assets/images/motexa-workspace-atlas.png')} resizeMode="stretch" style={{position:'absolute',width:w,height:h*2,left:(frame.width-w)/2,top:-index*h+(frame.height-h)/2}}/></View>;
}
