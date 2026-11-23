import Pressable from './MotionPressable';
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Image, Modal, Platform, ScrollView, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Text } from "./MotexaVisual";
import { mechanicApi, type MechanicDocument } from "./mechanic-api";
import { MechanicButton, MechanicNote, useMechanicTheme } from "./MechanicUI";
function privatePdfName(){ return "motexa-private-" + Date.now() + ".pdf"; }
export async function pickMechanicDocument(kind: string) {
  // FileSystem's own Android picker grants read access to the returned URI in Expo Go.
  // A URI copied by another module may otherwise fail FileSystem's READ scope check.
  if (Platform.OS === 'android') {
    const picked=await File.pickFileAsync({mimeTypes:['image/jpeg','image/png','application/pdf'],multipleFiles:false});
    if(picked.canceled)return null;
    const file=picked.result;
    if(file.size>5*1024*1024)throw Error('Choose a document under 5 MB.');
    const base64=await file.base64();
    const mimeType=base64.startsWith('iVBORw0KGgo')?'image/png':base64.startsWith('/9j/')?'image/jpeg':base64.startsWith('JVBERi0')?'application/pdf':null;
    if(!mimeType)throw Error('Choose a JPEG, PNG or PDF document.');
    return {kind,fileName:file.name,mimeType,base64};
  }
  const result = await DocumentPicker.getDocumentAsync({
    type: ["image/jpeg", "image/png", "application/pdf"],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled) return null;
  const a = result.assets[0];
  if (a.size && a.size > 5 * 1024 * 1024)
    throw Error("Choose a document under 5 MB.");
  let base64: string;
  if (Platform.OS === "web") {
    const blob = a.file ?? (await (await fetch(a.uri)).blob());
    base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(Error("Document could not be read."));
      reader.onload = () => resolve(String(reader.result).split(",")[1]);
      reader.readAsDataURL(blob);
    });
  } else base64 = await new File(a.uri).base64();
  return { kind, fileName: a.name, mimeType: a.mimeType, base64 };
}
export default function MechanicDocuments({
  documents,
  editable = false,
  onUpload,
  previewOnly = false,
  requireCertificate = true,
  includeWorkshopProof = false,
}: {
  documents: MechanicDocument[];
  editable?: boolean;
  previewOnly?: boolean;
  requireCertificate?: boolean;
  includeWorkshopProof?: boolean;
  onUpload?: (kind: string) => void;
}) {
  const m = useMechanicTheme(),
    [preview, setPreview] = useState<{
      base64: string;
      mimeType: string;
    } | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function open(doc: MechanicDocument) {
    if (previewOnly) return;
    setBusy(true);
    setError("");
    try {
      const { document: d } = await mechanicApi(
        "/api/mechanics/documents/" + doc.id,
      );
      if (d.mimeType.startsWith("image/")) setPreview(d);
      else if (Platform.OS === "web") {
        const bytes = Uint8Array.from(atob(d.base64), (c: string) =>
          c.charCodeAt(0),
        );
        const url = URL.createObjectURL(
          new Blob([bytes], { type: "application/pdf" }),
        );
        const a = document.createElement("a");
        a.href = url;
        a.download = "MOTEXA-document.pdf";
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      } else {
        if (!(await Sharing.isAvailableAsync()))
          throw Error(
            m.t(
              "Document opening is unavailable on this device.",
              "فتح المستندات غير متاح على هذا الجهاز.",
            ),
          );
        const file = new File(
          Paths.cache,
          privatePdfName(),
        );
        file.write(d.base64, { encoding: "base64" });
        try {
          await Sharing.shareAsync(file.uri, {
            mimeType: "application/pdf",
            UTI: "com.adobe.pdf",
          });
        } finally {
          if (file.exists) file.delete();
        }
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Document could not be opened.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {error && <MechanicNote error>{error}</MechanicNote>}
      {[
        "IDENTITY",
        "CERTIFICATE",
        ...(includeWorkshopProof ||
        documents.some((d) => d.kind === "WORKSHOP_PROOF")
          ? ["WORKSHOP_PROOF"]
          : []),
      ].map((kind,index) => {
        const doc = documents.find((d) => d.kind === kind);
        const title=kind==='IDENTITY'?m.t('Identity document','الهوية الشخصية'):kind==='WORKSHOP_PROOF'?m.t('Workshop ownership / use','ملكية الورشة أو حق استخدامها'):m.t('Experience / training certificate','شهادة خبرة أو تدريب');
        const required=kind!=='CERTIFICATE'||requireCertificate;
        const icon=kind==='IDENTITY'?'id-card-outline':kind==='WORKSHOP_PROOF'?'storefront-outline':'ribbon-outline';
        return <View key={kind} style={{borderWidth:1,borderColor:doc?(m.dark?'#829473':'#C0CDB5'):m.border,borderRadius:23,overflow:'hidden',backgroundColor:m.surface,marginBottom:12}}>
          <View style={{flexDirection:m.row,alignItems:'center',paddingHorizontal:15,paddingVertical:10,gap:8,borderBottomWidth:1,borderColor:m.border,backgroundColor:doc?(m.dark?'#39452F':'#EFF2E8'):m.soft}}><Text style={{fontSize:10,lineHeight:20,color:m.muted,letterSpacing:.8}}>{'0'+(index+1)}</Text><View style={{flex:1}}/><Ionicons name={doc?'checkmark-circle-outline':'ellipse-outline'} size={14} color={m.muted}/><Text style={{fontSize:10,lineHeight:20,color:m.muted}}>{doc?m.t('File uploaded','تم رفع الملف'):m.t('Not uploaded','لم يُرفع بعد')}</Text></View>
          <View style={{padding:16,gap:13}}><View style={{flexDirection:m.row,alignItems:'center',gap:12}}><View style={{width:43,height:53,borderWidth:1,borderColor:m.border,borderRadius:10,borderTopRightRadius:2,backgroundColor:m.soft,alignItems:'center',justifyContent:'center'}}><Ionicons name={icon} size={23} color={m.muted}/></View><View style={{flex:1,gap:4}}><Text style={{fontSize:15,lineHeight:26,fontWeight:'600',color:m.ink,textAlign:m.align}}>{title}</Text><Text style={{fontSize:10,lineHeight:20,color:m.muted,textAlign:m.align}}>{required?m.t('Required for verification','مطلوب للاعتماد'):m.t('Optional supporting document','مستند داعم اختياري')}</Text></View></View>
          <Text selectable={!!doc} style={{fontSize:12,lineHeight:23,color:m.muted,textAlign:m.align}}>{doc?doc.fileName:kind==='WORKSHOP_PROOF'?m.t('Ownership, rental agreement or written permission to use your workshop.','سند ملكية، عقد إيجار أو إذن مكتوب لاستخدام الورشة.'):m.t('Choose a clear, complete copy of your document.','اختر نسخة واضحة وكاملة من المستند.')}</Text>
          {!doc&&<View style={{flexDirection:m.row,flexWrap:'wrap',gap:7}}>{['PDF','JPG / PNG',m.t('Up to 5 MB','حتى 5 MB')].map(format=><View key={format} style={{backgroundColor:m.soft,borderRadius:7,paddingHorizontal:7,paddingVertical:3}}><Text style={{fontSize:10,lineHeight:19,color:m.muted}}>{format}</Text></View>)}</View>}
          {editable&&!doc&&<Pressable focusVisibleOnly accessibilityRole="button" accessibilityLabel={m.t('Upload document','رفع المستند')} disabled={busy} onPress={()=>onUpload?.(kind)} style={{minHeight:48,borderRadius:15,backgroundColor:m.ink,flexDirection:m.row,alignItems:'center',justifyContent:'center',gap:8,opacity:busy?.5:1}}><Ionicons name="add-outline" size={20} color={m.surface}/><Text style={{fontSize:13,lineHeight:23,color:m.surface,fontWeight:'600'}}>{m.t('Upload document','رفع المستند')}</Text></Pressable>}
          {doc&&<View style={{gap:8}}>{!previewOnly&&<MechanicButton secondary busy={busy} label={m.t('View document','عرض المستند')} onPress={()=>void open(doc)}/>}{editable&&<MechanicButton secondary disabled={busy} label={m.t('Replace document','استبدال المستند')} onPress={()=>onUpload?.(kind)}/>}<View style={{flexDirection:m.row,alignItems:'center',gap:5}}><Ionicons name="lock-closed-outline" size={12} color={m.muted}/><Text style={{fontSize:10,lineHeight:20,color:m.muted}}>{m.t('Private file · Upload does not imply approval','ملف خاص · رفعه لا يعني اعتماده')}</Text></View></View>}
          </View>
        </View>;
      })}
      <Modal
        visible={!!preview}
        transparent
        animationType="fade"
        onRequestClose={() => setPreview(null)}
      >
        <View
          style={{
            flex: 1,
            padding: 20,
            paddingTop: 50,
            backgroundColor: "#211A15F2",
            justifyContent: "center",
            gap: 12,
          }}
        >
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
          >
            {preview && (
              <Image
                accessible
                accessibilityLabel={m.t(
                  "Private document preview",
                  "معاينة مستند خاص",
                )}
                source={{
                  uri: "data:" + preview.mimeType + ";base64," + preview.base64,
                }}
                resizeMode="contain"
                style={{ width: "100%", height: 500 }}
              />
            )}
          </ScrollView>
          <MechanicButton
            label={m.t("Close preview", "إغلاق المعاينة")}
            onPress={() => setPreview(null)}
          />
        </View>
      </Modal>
    </>
  );
}
