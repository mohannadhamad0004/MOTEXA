import {useState} from 'react';
import {Image,View,useWindowDimensions} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {LinearGradient} from 'expo-linear-gradient';
import {Text,HeroReveal} from './MotexaVisual';
import {useMechanicTheme} from './MechanicUI';
import {OwnerScrollScene} from './OwnerScroll';
import {ownerVehicleArt,ownerFuel} from './OwnerVehicleCard';
import OwnerVehiclePhoto from './OwnerVehiclePhoto';
import Pressable from './MotionPressable';
import type {OwnerVehicle} from './OwnerTypes';

const cabins:Record<string,number>={
 audi:require('../../assets/images/owner-audi-interior-v6.png'),
 'range rover':require('../../assets/images/owner-range-rover-interior-v6.png'),
 'land rover':require('../../assets/images/owner-range-rover-interior-v6.png'),
 porsche:require('../../assets/images/owner-interior-v3.png'),
 toyota:require('../../assets/images/owner-cabin-toyota-v5.png'),
 bmw:require('../../assets/images/owner-cabin-bmw-v5.png'),
 mercedes:require('../../assets/images/owner-cabin-mercedes-v5.png'),
 'mercedes-benz':require('../../assets/images/owner-cabin-mercedes-v5.png'),
 hyundai:require('../../assets/images/owner-cabin-hyundai-v5.png'),
 kia:require('../../assets/images/owner-cabin-kia-v5.png'),
 volkswagen:require('../../assets/images/owner-cabin-volkswagen-v5.png'),
};

export function ownerVehicleCabin(v:OwnerVehicle){return ownerVehicleArt(v)?cabins[v.make.trim().toLowerCase()]:undefined;}

