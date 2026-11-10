import { useState } from "react";
import { View } from "react-native";
import { Chip, Field, GText, Note } from "../../components/garage";
import { uploadErrorText } from "../../core/hooks/pickPhoto";
import { useL } from "../../core/hooks/useL";
import { gType, useGarageTheme } from "../../theme/garage";
import { CompanyDriver, companyDispatch } from "../tow/dispatchService";
import type { Truck } from "../tow/towService";
import { useTruckLabels } from "../tow/truckBits";
import { PhotoField, StepSheet } from "./steps";
import { normalizeNumberText } from "../../core/constants/numbers";

type Pick = { uri: string; base64: string };

/**
 * Add / edit a driver in three short steps: who (name, email, phone), the licence (number + private photo), photo and truck.
 * The phone and the licence are private: customers never see them. A new driver gets a sign-in code by email and starts PENDING
 * until MOTEXA approves the licence. `self` = "I drive too" (no new login). Editing sends only what changed.
 */
export function DriverWizard({ driver, self, trucks, onClose, onSaved }: { driver?: CompanyDriver; self?: boolean; trucks: Truck[]; onClose: () => void; onSaved: () => void }) {
  const { t } = useL();
  const { type } = useTruckLabels();
  const { row, align } = useGarageTheme();
  const [fullName, setFullName] = useState(driver?.name ?? "");
  const [email, setEmail] = useState(driver?.email ?? "");
  const [phone, setPhone] = useState(driver?.phone ?? "");
  const [licenceNumber, setLicenceNumber] = useState(driver?.licenceNumber ?? "");
  const [licence, setLicence] = useState<Pick | null>(null);
  const [photo, setPhoto] = useState<Pick | null>(null);
  const [truckId, setTruckId] = useState<string | null>(driver?.truck?.id ?? null);
  const isSelf = self || driver?.isOwner;

  const validate = (s: number) => {
    if (s === 0) {
      if (!isSelf && !driver && fullName.trim().length < 3) return t("Enter the driver's full name.", "أدخل الاسم الكامل للسائق.");
      if (!isSelf && !driver && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return t("Enter a valid email: the driver gets his sign-in code there.", "أدخل بريدًا صحيحًا: سيصل إليه رمز الدخول.");
      if (phone.trim().length < 8) return t("Enter the driver's phone.", "أدخل هاتف السائق.");
    }
    if (s === 1) {
      if (licenceNumber.trim().length < 4) return t("Enter the licence number.", "أدخل رقم الرخصة.");
      if (!driver && !licence) return t("Add a photo of the driving licence.", "أضف صورة رخصة القيادة.");
    }
    return null;
  };
  const save = async () => {
    try {
      if (driver) {
        await companyDispatch.updateDriver(driver.id, {
          phone: phone.trim(),
          ...(truckId !== (driver.truck?.id ?? null) ? { truckId } : {}),
          ...(licenceNumber.trim() !== (driver.licenceNumber ?? "") ? { licenceNumber: licenceNumber.trim() } : {}),
          ...(licence ? { licencePhoto: { dataBase64: licence.base64, name: "licence.jpg" } } : {}),
          ...(photo ? { photo: { dataBase64: photo.base64, name: "driver.jpg" } } : {}),
        });
      } else {
        await companyDispatch.addDriver({
          self: !!isSelf,
          fullName: fullName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          licenceNumber: licenceNumber.trim(),
          licencePhoto: { dataBase64: licence!.base64, name: "licence.jpg" },
          ...(photo ? { photo: { dataBase64: photo.base64, name: "driver.jpg" } } : {}),
          truckId,
        });
      }
    } catch (e) {
      throw new Error(uploadErrorText(e, t));
    }
    onSaved();
  };

  return (
    <StepSheet
      visible
      title={driver ? t("Edit driver", "تعديل السائق") : isSelf ? t("I drive too", "أنا أقود أيضًا") : t("Add driver", "إضافة سائق")}
      steps={[t("Who", "من هو"), t("Driving licence", "رخصة القيادة"), t("Photo and truck", "الصورة والشاحنة")]}
      onClose={onClose}
      validate={validate}
      onSave={save}
      render={(s) =>
        s === 0 ? (
          <View>
            {!isSelf && !driver ? (
              <>
                <Field label={t("Full name", "الاسم الكامل")} value={fullName} onChangeText={setFullName} maxLength={80} />
                <Field label={t("Email (he signs in with it)", "البريد الإلكتروني (يسجّل الدخول به)")} value={email} onChangeText={setEmail} autoCapitalize="none" maxLength={120} />
              </>
            ) : null}
            <Field label={t("Phone (private, never shown to customers)", "الهاتف (خاص، لا يظهر للزبائن)")} value={phone} onChangeText={v => setPhone(normalizeNumberText(v))} keyboardType="phone-pad" maxLength={24} />
            {!driver && !isSelf ? <Note icon="mail-outline">{t("We email him a code to set his own password.", "نرسل له رمزًا بالبريد ليعيّن كلمة مروره بنفسه.")}</Note> : null}
          </View>
        ) : s === 1 ? (
          <View>
            <Field label={t("Licence number", "رقم الرخصة")} value={licenceNumber} onChangeText={setLicenceNumber} autoCapitalize="characters" maxLength={40} />
            <PhotoField required={!driver} label={t("Licence photo (private)", "صورة الرخصة (خاصة)")} value={licence?.uri ?? null} onChange={(uri, base64) => setLicence({ uri, base64 })} hint={driver ? t("Changing the licence sends the driver to review again.", "تغيير الرخصة يعيد السائق إلى المراجعة.") : t("Only you and MOTEXA's review team see it.", "لا يراها إلا أنت وفريق المراجعة.")} />
          </View>
        ) : (
          <View>
            <PhotoField round label={t("Driver photo", "صورة السائق")} value={photo?.uri ?? driver?.photoUri ?? null} onChange={(uri, base64) => setPhoto({ uri, base64 })} hint={t("Customers see it on the driver card.", "يراها الزبائن على بطاقة السائق.")} />
            <GText style={[gType.caption, align, { fontWeight: "700", marginBottom: 6 }]}>{t("Assigned truck", "الشاحنة المعيّنة")}</GText>
            <View style={[row, { flexWrap: "wrap", gap: 8 }]}>
              <Chip label={t("None", "بدون")} on={!truckId} onPress={() => setTruckId(null)} />
              {trucks.map((tr) => <Chip key={tr.id} label={`${tr.plate} · ${type[tr.type]}`} on={truckId === tr.id} onPress={() => setTruckId(tr.id)} />)}
            </View>
          </View>
        )
      }
    />
  );
}
