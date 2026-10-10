import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLanguage } from "../../../i18n/LanguageContext";

type TabType = "applications" | "verified";

type MechanicApplication = {
  id: string;
  name: string;
  initials: string;
  specializationsEn: string;
  specializationsAr: string;
  experience: number;
  stageEn: string;
  stageAr: string;
  submittedEn: string;
  submittedAr: string;
};

type VerifiedMechanic = {
  id: string;
  name: string;
  initials: string;
  specializationsEn: string;
  specializationsAr: string;
  rating: number;
  jobs: number;
  availability: "available" | "busy";
};

const applications: MechanicApplication[] = [
  {
    id: "MEC-000125",
    name: "Ahmed Ali",
    initials: "AA",
    specializationsEn: "Electrical • Diagnostics",
    specializationsAr: "كهرباء • تشخيص أعطال",
    experience: 6,
    stageEn: "DOCUMENT REVIEW",
    stageAr: "مراجعة الوثائق",
    submittedEn: "Submitted today",
    submittedAr: "تم التقديم اليوم",
  },
  {
    id: "MEC-000124",
    name: "Omar Khaled",
    initials: "OK",
    specializationsEn: "Engine • Brakes",
    specializationsAr: "محركات • فرامل",
    experience: 8,
    stageEn: "TECHNICAL ASSESSMENT",
    stageAr: "التقييم التقني",
    submittedEn: "Updated 2h ago",
    submittedAr: "تم التحديث قبل ساعتين",
  },
  {
    id: "MEC-000119",
    name: "Yousef Nasser",
    initials: "YN",
    specializationsEn: "Suspension • Steering",
    specializationsAr: "تعليق • توجيه",
    experience: 5,
    stageEn: "INTERVIEW",
    stageAr: "المقابلة",
    submittedEn: "Interview scheduled",
    submittedAr: "تم تحديد موعد المقابلة",
  },
];

const verifiedMechanics: VerifiedMechanic[] = [
  {
    id: "MEC-000082",
    name: "Sami Hasan",
    initials: "SH",
    specializationsEn: "Engine • General Mechanics",
    specializationsAr: "محركات • ميكانيكا عامة",
    rating: 4.9,
    jobs: 127,
    availability: "available",
  },
  {
    id: "MEC-000076",
    name: "Khaled Ahmad",
    initials: "KA",
    specializationsEn: "Electrical • Diagnostics",
    specializationsAr: "كهرباء • تشخيص أعطال",
    rating: 4.8,
    jobs: 94,
    availability: "busy",
  },
];

