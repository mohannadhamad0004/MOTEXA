import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLanguage } from "../../../i18n/LanguageContext";

type ProviderType = {
  id: string;
  titleEn: string;
  titleAr: string;
  descriptionEn: string;
  descriptionAr: string;
  icon: keyof typeof Ionicons.glyphMap;
  verified: number;
  pending: number;
};

type ApplicationType = {
  id: string;
  name: string;
  typeEn: string;
  typeAr: string;
  detailEn: string;
  detailAr: string;
  statusEn: string;
  statusAr: string;
  timeEn: string;
  timeAr: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const providerTypes: ProviderType[] = [
  {
    id: "mechanics",
    titleEn: "Mechanics",
    titleAr: "الميكانيكيون",
    descriptionEn: "Technical service specialists",
    descriptionAr: "متخصصو خدمات وصيانة المركبات",
    icon: "construct-outline",
    verified: 46,
    pending: 7,
  },
  {
    id: "parts",
    titleEn: "Parts Providers",
    titleAr: "مزودو قطع الغيار",
    descriptionEn: "Parts shops & verified suppliers",
    descriptionAr: "متاجر وموردو قطع الغيار",
    icon: "settings-outline",
    verified: 25,
    pending: 3,
  },
  {
    id: "tow",
    titleEn: "Tow Providers",
    titleAr: "مزودو خدمات السحب",
    descriptionEn: "Roadside & towing services",
    descriptionAr: "خدمات السحب والمساعدة على الطريق",
    icon: "car-sport-outline",
    verified: 15,
    pending: 2,
  },
];

const applications: ApplicationType[] = [
  {
    id: "MEC-000125",
    name: "Ahmed Ali",
    typeEn: "Mechanic",
    typeAr: "ميكانيكي",
    detailEn: "Electrical • Diagnostics",
    detailAr: "كهرباء • تشخيص أعطال",
    statusEn: "DOCUMENT REVIEW",
    statusAr: "مراجعة الوثائق",
    timeEn: "Submitted today",
    timeAr: "تم التقديم اليوم",
    icon: "construct-outline",
  },
  {
    id: "MEC-000124",
    name: "Omar Khaled",
    typeEn: "Mechanic",
    typeAr: "ميكانيكي",
    detailEn: "Engine • Brakes",
    detailAr: "محركات • فرامل",
    statusEn: "INTERVIEW",
    statusAr: "المقابلة",
    timeEn: "Interview scheduled",
    timeAr: "تم تحديد موعد المقابلة",
    icon: "construct-outline",
  },
  {
    id: "PRT-000041",
    name: "Auto Parts Center",
    typeEn: "Parts Provider",
    typeAr: "مزود قطع غيار",
    detailEn: "OEM • Aftermarket",
    detailAr: "أصلي • بديل",
    statusEn: "FINAL REVIEW",
    statusAr: "المراجعة النهائية",
    timeEn: "Updated 2h ago",
    timeAr: "تم التحديث قبل ساعتين",
    icon: "settings-outline",
  },
];

export default function ProvidersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isArabic, toggleLanguage } = useLanguage();

  const [search, setSearch] = useState("");

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 550,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 550,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const text = {
    title: isArabic ? "مزودو الخدمة" : "Providers",
    subtitle: isArabic
      ? "إدارة شبكة خدمات MOTEXA"
      : "Manage the MOTEXA service network",
    search: isArabic ? "ابحث عن مزود خدمة..." : "Search providers...",
    pending: isArabic ? "بانتظار التحقق" : "Pending",
    verified: isArabic ? "مزود معتمد" : "Verified",
    underReview: isArabic ? "قيد المراجعة" : "Under Review",
    network: isArabic ? "شبكة الخدمات" : "SERVICE NETWORK",
    networkSub: isArabic
      ? "إدارة أنواع مزودي الخدمة"
      : "Manage provider categories",
    verifiedLabel: isArabic ? "معتمد" : "Verified",
    applicationsLabel: isArabic ? "طلبات معلقة" : "Pending",
    queue: isArabic ? "طلبات تحتاج مراجعة" : "VERIFICATION QUEUE",
    queueSub: isArabic
      ? "الطلبات التي تحتاج إلى إجراء إداري"
      : "Applications requiring admin attention",
    review: isArabic ? "مراجعة" : "Review",
    viewAll: isArabic ? "عرض الكل" : "View all",
    controlCenter: isArabic
      ? "مركز إدارة شبكة MOTEXA"
      : "MOTEXA SERVICE NETWORK CONTROL",
  };

  const totalPending = providerTypes.reduce(
    (total, provider) => total + provider.pending,
    0
  );

  const totalVerified = providerTypes.reduce(
    (total, provider) => total + provider.verified,
    0
  );

  const filteredApplications = applications.filter((item) => {
    const value = search.trim().toLowerCase();

    if (!value) return true;

    return (
      item.name.toLowerCase().includes(value) ||
      item.id.toLowerCase().includes(value) ||
      item.typeEn.toLowerCase().includes(value) ||
      item.typeAr.includes(search.trim())
    );
  });

  return (
    <View style={styles.screen}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="#120D0A"
      />

      <LinearGradient
        colors={["#120D0A", "#1C120D", "#17100C"]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.glowTop} />
      <View style={styles.glowSide} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + 14,
            paddingBottom: 125 + insets.bottom,
          },
        ]}
      >
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }}
        >
          {/* HEADER */}
          <View
            style={[
              styles.header,
              isArabic && styles.rowReverse,
            ]}
          >
            <View style={styles.headerTextContainer}>
              <View
                style={[
                  styles.brandRow,
                  isArabic && styles.rowReverse,
                ]}
              >
                <View style={styles.brandLine} />

                <Text style={styles.brandText}>
                  MOTEXA ADMIN
                </Text>
              </View>

              <Text
                style={[
                  styles.title,
                  isArabic && styles.textRight,
                ]}
              >
                {text.title}
              </Text>

              <Text
                style={[
                  styles.subtitle,
                  isArabic && styles.textRight,
                ]}
              >
                {text.subtitle}
              </Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.languageButton}
              onPress={toggleLanguage}
            >
              <Ionicons
                name="language-outline"
                size={18}
                color="#E1A16F"
              />

              <Text style={styles.languageText}>
                {isArabic ? "EN" : "AR"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* SEARCH */}
          <View
            style={[
              styles.searchContainer,
              isArabic && styles.rowReverse,
            ]}
          >
            <Ionicons
              name="search-outline"
              size={20}
              color="#A99181"
            />

            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={text.search}
              placeholderTextColor="#7E6D62"
              style={[
                styles.searchInput,
                isArabic && styles.searchInputArabic,
              ]}
            />

            {search.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearch("")}
                style={styles.clearButton}
              >
                <Ionicons
                  name="close-circle"
                  size={19}
                  color="#8F7E73"
                />
              </TouchableOpacity>
            )}
          </View>

          {/* SUMMARY */}
          <View style={styles.summaryRow}>
            <SummaryCard
              icon="time-outline"
              value={totalPending.toString()}
              label={text.pending}
            />

            <SummaryCard
              icon="shield-checkmark-outline"
              value={totalVerified.toString()}
              label={text.verified}
            />

            <SummaryCard
              icon="eye-outline"
              value="8"
              label={text.underReview}
            />
          </View>

          {/* SERVICE NETWORK */}
          <SectionHeader
            title={text.network}
            subtitle={text.networkSub}
            isArabic={isArabic}
          />

          <View style={styles.providerList}>
            {providerTypes.map((provider) => (
              <TouchableOpacity
                key={provider.id}
                activeOpacity={0.82}
                style={styles.providerCard}
onPress={() => {
  if (provider.id === "mechanics") {
router.push("/admin/mechanics");  }
}}
              >
                <LinearGradient
                  colors={["#2B1B13", "#21150F"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.providerGradient}
                >
                  <View
                    style={[
                      styles.providerTop,
                      isArabic && styles.rowReverse,
                    ]}
                  >
                    <View
                      style={[
                        styles.providerIdentity,
                        isArabic && styles.rowReverse,
                      ]}
                    >
                      <View style={styles.providerIcon}>
                        <Ionicons
                          name={provider.icon}
                          size={25}
                          color="#D99B69"
                        />
                      </View>

                      <View
                        style={[
                          styles.providerTextContainer,
                          isArabic && styles.alignEnd,
                        ]}
                      >
                        <Text
                          style={[
                            styles.providerTitle,
                            isArabic && styles.textRight,
                          ]}
                        >
                          {isArabic
                            ? provider.titleAr
                            : provider.titleEn}
                        </Text>

                        <Text
                          style={[
                            styles.providerDescription,
                            isArabic && styles.textRight,
                          ]}
                          numberOfLines={1}
                        >
                          {isArabic
                            ? provider.descriptionAr
                            : provider.descriptionEn}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.arrowButton}>
                      <Ionicons
                        name={
                          isArabic
                            ? "chevron-back"
                            : "chevron-forward"
                        }
                        size={18}
                        color="#D99B69"
                      />
                    </View>
                  </View>

                  <View style={styles.divider} />

                  <View
                    style={[
                      styles.providerStats,
                      isArabic && styles.rowReverse,
                    ]}
                  >
                    <View
                      style={[
                        styles.miniStat,
                        isArabic && styles.rowReverse,
                      ]}
                    >
                      <View style={styles.verifiedDot} />

                      <Text style={styles.miniStatValue}>
                        {provider.verified}
                      </Text>

                      <Text style={styles.miniStatLabel}>
                        {text.verifiedLabel}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.miniStat,
                        isArabic && styles.rowReverse,
                      ]}
                    >
                      <View style={styles.pendingDot} />

                      <Text style={styles.miniStatValue}>
                        {provider.pending}
                      </Text>

                      <Text style={styles.miniStatLabel}>
                        {text.applicationsLabel}
                      </Text>
                    </View>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>

          {/* VERIFICATION QUEUE */}
          <View
            style={[
              styles.queueHeading,
              isArabic && styles.rowReverse,
            ]}
          >
            <View style={styles.queueTitleArea}>
              <Text
                style={[
                  styles.sectionTitle,
                  isArabic && styles.textRight,
                ]}
              >
                {text.queue}
              </Text>

              <Text
                style={[
                  styles.sectionSubtitle,
                  isArabic && styles.textRight,
                ]}
              >
                {text.queueSub}
              </Text>
            </View>

            <TouchableOpacity activeOpacity={0.7}>
              <Text style={styles.viewAllText}>
                {text.viewAll}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.queueList}>
            {filteredApplications.map((application) => (
              <View
                key={application.id}
                style={styles.applicationCard}
              >
                <View
                  style={[
                    styles.applicationTop,
                    isArabic && styles.rowReverse,
                  ]}
                >
                  <View
                    style={[
                      styles.applicationIdentity,
                      isArabic && styles.rowReverse,
                    ]}
                  >
                    <View style={styles.avatar}>
                      <Ionicons
                        name={application.icon}
                        size={21}
                        color="#D99B69"
                      />
                    </View>

                    <View
                      style={[
                        styles.applicationNameArea,
                        isArabic && styles.alignEnd,
                      ]}
                    >
                      <Text
                        style={[
                          styles.applicationName,
                          isArabic && styles.textRight,
                        ]}
                      >
                        {application.name}
                      </Text>

                      <Text
                        style={[
                          styles.applicationType,
                          isArabic && styles.textRight,
                        ]}
                      >
                        {isArabic
                          ? application.typeAr
                          : application.typeEn}
                        {"  •  "}
                        {application.id}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.statusBadge}>
                    <View style={styles.statusDot} />

                    <Text style={styles.statusText}>
                      {isArabic
                        ? application.statusAr
                        : application.statusEn}
                    </Text>
                  </View>
                </View>

                <View style={styles.applicationDivider} />

                <View
                  style={[
                    styles.applicationBottom,
                    isArabic && styles.rowReverse,
                  ]}
                >
                  <View
                    style={[
                      styles.applicationInfo,
                      isArabic && styles.alignEnd,
                    ]}
                  >
                    <Text
                      style={[
                        styles.applicationDetail,
                        isArabic && styles.textRight,
                      ]}
                    >
                      {isArabic
                        ? application.detailAr
                        : application.detailEn}
                    </Text>

                    <View
                      style={[
                        styles.timeRow,
                        isArabic && styles.rowReverse,
                      ]}
                    >
                      <Ionicons
                        name="time-outline"
                        size={13}
                        color="#8F7E73"
                      />

                      <Text style={styles.applicationTime}>
                        {isArabic
                          ? application.timeAr
                          : application.timeEn}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={[
                      styles.reviewButton,
                      isArabic && styles.rowReverse,
                    ]}
                    onPress={() => {
                      // Application details screen comes later.
                    }}
                  >
                    <Text style={styles.reviewButtonText}>
                      {text.review}
                    </Text>

                    <Ionicons
                      name={
                        isArabic
                          ? "arrow-back"
                          : "arrow-forward"
                      }
                      size={14}
                      color="#1A110C"
                    />
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            {filteredApplications.length === 0 && (
              <View style={styles.emptyState}>
                <Ionicons
                  name="search-outline"
                  size={30}
                  color="#7E6D62"
                />

                <Text style={styles.emptyTitle}>
                  {isArabic
                    ? "لا توجد نتائج"
                    : "No providers found"}
                </Text>

                <Text style={styles.emptyText}>
                  {isArabic
                    ? "جرّب البحث باسم أو رقم طلب مختلف."
                    : "Try searching with another name or application ID."}
                </Text>
              </View>
            )}
          </View>

          {/* FOOTER */}
          <View style={styles.footer}>
            <View style={styles.footerLine} />

            <View style={styles.footerLogo}>
              <Ionicons
                name="car-sport"
                size={15}
                color="#A96B43"
              />

              <Text style={styles.footerText}>
                {text.controlCenter}
              </Text>
            </View>

            <View style={styles.footerLine} />
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

function SummaryCard({
  icon,
  value,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
}) {
  return (
    <View style={styles.summaryCard}>
      <View style={styles.summaryIcon}>
        <Ionicons
          name={icon}
          size={18}
          color="#D99B69"
        />
      </View>

      <Text style={styles.summaryValue}>
        {value}
      </Text>

      <Text
        style={styles.summaryLabel}
        numberOfLines={2}
      >
        {label}
      </Text>
    </View>
  );
}

function SectionHeader({
  title,
  subtitle,
  isArabic,
}: {
  title: string;
  subtitle: string;
  isArabic: boolean;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text
        style={[
          styles.sectionTitle,
          isArabic && styles.textRight,
        ]}
      >
        {title}
      </Text>

      <Text
        style={[
          styles.sectionSubtitle,
          isArabic && styles.textRight,
        ]}
      >
        {subtitle}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#120D0A",
  },

  scrollContent: {
    paddingHorizontal: 18,
  },

  glowTop: {
    position: "absolute",
    width: 230,
    height: 230,
    borderRadius: 115,
    backgroundColor: "rgba(180, 101, 55, 0.07)",
    top: -90,
    right: -75,
  },

  glowSide: {
    position: "absolute",
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: "rgba(217, 155, 105, 0.035)",
    top: 370,
    left: -100,
  },

  rowReverse: {
    flexDirection: "row-reverse",
  },

  textRight: {
    textAlign: "right",
  },

  alignEnd: {
    alignItems: "flex-end",
  },

  /* HEADER */

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 22,
  },

  headerTextContainer: {
    flex: 1,
    paddingRight: 14,
  },

  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 8,
  },

  brandLine: {
    width: 18,
    height: 2,
    borderRadius: 2,
    backgroundColor: "#B87345",
  },

  brandText: {
    color: "#B87345",
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: "800",
  },

  title: {
    color: "#FFF5EA",
    fontSize: 30,
    lineHeight: 37,
    fontWeight: "800",
    letterSpacing: -0.7,
  },

  subtitle: {
    color: "#A99181",
    fontSize: 13,
    lineHeight: 20,
    marginTop: 3,
  },

  languageButton: {
    minWidth: 54,
    height: 40,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(217,155,105,0.22)",
    backgroundColor: "rgba(217,155,105,0.07)",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 5,
  },

  languageText: {
    color: "#E1A16F",
    fontSize: 11,
    fontWeight: "800",
  },

  /* SEARCH */

  searchContainer: {
    height: 54,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "rgba(217,155,105,0.14)",
    backgroundColor: "rgba(255,245,234,0.045)",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 16,
  },

  searchInput: {
    flex: 1,
    height: "100%",
    color: "#FFF5EA",
    marginLeft: 10,
    fontSize: 14,
  },

  searchInputArabic: {
    marginLeft: 0,
    marginRight: 10,
    textAlign: "right",
  },

  clearButton: {
    padding: 4,
  },

  /* SUMMARY */

  summaryRow: {
    flexDirection: "row",
    gap: 9,
    marginBottom: 30,
  },

  summaryCard: {
    flex: 1,
    minHeight: 118,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(217,155,105,0.13)",
    backgroundColor: "rgba(43,27,19,0.78)",
    padding: 12,
    justifyContent: "space-between",
  },

  summaryIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(217,155,105,0.09)",
    alignItems: "center",
    justifyContent: "center",
  },

  summaryValue: {
    color: "#FFF5EA",
    fontSize: 24,
    fontWeight: "800",
    marginTop: 9,
  },

  summaryLabel: {
    color: "#9C8A7E",
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "600",
    marginTop: 3,
  },

  /* SECTIONS */

  sectionHeader: {
    marginBottom: 14,
  },

  sectionTitle: {
    color: "#E8D8CC",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
  },

  sectionSubtitle: {
    color: "#796A60",
    fontSize: 11,
    marginTop: 4,
  },

  /* PROVIDERS */

  providerList: {
    gap: 11,
    marginBottom: 31,
  },

  providerCard: {
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(217,155,105,0.13)",
  },

  providerGradient: {
    padding: 16,
  },

  providerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  providerIdentity: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },

  providerIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: "rgba(217,155,105,0.09)",
    borderWidth: 1,
    borderColor: "rgba(217,155,105,0.13)",
    alignItems: "center",
    justifyContent: "center",
  },

  providerTextContainer: {
    flex: 1,
    marginHorizontal: 12,
  },

  providerTitle: {
    color: "#FFF5EA",
    fontSize: 16,
    fontWeight: "800",
  },

  providerDescription: {
    color: "#907E72",
    fontSize: 11,
    marginTop: 4,
  },

  arrowButton: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: "rgba(217,155,105,0.07)",
    alignItems: "center",
    justifyContent: "center",
  },

  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.045)",
    marginVertical: 14,
  },

  providerStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
  },

  miniStat: {
    flexDirection: "row",
    alignItems: "center",
  },

  verifiedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#8FAE88",
    marginRight: 6,
  },

  pendingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#D99B69",
    marginRight: 6,
  },

  miniStatValue: {
    color: "#E9D8CB",
    fontSize: 12,
    fontWeight: "800",
    marginRight: 4,
  },

  miniStatLabel: {
    color: "#8F7E73",
    fontSize: 10,
  },

  /* QUEUE */

  queueHeading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },

  queueTitleArea: {
    flex: 1,
  },

  viewAllText: {
    color: "#D99B69",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 1,
  },

  queueList: {
    gap: 10,
  },

  applicationCard: {
    borderRadius: 19,
    padding: 15,
    backgroundColor: "rgba(34,22,16,0.88)",
    borderWidth: 1,
    borderColor: "rgba(217,155,105,0.11)",
  },

  applicationTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  applicationIdentity: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },

  avatar: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: "rgba(217,155,105,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },

  applicationNameArea: {
    flex: 1,
    marginHorizontal: 10,
  },

  applicationName: {
    color: "#F5E9DF",
    fontSize: 14,
    fontWeight: "800",
  },

  applicationType: {
    color: "#827166",
    fontSize: 9,
    marginTop: 4,
  },

  statusBadge: {
    maxWidth: 118,
    minHeight: 28,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 9,
    backgroundColor: "rgba(217,155,105,0.08)",
    borderWidth: 1,
    borderColor: "rgba(217,155,105,0.13)",
    flexDirection: "row",
    alignItems: "center",
  },

  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#D99B69",
    marginRight: 5,
  },

  statusText: {
    flexShrink: 1,
    color: "#D99B69",
    fontSize: 8,
    lineHeight: 11,
    fontWeight: "800",
  },

  applicationDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.04)",
    marginVertical: 13,
  },

  applicationBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  applicationInfo: {
    flex: 1,
    paddingRight: 10,
  },

  applicationDetail: {
    color: "#B8A497",
    fontSize: 11,
    fontWeight: "600",
  },

  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },

  applicationTime: {
    color: "#77685E",
    fontSize: 9,
  },

  reviewButton: {
    minWidth: 78,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 11,
    backgroundColor: "#D99B69",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },

  reviewButtonText: {
    color: "#1A110C",
    fontSize: 10,
    fontWeight: "900",
  },

  /* EMPTY */

  emptyState: {
    minHeight: 180,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(217,155,105,0.1)",
    backgroundColor: "rgba(34,22,16,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 25,
  },

  emptyTitle: {
    color: "#EADCD1",
    fontSize: 14,
    fontWeight: "800",
    marginTop: 10,
  },

  emptyText: {
    color: "#817066",
    fontSize: 10,
    lineHeight: 16,
    textAlign: "center",
    marginTop: 5,
  },

  /* FOOTER */

  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 32,
    marginBottom: 8,
  },

  footerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(184,115,69,0.12)",
  },

  footerLogo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginHorizontal: 10,
  },

  footerText: {
    color: "#745B4C",
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 1,
  },
});