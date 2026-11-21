import { Image,View } from "react-native";
import type { TowCompanyDetail,TowTruck } from "./catalogService";
import { cityLabel } from "../../core/constants/cities";
import { PublicMedia } from "../provider/portal/MediaPage";
import { Panel,Pill,Text,useDT } from "../provider/portal/ui";
import { useTruckLabels } from "../tow/truckBits";
import { RatingText } from "../tow/DriverCard";
export function TowPublicProfile({company:co,trucks}:{company:TowCompanyDetail;trucks:TowTruck[]}){const d=useDT(),labels=useTruckLabels();return <>
 <PublicMedia media={co.media??[]}/>
 <Panel title={co.name}><Text style={{color:d.muted,textAlign:d.align}}>{cityLabel(co.city,d.ar)}</Text>{co.description?<Text style={{color:d.ink,textAlign:d.align,lineHeight:23}}>{co.description}</Text>:null}{co.workingHours?<Text style={{color:d.muted,textAlign:d.align}}>{co.workingHours}</Text>:null}<View style={{flexDirection:d.row,flexWrap:"wrap",gap:6,alignItems:"center"}}>{co.verified?<Pill tone="ok" label={d.t("Verified by MOTEXA","موثّقة من موتكسا")}/>:null}{co.rating?<RatingText rating={co.rating}/>:null}<Pill tone={co.availableTrucks?"ok":"neutral"} label={d.t(`${co.availableTrucks} trucks available`,`${co.availableTrucks} شاحنات متاحة`)}/>{co.driversCount!==undefined?<Pill label={d.t(`${co.driversCount} drivers · ${co.freeDrivers??0} free`,`${co.driversCount} سائقين · ${co.freeDrivers??0} متاح`)}/>:null}</View><View style={{flexDirection:d.row,flexWrap:"wrap",gap:6}}>{co.serviceCities.map(c=><Pill key={c} label={cityLabel(c,d.ar)}/>)}</View></Panel>
 {co.reviews?.length?<Panel title={d.t("Reviews","التقييمات")}>{co.reviews.map((r,i)=><View key={i} style={{gap:2}}><Text style={{color:d.ink,textAlign:d.align}}>{"★".repeat(r.stars)}{"☆".repeat(5-r.stars)}</Text>{r.comment?<Text style={{color:d.muted,textAlign:d.align}}>{r.comment}</Text>:null}</View>)}</Panel>:null}
 {trucks.map(tr=><Panel key={tr.id} title={`${tr.make} ${tr.model}`}>
  {tr.photoUri?<Image source={{uri:tr.photoUri}} style={{width:"100%",height:180,borderRadius:16}}/>:null}<Text style={{color:d.ink,textAlign:d.align}}>{labels.type[tr.type]}{tr.year?` · ${tr.year}`:""}</Text>{tr.maxWeightKg?<Text style={{color:d.muted,textAlign:d.align}}>{d.t(`Maximum load ${tr.maxWeightKg} kg`,`الحمولة القصوى ${tr.maxWeightKg} كغ`)}</Text>:null}<Pill label={tr.operationalStatus==="AVAILABLE"?d.t("Available","متاح"):tr.operationalStatus==="BUSY"?d.t("Busy","مشغول"):d.t("Out of service","خارج الخدمة")} tone={tr.operationalStatus==="AVAILABLE"?"ok":"neutral"}/>
 </Panel>)}
 </>;}