export default function MechanicsScreen() {
  const insets = useSafeAreaInsets();

  // Language switch
  const { isArabic, toggleLanguage } = useLanguage();

  const [activeTab, setActiveTab] = useState<TabType>("applications");

  const [search, setSearch] = useState("");

  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slide, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fade, slide]);

  const t = {
    title: isArabic ? "شبكة الميكانيكيين" : "Mechanic Network",

    subtitle: isArabic
      ? "إدارة الميكانيكيين وطلبات الاعتماد"
      : "Manage mechanics & verification applications",

    verified: isArabic ? "معتمد" : "Verified",

    pending: isArabic ? "طلبات معلقة" : "Pending",

    review: isArabic ? "قيد المراجعة" : "Under Review",

    interviews: isArabic ? "مقابلات" : "Interviews",

    search: isArabic
      ? "ابحث بالاسم أو رقم الطلب..."
      : "Search name or application ID...",

    applications: isArabic ? "طلبات الاعتماد" : "Applications",

    verifiedTab: isArabic ? "المعتمدون" : "Verified",

    pipeline: isArabic ? "مسار طلبات الاعتماد" : "APPLICATION PIPELINE",

    pipelineSub: isArabic
      ? "تابع كل طلب حسب مرحلته الحالية"
      : "Track each application through verification",

    experience: isArabic ? "سنوات خبرة" : "Years Experience",

    reviewButton: isArabic ? "مراجعة" : "Review",

    verifiedNetwork: isArabic ? "الميكانيكيون المعتمدون" : "VERIFIED MECHANICS",

    verifiedSub: isArabic
      ? "أعضاء شبكة MOTEXA المعتمدون"
      : "Approved members of the MOTEXA network",

    jobs: isArabic ? "خدمة" : "Jobs",

    rating: isArabic ? "التقييم" : "Rating",

    available: isArabic ? "متاح" : "Available",

    busy: isArabic ? "مشغول" : "Busy",

    profile: isArabic ? "عرض الملف" : "Profile",

    noResults: isArabic ? "لا توجد نتائج" : "No results found",

    networkLabel: isArabic
      ? "شبكة ميكانيكيي MOTEXA"
      : "MOTEXA MECHANIC NETWORK",

    footer: isArabic
      ? "نظام MOTEXA لاعتماد الميكانيكيين"
      : "MOTEXA MECHANIC VERIFICATION SYSTEM",
  };

  const filteredApplications = applications.filter((item) => {
    const query = search.trim().toLowerCase();

    if (!query) return true;

    return (
      item.name.toLowerCase().includes(query) ||
      item.id.toLowerCase().includes(query) ||
      item.specializationsEn.toLowerCase().includes(query) ||
      item.specializationsAr.includes(search.trim())
    );
  });

  const filteredVerified = verifiedMechanics.filter((item) => {
    const query = search.trim().toLowerCase();

    if (!query) return true;

    return (
      item.name.toLowerCase().includes(query) ||
      item.id.toLowerCase().includes(query) ||
      item.specializationsEn.toLowerCase().includes(query) ||
      item.specializationsAr.includes(search.trim())
    );
  });

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor="#120D0A" />

      <LinearGradient
        colors={["#120D0A", "#1C120D", "#17100C"]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.glow} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + 12,
            paddingBottom: insets.bottom + 35,
          },
        ]}
      >
        <Animated.View
          style={{
            opacity: fade,
            transform: [{ translateY: slide }],
          }}
        >
          {/* HEADER */}
          <View style={styles.header}>
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Ionicons
                name={isArabic ? "arrow-forward" : "arrow-back"}
                size={21}
                color="#E0A06D"
              />
            </TouchableOpacity>

            <View style={[styles.headerText, isArabic && styles.alignEnd]}>
              <View style={[styles.eyebrow, isArabic && styles.rowReverse]}>
                <View style={styles.eyebrowLine} />

                <Text style={styles.eyebrowText}>MOTEXA VERIFIED NETWORK</Text>
              </View>

              <Text
                style={[styles.title, isArabic && styles.textRight]}
                numberOfLines={2}
              >
                {t.title}
              </Text>

              <Text
                style={[styles.subtitle, isArabic && styles.textRight]}
                numberOfLines={2}
              >
                {t.subtitle}
              </Text>
            </View>

            {/* LANGUAGE BUTTON */}
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.languageButton}
              onPress={toggleLanguage}
            >
              <Ionicons name="language-outline" size={17} color="#E1A16F" />

              <Text style={styles.languageText}>{isArabic ? "EN" : "AR"}</Text>
            </TouchableOpacity>
          </View>

          {/* NETWORK STATUS */}
          <View style={styles.networkPanel}>
            <LinearGradient
              colors={["#2A1A12", "#20140E"]}
              style={styles.networkGradient}
            >
              <View
                style={[styles.networkHeader, isArabic && styles.rowReverse]}
              >
                <View style={isArabic ? styles.alignEnd : undefined}>
                  <Text
                    style={[styles.networkSmall, isArabic && styles.textRight]}
                  >
                    {t.networkLabel}
                  </Text>

                  <Text style={styles.networkBig}>46</Text>

                  <Text style={styles.networkCaption}>{t.verified}</Text>
                </View>

                <View style={styles.shield}>
                  <Ionicons name="shield-checkmark" size={27} color="#D99B69" />
                </View>
              </View>

              <View style={styles.networkDivider} />

              <View
                style={[styles.networkStats, isArabic && styles.rowReverse]}
              >
                <MiniMetric value="7" label={t.pending} icon="time-outline" />

                <MiniMetric value="4" label={t.review} icon="eye-outline" />

                <MiniMetric
                  value="2"
                  label={t.interviews}
                  icon="people-outline"
                />
              </View>
            </LinearGradient>
          </View>

          {/* SEARCH */}
          <View style={[styles.search, isArabic && styles.rowReverse]}>
            <Ionicons name="search-outline" size={19} color="#9A877A" />

            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={t.search}
              placeholderTextColor="#74645A"
              style={[styles.searchInput, isArabic && styles.searchInputArabic]}
            />

            {!!search && (
              <TouchableOpacity onPress={() => setSearch("")}>
                <Ionicons name="close-circle" size={19} color="#8C796D" />
              </TouchableOpacity>
            )}
          </View>

          {/* APPLICATIONS / VERIFIED */}
          <View style={[styles.tabs, isArabic && styles.rowReverse]}>
            <TouchableOpacity
              activeOpacity={0.8}
              style={[
                styles.tab,
                activeTab === "applications" && styles.activeTab,
              ]}
              onPress={() => setActiveTab("applications")}
            >
              <Ionicons
                name="document-text-outline"
                size={17}
                color={activeTab === "applications" ? "#1B110C" : "#8F7D71"}
              />

              <Text
                style={[
                  styles.tabText,
                  activeTab === "applications" && styles.activeTabText,
                ]}
              >
                {t.applications}
              </Text>

              <View
                style={[
                  styles.countBadge,
                  activeTab === "applications" && styles.activeCountBadge,
                ]}
              >
                <Text
                  style={[
                    styles.countText,
                    activeTab === "applications" && styles.activeCountText,
                  ]}
                >
                  7
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              style={[styles.tab, activeTab === "verified" && styles.activeTab]}
              onPress={() => setActiveTab("verified")}
            >
              <Ionicons
                name="checkmark-circle-outline"
                size={17}
                color={activeTab === "verified" ? "#1B110C" : "#8F7D71"}
              />

              <Text
                style={[
                  styles.tabText,
                  activeTab === "verified" && styles.activeTabText,
                ]}
              >
                {t.verifiedTab}
              </Text>
            </TouchableOpacity>
          </View>

          {/* APPLICATIONS */}
          {activeTab === "applications" ? (
            <>
              <SectionTitle
                title={t.pipeline}
                subtitle={t.pipelineSub}
                isArabic={isArabic}
              />

              <View style={styles.list}>
                {filteredApplications.map((application) => (
                  <View key={application.id} style={styles.applicationCard}>
                    <View
                      style={[styles.personTop, isArabic && styles.rowReverse]}
                    >
                      <View
                        style={[
                          styles.personIdentity,
                          isArabic && styles.rowReverse,
                        ]}
                      >
                        <View style={styles.avatar}>
                          <Text style={styles.avatarText}>
                            {application.initials}
                          </Text>
                        </View>

                        <View
                          style={[
                            styles.personInfo,
                            isArabic && styles.alignEnd,
                          ]}
                        >
                          <Text
                            style={[
                              styles.personName,
                              isArabic && styles.textRight,
                            ]}
                          >
                            {application.name}
                          </Text>

                          <Text style={styles.personId}>{application.id}</Text>
                        </View>
                      </View>

                      <View style={styles.stageBadge}>
                        <View style={styles.stageDot} />

                        <Text style={styles.stageText}>
                          {isArabic ? application.stageAr : application.stageEn}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.cardDivider} />

                    <Text
                      style={[
                        styles.specialization,
                        isArabic && styles.textRight,
                      ]}
                    >
                      {isArabic
                        ? application.specializationsAr
                        : application.specializationsEn}
                    </Text>

                    <View
                      style={[styles.detailRow, isArabic && styles.rowReverse]}
                    >
                      <View
                        style={[
                          styles.detailItem,
                          isArabic && styles.rowReverse,
                        ]}
                      >
                        <Ionicons
                          name="briefcase-outline"
                          size={14}
                          color="#8F7C70"
                        />

                        <Text style={styles.detailText}>
                          {application.experience} {t.experience}
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.detailItem,
                          isArabic && styles.rowReverse,
                        ]}
                      >
                        <Ionicons
                          name="time-outline"
                          size={14}
                          color="#8F7C70"
                        />

                        <Text style={styles.detailText}>
                          {isArabic
                            ? application.submittedAr
                            : application.submittedEn}
                        </Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      activeOpacity={0.82}
                      style={[
                        styles.reviewButton,
                        isArabic && styles.rowReverse,
                      ]}
                      onPress={() =>
                        router.push({
                          pathname: "/admin/mechanics/[id]",
                          params: { id: application.id },
                        })
                      }
                    >
                      <Text style={styles.reviewText}>{t.reviewButton}</Text>

                      <Ionicons
                        name={isArabic ? "arrow-back" : "arrow-forward"}
                        size={15}
                        color="#1A100B"
                      />
                    </TouchableOpacity>
                  </View>
                ))}

                {filteredApplications.length === 0 && (
                  <EmptyState text={t.noResults} />
                )}
              </View>
            </>
          ) : (
            <>
              {/* VERIFIED MECHANICS */}
              <SectionTitle
                title={t.verifiedNetwork}
                subtitle={t.verifiedSub}
                isArabic={isArabic}
              />

              <View style={styles.list}>
                {filteredVerified.map((mechanic) => (
                  <View key={mechanic.id} style={styles.applicationCard}>
                    <View
                      style={[styles.personTop, isArabic && styles.rowReverse]}
                    >
                      <View
                        style={[
                          styles.personIdentity,
                          isArabic && styles.rowReverse,
                        ]}
                      >
                        <View style={[styles.avatar, styles.verifiedAvatar]}>
                          <Text style={styles.avatarText}>
                            {mechanic.initials}
                          </Text>

                          <View style={styles.verifiedMark}>
                            <Ionicons
                              name="checkmark"
                              size={9}
                              color="#1B110C"
                            />
                          </View>
                        </View>

                        <View
                          style={[
                            styles.personInfo,
                            isArabic && styles.alignEnd,
                          ]}
                        >
                          <Text
                            style={[
                              styles.personName,
                              isArabic && styles.textRight,
                            ]}
                          >
                            {mechanic.name}
                          </Text>

                          <Text style={styles.personId}>{mechanic.id}</Text>
                        </View>
                      </View>

                      <View
                        style={[
                          styles.availabilityBadge,
                          mechanic.availability === "busy" && styles.busyBadge,
                        ]}
                      >
                        <View
                          style={[
                            styles.availabilityDot,
                            mechanic.availability === "busy" && styles.busyDot,
                          ]}
                        />

                        <Text style={styles.availabilityText}>
                          {mechanic.availability === "available"
                            ? t.available
                            : t.busy}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.cardDivider} />

                    <Text
                      style={[
                        styles.specialization,
                        isArabic && styles.textRight,
                      ]}
                    >
                      {isArabic
                        ? mechanic.specializationsAr
                        : mechanic.specializationsEn}
                    </Text>

                    <View style={styles.verifiedStats}>
                      <View style={styles.verifiedStat}>
                        <Ionicons name="star" size={14} color="#D99B69" />

                        <Text style={styles.verifiedValue}>
                          {mechanic.rating}
                        </Text>

                        <Text style={styles.verifiedLabel}>{t.rating}</Text>
                      </View>

                      <View style={styles.statDivider} />

                      <View style={styles.verifiedStat}>
                        <Ionicons
                          name="checkmark-done-outline"
                          size={15}
                          color="#A3B99B"
                        />

                        <Text style={styles.verifiedValue}>
                          {mechanic.jobs}
                        </Text>

                        <Text style={styles.verifiedLabel}>{t.jobs}</Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      activeOpacity={0.8}
                      style={styles.profileButton}
                    >
                      <Text style={styles.profileText}>{t.profile}</Text>

                      <Ionicons
                        name={isArabic ? "chevron-back" : "chevron-forward"}
                        size={15}
                        color="#D99B69"
                      />
                    </TouchableOpacity>
                  </View>
                ))}

                {filteredVerified.length === 0 && (
                  <EmptyState text={t.noResults} />
                )}
              </View>
            </>
          )}

          {/* FOOTER */}
          <View style={styles.footer}>
            <View style={styles.footerLine} />

            <Ionicons
              name="shield-checkmark-outline"
              size={14}
              color="#825638"
            />

            <Text style={styles.footerText}>{t.footer}</Text>

            <View style={styles.footerLine} />
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

