// Availability = Form: one switch per approved truck (available / out of service), saved as soon as it is flipped (no Save button).
// A truck that is not approved or is on a job shows why instead of a switch; its details are one tap away.
import { router, type Href } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Note, Toggle } from "../../../components/garage";
import { ManageRow } from "../../../components/manage/ManagePage";
import { Block, Loaded, Page } from "../../../components/manage/Page";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { asActor, useSessionUser } from "../../../core/session/session";
import { towFleetService } from "../towService";
import { useTruckLabels } from "../truckBits";

export default function AvailabilityPage() {
  const { t } = useL();
  const u = useSessionUser();
  const { type } = useTruckLabels();
  const state = useLoad(() => towFleetService.getMyFleet(asActor(u)), [u.id]);
  const [busy, setBusy] = useState<string | null>(null), [error, setError] = useState<string | null>(null);
  const flip = async (id: string, on: boolean) => {
    if (busy) return;
    setBusy(id); setError(null);
    try { await towFleetService.setOperational(asActor(u), id, on ? "AVAILABLE" : "OUT_OF_SERVICE"); await state.reload(); } catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  };
  const avail = (state.data?.trucks ?? []).filter((x) => x.operational === "AVAILABLE").length;
  return (
    <Page title={t("Availability", "التوفر")} line={state.data ? t(`${avail} of ${state.data.trucks.length} trucks available`, `${avail} من ${state.data.trucks.length} شاحنات متاحة`) : undefined} onRefresh={() => void state.reload()} refreshing={false}>
      {error ? <Note tone="danger" icon="alert-circle-outline">{error}</Note> : null}
      <Loaded state={state}>{({ trucks }) => !trucks.length ? <Note>{t("No trucks yet. Add a truck to set availability.", "لا توجد شاحنات بعد. أضف شاحنة لتحديد التوفر.")}</Note> : (
        <Block>
          <View style={{ paddingVertical: 4 }}>
            {trucks.map((tr) => tr.verification === "APPROVED" && !tr.hasActiveJob ? (
              <Toggle key={tr.id} label={`${type[tr.type]} · ${tr.plate}`} sub={busy === tr.id ? t("Saving…", "جارٍ الحفظ…") : tr.operational === "AVAILABLE" ? t("Available for new jobs", "متاحة لمهام جديدة") : t("Out of service", "خارج الخدمة")}
                value={tr.operational === "AVAILABLE"} onChange={(v) => void flip(tr.id, v)} />
            ) : (
              <ManageRow key={tr.id} title={`${type[tr.type]} · ${tr.plate}`} sub={tr.hasActiveJob ? t("On a job: changes when it ends", "في مهمة: تتغير عند انتهائها") : t("Not approved yet", "غير معتمدة بعد")}
                status={{ label: tr.operational === "BUSY" ? t("Busy", "مشغولة") : t("Unavailable", "غير متاحة"), tone: "neutral" }} onPress={() => router.push(`/provider/tow/${tr.id}` as Href)} />
            ))}
          </View>
        </Block>
      )}</Loaded>
    </Page>
  );
}
