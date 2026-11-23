import {View,ActivityIndicator} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {LinearGradient} from 'expo-linear-gradient';
import {Text,HeroReveal} from './MotexaVisual';
import Pressable from './MotionPressable';
import BrandMonogram from './BrandMonogram';
import {useMechanicTheme} from './MechanicUI';

export default function ApplicationResultsState({loading,loaded,filtered,onRetry,onClear}:{loading:boolean;loaded:boolean;filtered:boolean;onRetry:()=>void;onClear:()=>void}){
 const m=useMechanicTheme();
 const title=loading?m.t('Preparing your inbox','جارٍ تجهيز الطلبات'):!loaded?m.t('Let’s restore the connection','لنستعد الاتصال'):filtered?m.t('No files match this view','لا توجد ملفات مطابقة'):m.t('No applications yet','لا توجد طلبات بعد');
 const label=loading?m.t('Refreshing…','جارٍ التحديث…'):!loaded?m.t('Retry connection','إعادة الاتصال'):filtered?m.t('Show all applications','عرض كل الطلبات'):m.t('Refresh inbox','تحديث الطلبات');
 return <HeroReveal accessibilityLiveRegion="polite" style={{borderWidth:1,borderColor:m.border,borderRadius:28,borderTopRightRadius:m.ar?28:52,borderTopLeftRadius:m.ar?52:28,overflow:'hidden',boxShadow:m.dark?'0px 4px 16px rgba(0,0,0,0.08)':'0px 4px 16px rgba(70,45,25,0.035)'}}>
  <LinearGradient pointerEvents="none" start={{x:0,y:0}} end={{x:1,y:1}} colors={m.dark?['#493827','#30271F']:['#F3E2C9','#FFFAF2']} style={{position:'absolute',width:'100%',height:'100%'}}/>
  <BrandMonogram size={155} style={{top:12,right:m.ar?undefined:-20,left:m.ar?-20:undefined,opacity:.04}}/>
  <View style={{padding:19,gap:11}}><View style={{flexDirection:m.row,alignItems:'center',gap:8}}><View style={{width:31,height:34,borderRadius:12,backgroundColor:m.surface,alignItems:'center',justifyContent:'center'}}>{loading?<ActivityIndicator size="small" color={m.muted}/>:<Ionicons name={!loaded?'cloud-offline-outline':filtered?'search-outline':'file-tray-outline'} size={18} color={m.muted}/>}</View><Text style={{fontSize:9,lineHeight:18,letterSpacing:m.ar?0:1.1,color:m.muted,textAlign:m.align}}>{m.t('APPLICATION INBOX','صندوق طلبات الانضمام')}</Text></View><View style={{gap:5}}><Text style={{fontSize:20,lineHeight:32,fontWeight:'600',color:m.ink,textAlign:m.align}}>{title}</Text><Text style={{fontSize:12,lineHeight:23,color:m.muted,textAlign:m.align}}>{loading?m.t('Retrieving saved applications.','نحمّل الطلبات المحفوظة.'):!loaded?m.t('Your files will appear once the connection is restored.','ستظهر ملفاتك عند استعادة الاتصال.'):filtered?m.t('Adjust your search, or return to all applications.','عدّل البحث أو ارجع إلى جميع الطلبات.'):m.t('This is where new mechanic profiles begin their review journey.','هنا تبدأ رحلة مراجعة ملفات الميكانيكيين الجدد.')}</Text></View></View>
  <Pressable focusVisibleOnly accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled:loading,busy:loading}} disabled={loading} onPress={!loaded?onRetry:filtered?onClear:onRetry} style={({pressed})=>({minHeight:49,borderTopWidth:1,borderColor:m.border,paddingHorizontal:19,paddingVertical:10,flexDirection:m.row,alignItems:'center',gap:10,backgroundColor:m.dark?'#FFFFFF05':'#FFFFFF55',opacity:loading?.7:pressed?.8:1})}><Text style={{flex:1,fontSize:12,lineHeight:22,fontWeight:'600',color:m.ink,textAlign:m.align}}>{label}</Text>{loading?<ActivityIndicator size="small" color={m.muted}/>:<Ionicons name={filtered?(m.ar?'arrow-back':'arrow-forward'):'refresh-outline'} size={18} color={m.muted}/>}</Pressable>
 </HeroReveal>;
}