function MiniMetric({
  value,
  label,
  icon,
}: {
  value: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.metric}>
      <Ionicons name={icon} size={16} color="#B67A51" />

      <Text style={styles.metricValue}>{value}</Text>

      <Text style={styles.metricLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function SectionTitle({
  title,
  subtitle,
  isArabic,
}: {
  title: string;
  subtitle: string;
  isArabic: boolean;
}) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, isArabic && styles.textRight]}>
        {title}
      </Text>

      <Text style={[styles.sectionSubtitle, isArabic && styles.textRight]}>
        {subtitle}
      </Text>
    </View>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <View style={styles.empty}>
      <Ionicons name="search-outline" size={28} color="#79685E" />

      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#120D0A",
  },

  content: {
    paddingHorizontal: 18,
  },

  glow: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    top: -130,
    right: -90,
    backgroundColor: "rgba(193,112,64,0.07)",
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
    alignItems: "flex-start",
    marginBottom: 22,
  },

  backButton: {
    width: 43,
    height: 43,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(217,155,105,0.17)",
    backgroundColor: "rgba(217,155,105,0.07)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 3,
  },

  headerText: {
    flex: 1,
    marginHorizontal: 11,
  },

  eyebrow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },

  eyebrowLine: {
    width: 15,
    height: 2,
    backgroundColor: "#B87345",
  },

  eyebrowText: {
    color: "#B87345",
    fontSize: 7,
    fontWeight: "900",
    letterSpacing: 1.1,
  },

  title: {
    color: "#FFF5EA",
    fontSize: 25,
    lineHeight: 31,
    fontWeight: "900",
    letterSpacing: -0.7,
  },

  subtitle: {
    color: "#9A877A",
    fontSize: 10,
    lineHeight: 15,
    marginTop: 3,
  },

  /* LANGUAGE */

  languageButton: {
    minWidth: 52,
    height: 40,
    paddingHorizontal: 9,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "rgba(217,155,105,0.18)",
    backgroundColor: "rgba(217,155,105,0.07)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    marginTop: 4,
  },

  languageText: {
    color: "#E1A16F",
    fontSize: 10,
    fontWeight: "900",
  },

  /* NETWORK */

  networkPanel: {
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(217,155,105,0.15)",
    marginBottom: 15,
  },

  networkGradient: {
    padding: 17,
  },

  networkHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  networkSmall: {
    color: "#A76D47",
    fontSize: 8,
    letterSpacing: 1.1,
    fontWeight: "900",
  },

  networkBig: {
    color: "#FFF5EA",
    fontSize: 35,
    lineHeight: 40,
    fontWeight: "900",
    marginTop: 5,
  },

  networkCaption: {
    color: "#9D897B",
    fontSize: 10,
    fontWeight: "600",
  },

  shield: {
    width: 52,
    height: 52,
    borderRadius: 17,
    backgroundColor: "rgba(217,155,105,0.08)",
    borderWidth: 1,
    borderColor: "rgba(217,155,105,0.13)",
    alignItems: "center",
    justifyContent: "center",
  },

  networkDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.045)",
    marginVertical: 15,
  },

  networkStats: {
    flexDirection: "row",
  },

  metric: {
    flex: 1,
    alignItems: "center",
  },

  metricValue: {
    color: "#F2E4DA",
    fontSize: 17,
    fontWeight: "900",
    marginTop: 5,
  },

  metricLabel: {
    color: "#837267",
    fontSize: 8,
    marginTop: 2,
  },

  /* SEARCH */

  search: {
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(217,155,105,0.13)",
    backgroundColor: "rgba(255,245,234,0.04)",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    marginBottom: 13,
  },

  searchInput: {
    flex: 1,
    height: "100%",
    color: "#FFF5EA",
    fontSize: 12,
    marginLeft: 9,
  },

  searchInputArabic: {
    textAlign: "right",
    marginLeft: 0,
    marginRight: 9,
  },

  /* TABS */

  tabs: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: "#1C130E",
    borderWidth: 1,
    borderColor: "rgba(217,155,105,0.1)",
    padding: 4,
    flexDirection: "row",
    gap: 4,
    marginBottom: 27,
  },

  tab: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 7,
  },

  activeTab: {
    backgroundColor: "#D99B69",
  },

  tabText: {
    color: "#8F7D71",
    fontSize: 10,
    fontWeight: "800",
  },

  activeTabText: {
    color: "#1B110C",
  },

  countBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 7,
    backgroundColor: "rgba(217,155,105,0.1)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },

  activeCountBadge: {
    backgroundColor: "rgba(27,17,12,0.13)",
  },

  countText: {
    color: "#B97B51",
    fontSize: 8,
    fontWeight: "900",
  },

  activeCountText: {
    color: "#1B110C",
  },

  /* SECTION */

  section: {
    marginBottom: 13,
  },

  sectionTitle: {
    color: "#EADBD0",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.2,
  },

  sectionSubtitle: {
    color: "#76665D",
    fontSize: 9,
    marginTop: 4,
  },

  list: {
    gap: 11,
  },

  /* APPLICATION CARD */

  applicationCard: {
    padding: 15,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "rgba(217,155,105,0.11)",
    backgroundColor: "rgba(35,22,16,0.9)",
  },

  personTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  personIdentity: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },

  avatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#352116",
    borderWidth: 1,
    borderColor: "rgba(217,155,105,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },

  verifiedAvatar: {
    position: "relative",
  },

  avatarText: {
    color: "#D99B69",
    fontSize: 12,
    fontWeight: "900",
  },

  verifiedMark: {
    position: "absolute",
    right: -3,
    bottom: -3,
    width: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: "#A8BC9E",
    borderWidth: 2,
    borderColor: "#231610",
    alignItems: "center",
    justifyContent: "center",
  },

  personInfo: {
    flex: 1,
    marginHorizontal: 10,
  },

  personName: {
    color: "#F6EADF",
    fontSize: 14,
    fontWeight: "900",
  },

  personId: {
    color: "#76655A",
    fontSize: 9,
    marginTop: 4,
  },

  stageBadge: {
    maxWidth: 125,
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: 9,
    backgroundColor: "rgba(217,155,105,0.08)",
    borderWidth: 1,
    borderColor: "rgba(217,155,105,0.13)",
    flexDirection: "row",
    alignItems: "center",
  },

  stageDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#D99B69",
    marginRight: 5,
  },

  stageText: {
    flexShrink: 1,
    color: "#D99B69",
    fontSize: 7.5,
    lineHeight: 10,
    fontWeight: "900",
  },

  cardDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.04)",
    marginVertical: 13,
  },

  specialization: {
    color: "#C4AEA0",
    fontSize: 11,
    fontWeight: "700",
  },

  detailRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 13,
    marginTop: 10,
  },

  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },

  detailText: {
    color: "#817066",
    fontSize: 9,
  },

  reviewButton: {
    height: 39,
    borderRadius: 12,
    backgroundColor: "#D99B69",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    marginTop: 14,
  },

  reviewText: {
    color: "#1A100B",
    fontSize: 10,
    fontWeight: "900",
  },

  /* VERIFIED */

  availabilityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 9,
    backgroundColor: "rgba(140,170,132,0.08)",
    borderWidth: 1,
    borderColor: "rgba(140,170,132,0.15)",
    flexDirection: "row",
    alignItems: "center",
  },

  busyBadge: {
    backgroundColor: "rgba(217,155,105,0.07)",
    borderColor: "rgba(217,155,105,0.13)",
  },

  availabilityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#92AD89",
    marginRight: 5,
  },

  busyDot: {
    backgroundColor: "#D99B69",
  },

  availabilityText: {
    color: "#B6C8AF",
    fontSize: 8,
    fontWeight: "800",
  },

  verifiedStats: {
    height: 50,
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.025)",
  },

  verifiedStat: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },

  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: "rgba(255,255,255,0.06)",
  },

  verifiedValue: {
    color: "#E9DBD0",
    fontSize: 11,
    fontWeight: "900",
  },

  verifiedLabel: {
    color: "#79685E",
    fontSize: 8,
  },

  profileButton: {
    height: 38,
    marginTop: 12,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "rgba(217,155,105,0.15)",
    backgroundColor: "rgba(217,155,105,0.05)",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },

  profileText: {
    color: "#D99B69",
    fontSize: 10,
    fontWeight: "900",
  },

  /* EMPTY */

  empty: {
    minHeight: 150,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(217,155,105,0.1)",
    backgroundColor: "rgba(35,22,16,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },

  emptyText: {
    color: "#827066",
    fontSize: 11,
    marginTop: 8,
  },

  /* FOOTER */

  footer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 30,
    marginBottom: 5,
    gap: 7,
  },

  footerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(184,115,69,0.11)",
  },

  footerText: {
    color: "#6F5140",
    fontSize: 7,
    letterSpacing: 0.8,
    fontWeight: "800",
    textAlign: "center",
  },
});
