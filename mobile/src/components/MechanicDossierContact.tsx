import {View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {Text} from './MotexaVisual';
import {useMechanicTheme} from './MechanicUI';
import type {MechanicProfile} from './mechanic-api';

export default function MechanicDossierContact({profile,specialties}:{profile:MechanicProfile;specialties:string[]}){
 const m=useMechanicTheme();
 return <View style={{gap:15}}>
  <Text style={{fontSize:10,lineHeight:20,letterSpacing:m.ar?0:1,color:m.muted,textAlign:m.align}}>{m.t('CONTACT & EXPERTISE','التواصل والخبرة')}</Text>
  <View style={{gap:10}}>{([{icon:'mail-outline',label:m.t('Email','البريد'),value:profile.user.email},{icon:'call-outline',label:m.t('Phone','الهاتف'),value:profile.phoneNumber}] as const).map(item=><View key={item.label} style={{flexDirection:m.row,alignItems:'flex-start',gap:10}}><Ionicons name={item.icon} size={17} color={m.muted} style={{marginTop:3}}/><View style={{flex:1,gap:1}}><Text style={{fontSize:10,lineHeight:19,color:m.muted,textAlign:m.align}}>{item.label}</Text><Text selectable style={{fontSize:13,lineHeight:23,color:m.ink,textAlign:m.align}}>{item.value||m.t('Not provided','غير محدد')}</Text></View></View>)}</View>
  <View style={{flexDirection:m.row,flexWrap:'wrap',gap:6}}>{specialties.map(specialty=><View key={specialty} style={{borderRadius:12,paddingHorizontal:10,paddingVertical:5,backgroundColor:m.soft}}><Text style={{fontSize:11,lineHeight:21,color:m.ink}}>{specialty}</Text></View>)}</View>
  <View style={{gap:4,borderTopWidth:1,borderColor:m.border,paddingTop:12}}><Text style={{fontSize:11,lineHeight:21,fontWeight:'600',color:m.ink,textAlign:m.align}}>{m.t('Professional experience','الخبرة المهنية')}</Text><Text selectable style={{fontSize:12,lineHeight:24,color:m.muted,textAlign:m.align}}>{profile.experienceSummary||m.t('No experience summary provided.','لم يُقدّم ملخّص للخبرة.')}</Text></View>
 </View>;
}
