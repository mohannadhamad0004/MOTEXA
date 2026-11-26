// Photos and videos of both provider roles = Form: pick where the file goes (slot, and for a tow company which truck), then the ONE
// primary "Choose and upload" in the footer; the published files below, each with Replace / Remove in ⋮ (remove asks first).
import { File as FsFile } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { router, useIsFocused, type Href } from "expo-router";
import { VideoView, useVideoPlayer } from "expo-video";
import { useEffect, useState } from "react";
import { Image, View } from "react-native";
import { Chip, GButton, GText, Note } from "../../../components/garage";
import { ItemActionsMenu } from "../../../components/ItemActionsMenu";
import { ManageEntry } from "../../../components/manage/ManagePage";
import { Block, Loaded, Page } from "../../../components/manage/Page";
import { privateImageSource } from "../../../core/config/api";
import { localFileToBase64 } from "../../../core/constants/files";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { PhotoError, photoErrorText, pickPhoto } from "../../../core/hooks/pickPhoto";
import { usePlayerCall } from "../../../core/hooks/usePlayerCall";
import { asActor, useSessionUser } from "../../../core/session/session";
import { gShape, gType, useGarageTheme } from "../../../theme/garage";
import { towFleetService } from "../../tow/towService";
import { portalApi, portalBase } from "./api";
import type { ProviderArea, ProviderMedia } from "./types";

const VIDEO_MAX = 20 * 1024 * 1024;
/** Reliable size: the picker's fileSize, else the file's own size on disk (Android content uris often omit fileSize). null = unknown. */
async function videoBytes(a: { uri: string; fileSize?: number | null }): Promise<number | null> {
  if (a.fileSize) return a.fileSize;
  try { const n = new FsFile(a.uri).size; return n > 0 ? n : null; } catch { return null; }
}

/** A muted video that pauses when its screen loses focus (also used by the customer profiles). */
export function ProviderVideo({ uri, headers }: { uri: string; headers?: Record<string, string> }) {
  const { g } = useGarageTheme();
  const focused = useIsFocused(), call = usePlayerCall();
  const player = useVideoPlayer({ uri, headers }, (p) => { p.muted = true; });
  useEffect(() => { if (!focused) call(() => player.pause()); }, [focused, player, call]);
  return <View style={{ borderRadius: 16, overflow: "hidden", backgroundColor: g.cardSoft }}><VideoView player={player} nativeControls contentFit="contain" style={{ width: "100%", height: 190 }} /></View>;
}

function MediaAsset({ media, area }: { media: ProviderMedia; area: ProviderArea }) {
  const { g } = useGarageTheme();
  const [source, setSource] = useState<{ uri: string; headers?: Record<string, string> } | null>(null);
  useEffect(() => { let live = true; privateImageSource(`${portalBase(area)}/media/${media.id}/asset`).then((s) => { if (live) setSource(s); }); return () => { live = false; }; }, [area, media.id]);
  if (!source) return <View style={{ height: 190, borderRadius: gShape.small, backgroundColor: g.cardSoft }} />;
  return media.mimeType.startsWith("video/") ? <ProviderVideo {...source} /> : <Image source={source} style={{ width: "100%", height: 190, borderRadius: gShape.small }} resizeMode="contain" />;
}

