import {View,Image} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import {Text} from './MotexaVisual';
import {OwnerEditorial} from './CustomerType';
import {useMechanicTheme} from './MechanicUI';
import {OwnerIconButton} from './OwnerUI';

export default function OwnerRequestsIntro({current,history,active,loading,onRefresh}:{current:number;history:number;active:boolean;loading:boolean;onRefresh:()=>void}){
 const m=useMechanicTheme();
 return <View style={{marginHorizontal:-18,height:240,overflow:'hidden',backgroundColor:'#17120F'}}><Image accessible={false} source={require('../../assets/images/mechanic-diagnostics-fatih.jpg')} resizeMode="cover" style={{position:'absolute',top:0,right:m.ar?undefined:-55,left:m.ar?-55:undefined,width:'110%',height:'100%',opacity:.7}}/><LinearGradient colors={['#17120FEF','#17120F66','#17120FF5']} locations={[0,.45,1]} style={{position:'absolute',inset:0}}/>
  <View style={{padding:22,flex:1,justifyContent:'space-between'}}><View style={{flexDirection:m.row,alignItems:'center',gap:12}}><View style={{flex:1,gap:3}}><Text style={{fontSize:10,letterSpacing:m.ar?0:1.6,color:'#DDB487',textAlign:m.align}}>MOTEXA / {m.t('SERVICE CONTROL','متابعة الخدمة')}</Text><OwnerEditorial style={{fontSize:m.ar?30:42,lineHeight:52,color:'#FFF1DF'}}>{m.t('My requests','طلباتي')}</OwnerEditorial></View><OwnerIconButton label={m.t('Refresh requests','تحديث الطلبات')} icon="refresh-outline" onPress={onRefresh} disabled={loading}/></View>
   <View style={{flexDirection:m.row,gap:18,borderTopWidth:1,borderColor:'#E1B58040',paddingTop:15}}>{[{count:current,en:'Active requests',ar:'الطلبات الحالية',selected:active},{count:history,en:'In your history',ar:'بسجل الخدمات',selected:!active}].map((s,i)=><View key={s.en} style={{flex:1,gap:4,borderEndWidth:i===0?1:0,borderColor:'#E1B58040'}}><Text style={{fontSize:31,lineHeight:38,fontWeight:'600',color:s.selected?'#E1B580':'#FFF1DF',textAlign:m.align}}>{String(s.count).padStart(2,'0')}</Text><Text style={{fontSize:12,lineHeight:22,color:'#D3BEA5',textAlign:m.align}}>{m.t(s.en,s.ar)}</Text></View>)}</View>
  </View>
 </View>;
}
