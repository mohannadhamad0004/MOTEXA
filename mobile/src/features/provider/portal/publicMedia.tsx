// A provider's public photos / video as customers see them (shop and tow company public profiles; customer look on purpose).
import { Image } from "react-native";
import { apiUrl } from "../../../core/config/api";
import { ProviderVideo } from "./MediaPage";
import type { ProviderMedia } from "./types";
import { Panel, useDT } from "./ui";

export function PublicMedia({ media }: { media: ProviderMedia[] }) {
  const d = useDT();
  return (
    <>
      {media.map((m) => (
        <Panel key={m.id} title={m.slot === "VIDEO" ? d.t("Truck / service video", "فيديو الشاحنة / الخدمة") : m.slot === "PROFILE" ? d.t("Profile photo", "صورة الملف") : m.slot === "COVER" ? d.t("Cover image", "صورة الغلاف") : d.t("Business photos", "صور النشاط")}>
          {m.mimeType.startsWith("video/") ? <ProviderVideo uri={apiUrl(m.uri)} /> : <Image source={{ uri: apiUrl(m.uri) }} style={{ width: "100%", height: m.slot === "PROFILE" ? 140 : 190, borderRadius: 16, resizeMode: "contain" }} />}
        </Panel>
      ))}
    </>
  );
}