export default function MediaPage({ area }: { area: ProviderArea }) {
  const { t } = useL();
  const { row, align } = useGarageTheme();
  const u = useSessionUser();
  const state = useLoad(() => portalApi.media(area), [u.id, area]);
  const fleet = useLoad(() => (area === "tow" ? towFleetService.getMyFleet(asActor(u)) : Promise.resolve(null)), [u.id, area]);
  const [truckId, setTruck] = useState(""), [slot, setSlot] = useState("GALLERY"), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const work = async (fn: () => Promise<unknown>) => {
    setBusy(true); setError(null);
    try { await fn(); await state.reload(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const send = (replaceId: string | undefined, old: ProviderMedia | undefined, dataBase64: string) =>
    work(async () => portalApi.upload(area, { slot: old?.slot ?? slot, truckId: (old?.truckId ?? truckId) || undefined, replaceId, dataBase64 }));
  const pick = async (replaceId?: string, old?: ProviderMedia) => {
    try {
      const video = (old?.slot ?? slot) === "VIDEO";
      if (!video) { const photo = await pickPhoto(); if (!photo) return; await send(replaceId, old, photo.base64); return; } // photos: resized, JPEG, size checked
      const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["videos"], allowsEditing: false });
      if (r.canceled) return;
      const a = r.assets[0];
      if (!a) return;
      const size = await videoBytes(a);
      if (size === null) throw new Error(t("We could not read the size of that video. Choose another one.", "تعذّر قراءة حجم الفيديو. اختر فيديو آخر."));
      if (size > VIDEO_MAX) throw new Error(t("Video too large. MP4 video: 20 MB.", "الفيديو كبير. فيديو MP4: ٢٠ ميغابايت."));
      await send(replaceId, old, await localFileToBase64(a.uri));
    } catch (e) { setError(e instanceof PhotoError ? photoErrorText(e, t) : (e as Error).message); }
  };
  const slots: [string, string, string][] = [["PROFILE", "Profile photo", "صورة الملف"], ["COVER", "Cover", "الغلاف"], ["GALLERY", "Business photos", "صور النشاط"], ...(area === "tow" ? [["VIDEO", "Truck video", "فيديو الشاحنة"] as [string, string, string]] : [])];
  const slotName = (s: string) => { const x = slots.find(([k]) => k === s); return x ? t(x[1], x[2]) : s; };
  return (
    <Page title={t("Photos and videos", "الصور والفيديو")} line={t("Shown on your public profile", "تظهر في ملفك العام")} onRefresh={() => void state.reload()} refreshing={false}
      footer={<GButton icon="cloud-upload-outline" label={t("Choose and upload", "اختيار ورفع")} busy={busy} disabled={busy} onPress={() => void pick()} />}>
      <Note icon="lock-closed-outline">{t("These appear in your customer profile. Verification documents stay private. JPEG/PNG/WebP up to 5 MB or H.264 MP4 up to 20 MB.", "تظهر هذه الوسائط في ملف العميل. تبقى مستندات التحقق خاصة. صور JPEG/PNG/WebP حتى ٥ ميغابايت أو فيديو H.264 MP4 حتى ٢٠ ميغابايت.")}</Note>
      <View style={{ gap: 8 }}>
        <GText style={[gType.label, align, { fontWeight: "700" }]}>{t("Upload as", "الرفع كـ")}</GText>
        <View style={[row, { flexWrap: "wrap", gap: 8 }]}>{slots.map(([key, en, ar]) => <Chip key={key} label={t(en, ar)} on={slot === key} onPress={() => setSlot(key)} />)}</View>
      </View>
      {area === "tow" && fleet.data?.trucks.length ? (
        <View style={{ gap: 8 }}>
          <GText style={[gType.label, align, { fontWeight: "700" }]}>{t("For", "لـ")}</GText>
          <View style={[row, { flexWrap: "wrap", gap: 8 }]}>
            <Chip label={t("The company", "الشركة")} on={!truckId} onPress={() => setTruck("")} />
            {fleet.data.trucks.map((tr) => <Chip key={tr.id} label={`${tr.make} ${tr.model} · ${tr.plate}`} on={truckId === tr.id} onPress={() => setTruck(tr.id)} />)}
          </View>
        </View>
      ) : null}
      {error ? <Note tone="danger" icon="alert-circle-outline">{error}</Note> : null}
      <ManageEntry icon="images-outline" title={area === "tow" ? t("Truck photos", "صور الشاحنات") : t("Product photos", "صور المنتجات")}
        sub={area === "tow" ? t("Each truck's own photo: open the truck to replace it", "صورة كل شاحنة: افتح الشاحنة لاستبدالها") : t("Each product's own photo: open the product to replace it", "صورة كل منتج: افتح المنتج لاستبدالها")}
        onPress={() => router.push((area === "tow" ? "/provider/tow/trucks" : "/provider/parts/products") as Href)} />
      <Loaded state={state}>{(items) => !items.length ? <Note>{t("No business media yet. Upload your first photo or video.", "لا توجد وسائط للنشاط بعد. ارفع أول صورة أو فيديو.")}</Note> : (
        <View style={{ gap: 14 }}>
          {items.map((m) => (
            <Block key={m.id} title={slotName(m.slot)} action={<ItemActionsMenu title={slotName(m.slot)} actions={[
              { key: "replace", label: t("Replace", "استبدال"), icon: "swap-horizontal-outline", disabled: busy, run: () => void pick(m.id, m) },
              { key: "remove", label: t("Remove", "إزالة"), icon: "trash-outline", destructive: true, disabled: busy, confirm: { title: t("Remove this media from the customer profile?", "إزالة هذه الوسائط من ملف العميل؟"), confirmLabel: t("Remove", "إزالة") },
                run: () => portalApi.remove(area, m.id).then(() => state.reload()), success: t("Removed.", "تمت الإزالة.") },
            ]} />}>
              <View style={{ gap: 6, paddingVertical: 10 }}>
                <MediaAsset area={area} media={m} />
                <GText soft style={[gType.caption, align]}>{`${m.mimeType} · ${(m.sizeBytes / 1024 / 1024).toFixed(1)} MB`}</GText>
              </View>
            </Block>
          ))}
        </View>
      )}</Loaded>
    </Page>
  );
}
