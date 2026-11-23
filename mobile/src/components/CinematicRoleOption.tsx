import {View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import Pressable from './MotionPressable';
import {Text} from './MotexaVisual';
import {RolePhotography} from './RolePhotography';
import {useAppearance} from './Appearance';
export default function CinematicRoleOption({index,title,selected,onPress,ar}:{index:number;title:string;selected:boolean;onPress:()=>void;ar:boolean}) {
 const {dark}=useAppearance();
 return <Pressable accessibilityRole="radio" accessibilityLabel={title} accessibilityState={{checked:selected}} aria-checked={selected} onPress={onPress} style={({pressed})=>({width:'48%',flexGrow:1,minHeight:144,borderRadius:24,overflow:'hidden',borderWidth:1,borderColor:selected?(dark?'#DEB17D':'#A57744'):(dark?'#70543D':'#E1CDB1'),backgroundColor:dark?(selected?'#4C3524':'#382A21'):(selected?'#F1DEC4':'#FFFAF2'),opacity:pressed?.82:1})}>
  <RolePhotography index={index} style={{width:'100%',height:76}}/>
  <View style={{paddingHorizontal:12,paddingVertical:11,flexDirection:ar?'row-reverse':'row',gap:7,alignItems:'center'}}><Text style={{flex:1,fontSize:14,lineHeight:22,fontWeight:'600',color:dark?'#FFF1DF':'#432D1E',textAlign:ar?'right':'left'}}>{title}</Text><View style={{width:23,height:23,borderRadius:12,borderWidth:1,borderColor:selected?'#A57744':dark?'#9A7B5B':'#CEB596',backgroundColor:selected?(dark?'#DDB383':'#805532'):'transparent',alignItems:'center',justifyContent:'center'}}>{selected&&<Ionicons name="checkmark" size={15} color={dark?'#30231B':'#FFF9EF'}/>}</View></View>
 </Pressable>;
}
