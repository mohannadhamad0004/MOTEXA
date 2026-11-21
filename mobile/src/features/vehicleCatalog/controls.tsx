import {useState} from "react";
import {Pressable,TextInput,View} from "react-native";
import {GText} from "../../components/garage";
import {useGarageTheme} from "../../theme/garage";
import {useL} from "../../core/hooks/useL";
import {normalizeNumberText} from "../../core/constants/numbers";
export function Entry({label,value,onChange,numeric=false,multiline=false,url=false,editable=true}:{label:string;value:string;onChange:(s:string)=>void;numeric?:boolean;multiline?:boolean;url?:boolean;editable?:boolean}){
 const {g,align}=useGarageTheme();return <View style={{gap:5,minWidth:0}}><GText style={align}>{label}</GText><TextInput accessibilityLabel={label} value={value} onChangeText={v=>onChange(numeric?normalizeNumberText(v):v)} editable={editable} autoCapitalize={url?"none":"sentences"} autoCorrect={!url} keyboardType={url?"url":numeric?"numeric":"default"} multiline={multiline} maxLength={multiline||url?2000:200} style={{color:g.ink,borderWidth:1,borderColor:g.line,borderRadius:12,padding:12,minHeight:multiline?90:48,textAlign:url?"left":align.textAlign,writingDirection:url||numeric?"ltr":undefined,backgroundColor:g.cardSoft,opacity:editable?1:.75}}/></View>;
}
export function Confirm({label,value,onChange,disabled=false}:{label:string;value:boolean;onChange:(v:boolean)=>void;disabled?:boolean}){
 const {row,align,g}=useGarageTheme();return <Pressable accessibilityRole="checkbox" accessibilityState={{checked:value,disabled}} accessibilityLabel={label} disabled={disabled} onPress={()=>onChange(!value)} style={[row,{gap:10,minHeight:48,alignItems:"center",opacity:disabled ? .5 : 1}]}><GText style={{color:g.accentText,fontSize:22}}>{value?"☑":"☐"}</GText><GText style={[align,{flex:1,minWidth:0}]}>{label}</GText></Pressable>;
}
export function Choice({label,options,value,onChange}:{label:string;options:{id:string;label:string}[];value:string;onChange:(s:string)=>void}){
 const [q,setQ]=useState(""),[open,setOpen]=useState(false);const {g,align}=useGarageTheme();const {t}=useL();const selected=options.find(o=>o.id===value);const filtered=options.filter(o=>o.label.toLocaleLowerCase().includes(q.toLocaleLowerCase()));
 return <View style={{gap:6}}><Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{expanded:open}} onPress={()=>setOpen(!open)} style={{minHeight:48,padding:10,borderWidth:1,borderColor:g.line,borderRadius:10}}><GText style={align}>{label}{selected?` · ${selected.label}`:t(" · Choose"," · اختر")}</GText></Pressable>{open?<><Entry label={t("Search options","البحث في الخيارات")} value={q} onChange={setQ}/>{filtered.slice(0,15).map(o=><Pressable key={o.id} accessibilityRole="radio" accessibilityState={{selected:o.id===value}} onPress={()=>{onChange(o.id);setOpen(false);}} style={{minHeight:44,padding:10,borderWidth:1,borderColor:o.id===value?g.accent:g.line,borderRadius:10}}><GText style={align}>{o.label}</GText></Pressable>)}{filtered.length>15?<GText soft>{t("Narrow your search to see more options.","حدّد البحث لعرض خيارات أخرى.")}</GText>:null}</>:null}</View>;
}
