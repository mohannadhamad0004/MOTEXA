import {View,Image} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import {Ionicons} from '@expo/vector-icons';
import {Text} from './MotexaVisual';
import {OwnerEditorial} from './CustomerType';
import {useMechanicTheme} from './MechanicUI';
import Pressable from './MotionPressable';

export default function OwnerAccountIntro({name,vehicles,requests,onGarage,onRequests,onSettings}:{onSettings?:()=>void;name:string;vehicles:number;requests:number;onGarage:()=>void;onRequests:()=>void}){
 const m=useMechanicTheme();
 return <View style={{marginHorizontal:-18,height:290,overflow:'hidden',backgroundColor:'#17120F'}}>
  <Image accessible={false} source={require('../../assets/images/owner-interior.jpg')} resizeMode="cover" style={{position:'absolute',top:0,right:-60,width:'110%',height:'100%',opacity:.8}}/>
  <LinearGradient colors={['#17120FEF','#17120F77','#17120FE8']} locations={[0,.43,1]} style={{position:'absolute',inset:0}}/>
  {onSettings&&<Pressable focusVisibleOnly accessibilityRole="button" accessibilityLabel={m.t('Account settings','إعدادات الحساب')} onPress={onSettings} style={{position:'absolute',zIndex:2,top:55,right:m.ar?undefined:22,left:m.ar?22:undefined,width:46,height:46,borderRadius:23,borderWidth:1,borderColor:'#D9AD7F66',backgroundColor:'#20170FD9',alignItems:'center',justifyContent:'center'}}><Ionicons name="settings-outline" size={21} color="#E5BB8C"/></Pressable>}
  <View style={{padding:22,flex:1,justifyContent:'space-between'}}>
   <View style={{gap:3}}><Text style={{fontSize:10,letterSpacing:m.ar?0:2,color:'#E2B17B',textAlign:m.align}}>MOTEXA / PERSONAL SPACE</Text><OwnerEditorial style={{fontSize:m.ar?30:42,lineHeight:52,color:'#FFF1E0'}}>{m.t('My account','حسابي')}</OwnerEditorial></View>
   <View style={{flexDirection:m.row,alignItems:'center',gap:15}}><View style={{width:64,height:64,borderRadius:32,borderWidth:1,borderColor:m.bronze,backgroundColor:'#21180FD9',alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:27,color:'#E2B17B'}}>{name.trim().slice(0,1).toUpperCase()||'M'}</Text></View><View style={{flex:1,gap:5}}><Text style={{fontSize:10,letterSpacing:m.ar?0:1.8,color:'#E2B17B',textAlign:m.align}}>{m.t('CAR OWNER','صاحب السيارة')}</Text><Text numberOfLines={2} style={{fontSize:26,lineHeight:36,fontWeight:'600',color:'#FFF1E0',textAlign:m.align}}>{name}</Text></View></View>
   <View style={{flexDirection:m.row,gap:12,borderTopWidth:1,borderColor:'#E2B17B33',paddingTop:13}}>{[{n:vehicles,label:m.t('My cars','سياراتي'),icon:'car-sport-outline',action:onGarage},{n:requests,label:m.t('My requests','طلباتي'),icon:'navigate-outline',action:onRequests}].map((v,i)=><Pressable key={v.label} accessibilityRole="button" accessibilityLabel={v.label} onPress={v.action} style={{flex:1,flexDirection:m.row,alignItems:'center',gap:12,minHeight:58,borderEndWidth:i===0?1:0,borderColor:'#E2B17B33'}}><Ionicons name={v.icon as 'car-sport-outline'} size={23} color={m.bronze}/><View style={{gap:2}}><Text style={{fontSize:28,lineHeight:34,color:'#FFF1E0',fontWeight:'600'}}>{String(v.n).padStart(2,'0')}</Text><Text style={{fontSize:12,lineHeight:21,color:'#CDB395'}}>{v.label}</Text></View></Pressable>)}</View>
  </View>
 </View>;
}
