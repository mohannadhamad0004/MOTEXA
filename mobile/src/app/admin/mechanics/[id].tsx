import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import {
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLanguage } from "../../../i18n/LanguageContext";

type MechanicData = {
  name: string;
  specializationEn: string;
  specializationAr: string;
  experience: number;
};

const mechanicData: Record<string, MechanicData> = {
  "MEC-000125": {
    name: "Ahmed Ali",
    specializationEn: "Electrical • Diagnostics",
    specializationAr: "كهرباء • تشخيص أعطال",
    experience: 6,
  },
  "MEC-000124": {
    name: "Omar Khaled",
    specializationEn: "Engine • Brakes",
    specializationAr: "محركات • فرامل",
    experience: 8,
  },
  "MEC-000119": {
    name: "Yousef Nasser",
    specializationEn: "Suspension • Steering",
    specializationAr: "تعليق • توجيه",
    experience: 5,
  },
};

export default function MechanicReviewScreen() {
  const insets = useSafeAreaInsets();
  const { isArabic } = useLanguage();
  const { id } = useLocalSearchParams<{ id: string }>();

  const mechanic = mechanicData[id ?? ""];

  const t = {
    title: isArabic ? "مراجعة طلب الميكانيكي" : "Mechanic Application Review",
    subtitle: isArabic
      ? "تفاصيل الطلب ومراحل التحقق والاعتماد"
      : "Application details and verification progress",
    applicationId: isArabic ? "رقم الطلب" : "Application ID",
    verification: isArabic ? "مراحل الاعتماد" : "Verification Stages",
    pending: isArabic ? "بانتظار المراجعة" : "Pending Review",
    demo: isArabic ? "بيانات تجريبية" : "Demo Data",
  };

  const stages = [
    {
      icon: "person-outline" as const,
      en: "Application Submitted",
      ar: "تقديم طلب التسجيل",
    },
    {
      icon: "document-text-outline" as const,
      en: "Document Verification",
      ar: "مراجعة الوثائق",
    },
    {
      icon: "school-outline" as const,
      en: "Technical Assessment",
      ar: "التقييم الفني",
    },
    {
      icon: "people-outline" as const,
      en: "Interview",
      ar: "المقابلة",
    },
    {
      icon: "shield-checkmark-outline" as const,
      en: "Final Decision",
      ar: "القرار النهائي",
    },
  ];

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />

      <LinearGradient
        colors={["#120D0A", "#1C120D", "#17100C"]}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: insets.top + 15,
          paddingBottom: insets.bottom + 40,
        }}
      >
        {/* Back Button */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons
            name={isArabic ? "arrow-forward" : "arrow-back"}
            size={22}
            color="#D99B69"
          />
        </TouchableOpacity>

        {/* Page Header */}
        <Text style={[styles.title, isArabic && styles.right]}>{t.title}</Text>

        <Text style={[styles.subtitle, isArabic && styles.right]}>
          {t.subtitle}
        </Text>

        {/* Mechanic Information */}
        <View style={styles.card}>
          {mechanic && (
            <View style={styles.mechanicInfo}>
              <View style={styles.avatar}>
                <Ionicons name="person-outline" size={26} color="#D99B69" />
              </View>

              <Text style={[styles.mechanicName, isArabic && styles.right]}>
                {mechanic.name}
              </Text>

              <Text style={[styles.specialization, isArabic && styles.right]}>
                {isArabic
                  ? mechanic.specializationAr
                  : mechanic.specializationEn}
              </Text>

              <Text style={[styles.experience, isArabic && styles.right]}>
                {mechanic.experience}{" "}
                {isArabic ? "سنوات خبرة" : "Years of Experience"}
              </Text>
            </View>
          )}

          <Text style={styles.label}>{t.applicationId}</Text>

          <Text style={styles.id}>{id ?? "—"}</Text>

          <View style={styles.status}>
            <Ionicons name="time-outline" size={15} color="#D99B69" />
            <Text style={styles.statusText}>{t.pending}</Text>
          </View>
        </View>

        {/* Submitted Documents */}
        <View style={styles.card}>
          <View style={[styles.documentHeader, isArabic && styles.rowReverse]}>
            <Ionicons name="documents-outline" size={22} color="#D99B69" />

            <Text style={styles.documentsTitle}>
              {isArabic ? "الوثائق المقدمة" : "Submitted Documents"}
            </Text>
          </View>

          <Text style={[styles.documentsDescription, isArabic && styles.right]}>
            {isArabic
              ? "مراجعة وثائق الميكانيكي والتحقق من صحتها."
              : "Review and verify the mechanic's submitted documents."}
          </Text>

          {/* National ID */}
          <View style={[styles.documentItem, isArabic && styles.rowReverse]}>
            <Ionicons name="id-card-outline" size={25} color="#D99B69" />

            <View style={styles.documentInfo}>
              <Text style={[styles.documentName, isArabic && styles.right]}>
                {isArabic ? "الهوية الشخصية" : "National ID"}
              </Text>

              <Text style={[styles.documentStatus, isArabic && styles.right]}>
                {t.pending}
              </Text>
            </View>

            <Ionicons
              name={isArabic ? "chevron-back" : "chevron-forward"}
              size={18}
              color="#9A877A"
            />
          </View>
        </View>

        {/* Verification Stages */}
        <Text style={[styles.sectionTitle, isArabic && styles.right]}>
          {t.verification}
        </Text>

        {stages.map((stage, index) => (
          <View
            key={index}
            style={[styles.stageCard, isArabic && styles.rowReverse]}
          >
            <View style={styles.stageIcon}>
              <Ionicons name={stage.icon} size={21} color="#D99B69" />
            </View>

            <View style={styles.stageContent}>
              <Text style={[styles.stageTitle, isArabic && styles.right]}>
                {isArabic ? stage.ar : stage.en}
              </Text>

              <Text style={[styles.stageSubtitle, isArabic && styles.right]}>
                {t.pending}
              </Text>
            </View>

            <Ionicons name="ellipse-outline" size={19} color="#78665B" />
          </View>
        ))}

        <Text style={styles.demo}>{t.demo}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#120D0A",
  },
  backButton: {
    width: 45,
    height: 45,
    borderRadius: 14,
    backgroundColor: "#2B1B13",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 25,
  },
  title: {
    color: "#FFF5EA",
    fontSize: 25,
    fontWeight: "900",
  },
  subtitle: {
    color: "#9A877A",
    fontSize: 12,
    marginTop: 8,
    marginBottom: 25,
  },
  right: {
    textAlign: "right",
  },
  rowReverse: {
    flexDirection: "row-reverse",
  },
  card: {
    backgroundColor: "#281A13",
    borderWidth: 1,
    borderColor: "#4A3020",
    borderRadius: 20,
    padding: 20,
    marginBottom: 25,
  },
  mechanicInfo: {
    marginBottom: 20,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#382418",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  mechanicName: {
    color: "#FFF5EA",
    fontSize: 20,
    fontWeight: "900",
  },
  specialization: {
    color: "#D99B69",
    fontSize: 12,
    marginTop: 8,
  },
  experience: {
    color: "#9A877A",
    fontSize: 11,
    marginTop: 8,
  },
  label: {
    color: "#9A877A",
    fontSize: 11,
  },
  id: {
    color: "#FFF5EA",
    fontSize: 21,
    fontWeight: "900",
    marginTop: 8,
  },
  status: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 16,
  },
  statusText: {
    color: "#D99B69",
    fontSize: 11,
    fontWeight: "700",
  },
  documentHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  documentsTitle: {
    color: "#FFF5EA",
    fontSize: 15,
    fontWeight: "900",
  },
  documentsDescription: {
    color: "#9A877A",
    fontSize: 11,
    marginTop: 12,
  },
  documentItem: {
    marginTop: 18,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#352318",
    borderWidth: 1,
    borderColor: "#4A3020",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  documentInfo: {
    flex: 1,
  },
  documentName: {
    color: "#FFF5EA",
    fontSize: 12,
    fontWeight: "800",
  },
  documentStatus: {
    color: "#D99B69",
    fontSize: 10,
    marginTop: 5,
  },
  sectionTitle: {
    color: "#EADBD0",
    fontSize: 15,
    fontWeight: "900",
    marginBottom: 15,
  },
  stageCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#241710",
    borderWidth: 1,
    borderColor: "#3B281C",
    borderRadius: 17,
    padding: 16,
    marginBottom: 11,
  },
  stageIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: "#382418",
    justifyContent: "center",
    alignItems: "center",
  },
  stageContent: {
    flex: 1,
    marginHorizontal: 13,
  },
  stageTitle: {
    color: "#F2E4DA",
    fontSize: 12,
    fontWeight: "800",
  },
  stageSubtitle: {
    color: "#8F7D71",
    fontSize: 10,
    marginTop: 5,
  },
  demo: {
    textAlign: "center",
    color: "#79685E",
    fontSize: 10,
    marginTop: 22,
  },
});
