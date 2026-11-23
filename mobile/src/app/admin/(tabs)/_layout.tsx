
import FloatingRoleTabs from "../../../components/FloatingRoleTabs";



import { Text } from "../../../components/MotexaVisual";
import { useAppearance } from "../../../components/Appearance";
import { useLanguage } from "../../../i18n/LanguageContext";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Tabs, router } from "expo-router";
import * as SecureStore from "../../../components/SessionStore";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
type AuthStatus = "checking" | "authorized" | "unauthorized";

export default function AdminLayout() {
  const { dark } = useAppearance();
  const { isArabic } = useLanguage();
  const insets = useSafeAreaInsets();
  const [authStatus, setAuthStatus] = useState<AuthStatus>("checking");

  useEffect(() => {
    let mounted = true;

    const verifyAdmin = async () => {
      try {
        const token = await SecureStore.getItemAsync("motexa_access_token");

        const apiUrl = process.env.EXPO_PUBLIC_API_URL;

        if (!token || !apiUrl) {
          if (mounted) setAuthStatus("unauthorized");
          return;
        }

        const response = await fetch(
          `${apiUrl.replace(/\/$/, "")}/api/auth/me`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            await SecureStore.deleteItemAsync("motexa_access_token");
          }

          if (mounted) setAuthStatus("unauthorized");
          return;
        }

        const data = await response.json();

        const authorized =
          data.success === true &&
          data.user?.status === "ACTIVE" &&
          (data.user?.role === "SUPER_ADMIN" || data.user?.role === "ADMIN");

        if (mounted) {
          setAuthStatus(authorized ? "authorized" : "unauthorized");
        }
      } catch {
        if (mounted) setAuthStatus("unauthorized");
      }
    };

    verifyAdmin();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (authStatus === "unauthorized") {
      router.replace("/auth/login");
    }
  }, [authStatus]);

  if (authStatus !== "authorized") {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: dark ? "#30231B" : "#FFF9EF",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator size="large" color="#C98B5B" />
      </View>
    );
  }

  return (
    <Tabs
      tabBar={({state,descriptors,navigation})=><View style={{paddingHorizontal:12,paddingTop:0,paddingBottom:Math.max(insets.bottom,8),backgroundColor:dark?'#30231B':'#F3DFC4'}}>
        <FloatingRoleTabs tabSemantics selected={state.routes[state.index].key} items={state.routes.map(route=>({key:route.key,label:descriptors[route.key].options.title??route.name,icon:({index:'home-outline',administration:'shield-checkmark-outline',providers:'people-outline',requests:'clipboard-outline',more:'grid-outline'} as const)[route.name as 'index'|'administration'|'providers'|'requests'|'more']??'grid-outline'}))}
          onSelect={key=>{const route=state.routes.find(route=>route.key===key);if(!route)return;const event=navigation.emit({type:'tabPress',target:key,canPreventDefault:true});if(state.routes[state.index].key!==key&&!event.defaultPrevented)navigation.navigate(route.name,route.params);}}
          onLongPress={key=>{navigation.emit({type:'tabLongPress',target:key});}}/>
      </View>}
      screenOptions={{
        headerShown: false,
        tabBarActiveBackgroundColor: "transparent",
        tabBarLabel: ({ children, color }) => (
          <Text
            style={{
              fontSize: 12,
              fontWeight: "700",
              color,
              lineHeight: 19,
              marginTop: 2,
            }}
          >
            {children}
          </Text>
        ),
        tabBarLabelPosition: "below-icon",
        tabBarItemStyle: { marginHorizontal: 2 },
        tabBarActiveTintColor: dark ? "#332218" : "#FFF9F0",
        tabBarInactiveTintColor: dark ? "#DECAAE" : "#725642",
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "700",
        },
        tabBarStyle: {
          backgroundColor: dark ? "#35291F" : "#FFF9EF",
          borderTopWidth: 0,
          borderRadius: 35,
          marginHorizontal: 16,
          marginBottom: Math.max(insets.bottom, 12),
          height: 74,
          paddingTop: 8,
          paddingBottom: 8,
          paddingHorizontal: 7,
          elevation: 5,
          shadowColor: "#4F2D17",
          shadowOffset: { width: 0, height: 5 },
          shadowOpacity: 0.12,
          shadowRadius: 14,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: isArabic ? "الرئيسية" : "Home",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "home" : "home-outline"}
              size={22}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen name="administration" options={{title:isArabic?'الأدمن':'Team',tabBarIcon:({color})=><Ionicons name="shield-checkmark-outline" size={22} color={color}/>}}/>
      <Tabs.Screen
        name="providers"
        options={{
          title: isArabic ? "المزودون" : "Providers",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "people" : "people-outline"}
              size={22}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="requests"
        options={{
          title: isArabic ? "الطلبات" : "Requests",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "clipboard" : "clipboard-outline"}
              size={22}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="more"
        options={{
          title: isArabic ? "المزيد" : "More",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "menu" : "menu-outline"}
              size={22}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