/** Owner data stays separate from clearly labelled editorial vehicle imagery. */
export default function OwnerHomeShowcase({vehicle,onDetails,onMechanic}:{vehicle:OwnerVehicle;onDetails:()=>void;onMechanic:()=>void}){
 const m=useMechanicTheme(),{width}=useWindowDimensions(),[inside,setInside]=useState(false),[facts,setFacts]=useState(false);
 const art=ownerVehicleArt(vehicle),ownPhoto=!!(vehicle.photoUpdatedAt||vehicle.photoDataUri);
 const cabin=art?cabins[vehicle.make.trim().toLowerCase()]:undefined;
 const portrait=!ownPhoto&&!inside&&/^audi$/i.test(vehicle.make)&&!!art;
 const height=Math.min(405,Math.max(350,width*.96));
 const studio=!ownPhoto;
 return <View testID="owner-home-showcase" style={{marginHorizontal:-18,backgroundColor:'#17120F',overflow:'hidden'}}>
  <View style={{height,overflow:'hidden'}}>
   <LinearGradient colors={['#17120F','#3D2D22','#17120F']} locations={[0,.58,1]} style={{position:'absolute',inset:0}}/>
   {!ownPhoto&&!inside&&!portrait&&<Text accessible={false} numberOfLines={1} adjustsFontSizeToFit style={{position:'absolute',top:118,left:12,right:12,fontSize:96,lineHeight:112,fontWeight:'700',letterSpacing:-4,color:'#E9C8A51A',textAlign:'center'}}>{vehicle.model.toUpperCase()}</Text>}
   <View pointerEvents="none" style={{position:'absolute',inset:0}}>
    {ownPhoto?<View style={{position:'absolute',left:0,right:0,bottom:0}}><OwnerVehiclePhoto key={vehicle.id+'-'+vehicle.photoUpdatedAt} vehicle={vehicle} height={height-95}/></View>:<HeroReveal key={vehicle.id+'-'+inside} style={{flex:1}}>
     {inside&&cabin?<Image accessible={false} source={cabin} resizeMode="cover" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}/>:portrait?<Image accessible={false} source={require('../../assets/images/owner-audi-workshop-v7.jpg')} resizeMode="cover" style={{position:'absolute',width:'100%',height:'160%',bottom:-20}}/>:art?<View style={{position:'absolute',left:-20,right:-20,bottom:17}}><OwnerScrollScene><Image accessible={false} source={art.source} resizeMode="contain" style={{width:'100%',height:height-83}}/></OwnerScrollScene></View>:<View style={{flex:1,alignItems:'center',justifyContent:'center',paddingTop:65,gap:12}}><Ionicons name="car-sport-outline" size={66} color="#D6AE83"/><Text style={{fontSize:13,color:'#E5C7A5'}}>{m.t('Add your own car photo in My Garage','أضف صورة سيارتك من الكراج')}</Text></View>}
    </HeroReveal>}
   </View>
   <LinearGradient pointerEvents="none" colors={['#17120FF5','#17120F55','#17120F00','#17120FE6']} locations={[0,.3,.62,1]} style={{position:'absolute',inset:0}}/>
   <View style={{padding:21,gap:8}}>
    <View style={{flexDirection:m.row,alignItems:'center',gap:12}}><View style={{flex:1,gap:5}}><Text style={{fontSize:11,letterSpacing:m.ar?0:2,color:'#D5AC80',textAlign:m.align}}>{m.t('YOUR SELECTED DRIVE','سيارتك المختارة')}</Text><Text accessibilityRole="header" numberOfLines={2} style={{fontSize:25,lineHeight:34,fontWeight:'600',color:'#FFF2E1',textAlign:m.align}}>{vehicle.make+' '+vehicle.model}</Text></View><Pressable accessibilityRole="button" accessibilityLabel={m.t('View vehicle details: ','تفاصيل السيارة: ')+vehicle.make+' '+vehicle.model} onPress={onDetails} style={{width:48,height:48,borderRadius:24,borderWidth:1,borderColor:'#D8AE7C88',backgroundColor:'#211810A8',alignItems:'center',justifyContent:'center'}}><Ionicons name={m.ar?'arrow-back':'arrow-forward'} size={23} color="#E7BA85" style={{transform:[{rotate:m.ar?'35deg':'-35deg'}]}}/></Pressable></View>
    {!ownPhoto&&cabin&&<View accessibilityRole="tablist" style={{flexDirection:m.row,alignSelf:m.ar?'flex-end':'flex-start',padding:3,borderRadius:25,borderWidth:1,borderColor:'#D8AE7C44',backgroundColor:'#17120FE6'}}>{[{value:false,en:'Exterior',ar:'خارجي'},{value:true,en:'Interior',ar:'داخلي'}].map(v=><Pressable key={v.en} accessibilityRole="tab" accessibilityLabel={m.t(v.en,v.ar)} accessibilityState={{selected:inside===v.value}} onPress={()=>{setInside(v.value);setFacts(false);}} style={{minWidth:84,minHeight:42,paddingHorizontal:13,borderRadius:23,backgroundColor:inside===v.value?'#D9A66F':'transparent',alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:12,color:inside===v.value?'#25190E':'#E7D6C2'}}>{m.t(v.en,v.ar)}</Text></Pressable>)}</View>}
   </View>
   <View style={{position:'absolute',bottom:80,left:21,right:21,flexDirection:m.row,alignItems:'center',gap:12,justifyContent:'space-between'}}><View style={{gap:4,paddingHorizontal:12,paddingVertical:8,borderRadius:15,borderWidth:1,borderColor:'#D8AE7C33',backgroundColor:'#17120FE8',maxWidth:'80%'}}><Text style={{fontSize:13,color:'#F7E6D2',textAlign:m.align}}>{vehicle.year+'  /  '+m.t(...(ownerFuel[vehicle.fuel]||['Vehicle','مركبة']))}</Text>{studio&&<Text style={{fontSize:11,color:'#D5B491',textAlign:m.align}}>{m.t(inside?'Illustrative interior':'Model illustration',inside?'صورة داخلية توضيحية':'صورة توضيحية للموديل')}</Text>}</View><Pressable accessibilityRole="button" accessibilityLabel={m.t('Show saved vehicle information','عرض معلومات السيارة المحفوظة')} accessibilityState={{expanded:facts}} onPress={()=>setFacts(v=>!v)} style={{width:46,height:46,borderRadius:23,borderWidth:1,borderColor:'#D8AE7C66',backgroundColor:'#211810DE',alignItems:'center',justifyContent:'center'}}><Ionicons name={facts?'close-outline':'information-outline'} size={22} color="#E7BA85"/></Pressable></View>
   <Pressable accessibilityRole="button" accessibilityLabel={m.t('Find an approved mechanic','البحث عن ميكانيكي معتمد')} onPress={onMechanic} style={({pressed})=>({position:'absolute',left:21,right:21,bottom:15,minHeight:52,borderRadius:27,overflow:'hidden',opacity:pressed?.85:1})}><LinearGradient colors={['#EDC79B','#CB945F']} start={{x:0,y:0}} end={{x:1,y:1}} style={{minHeight:52,paddingHorizontal:18,flexDirection:m.row,alignItems:'center',gap:12}}><Ionicons name="construct-outline" size={21} color="#2B1B10"/><Text style={{flex:1,fontSize:14,fontWeight:'600',color:'#2B1B10',textAlign:m.align}}>{m.t('Find my mechanic','اختَر ميكانيكي سيارتك')}</Text><Ionicons name={m.ar?'arrow-back':'arrow-forward'} size={21} color="#2B1B10"/></LinearGradient></Pressable>
  </View>
  {facts&&<HeroReveal><View style={{paddingHorizontal:22,paddingBottom:18,gap:9}}><View style={{height:1,backgroundColor:'#D8AE7C33'}}/><Text style={{fontSize:13,lineHeight:24,color:'#EAD2B7',textAlign:m.align}}>{m.t('Saved in your garage: ','محفوظة بكراجك: ')+vehicle.make+' '+vehicle.model+' · '+vehicle.year+' · '+m.t(...(ownerFuel[vehicle.fuel]||['Vehicle','مركبة']))}</Text><Pressable accessibilityRole="button" onPress={onDetails} style={{minHeight:46,justifyContent:'center'}}><Text style={{fontSize:13,color:'#E7BA85',textAlign:m.align}}>{m.t('Open My Garage →','افتح الكراج ←')}</Text></Pressable></View></HeroReveal>}
 </View>;
}
