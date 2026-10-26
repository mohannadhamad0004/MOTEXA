import BrandWordmark from '../../../components/BrandWordmark';
import type {ReactNode} from "react";
import { Animated, Pressable, type PressableProps } from "react-native";

import { Text, useReducedMotion } from "../../../components/MotexaVisual";
import { useAppearance } from "../../../components/Appearance";
import { useLanguage } from "../../../i18n/LanguageContext";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Tabs, router } from "expo-router";
import * as SecureStore from '../../../components/SessionStore';
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
type AuthStatus = "checking" | "authorized" | "unauthorized";

export default function AdminLayout() {
  const { dark } = useAppearance();
  const { isArabic } = useLanguage();
  const insets = useSafeAreaInsets();
  const [authStatus, setAuthStatus] =
    useState<AuthStatus>("checking");

  useEffect(() => {
    let mounted = true;

    const verifyAdmin = async () => {
      try {
        const token = await SecureStore.getItemAsync(
          "motexa_access_token"
        );

        const apiUrl = process.env.EXPO_PUBLIC_API_URL;

        if (!token || !apiUrl) {
          if (mounted) setAuthStatus("unauthorized");
          return;
        }

        const response = await fetch(
`${apiUrl.replace(/\/$/, "")}/api/auth/me`,          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            await SecureStore.deleteItemAsync(
              "motexa_access_token"
            );
          }

          if (mounted) setAuthStatus("unauthorized");
          return;
        }

        const data = await response.json();

        const authorized =
          data.success === true &&
          data.user?.status === "ACTIVE" &&
          (data.user?.role === "SUPER_ADMIN" ||
            data.user?.role === "ADMIN");

        if (mounted) {
          setAuthStatus(
            authorized ? "authorized" : "unauthorized"
          );
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
          backgroundColor: "#120D0A",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator
          size="large"
          color="#C98B5B"
        />
      </View>
    );
  }

return (
  <Tabs
    tabBar={({state,descriptors,navigation})=>(
      <View style={{paddingHorizontal:14,paddingTop:4,paddingBottom:Math.max(insets.bottom,6),backgroundColor:dark?'#241D18':'#F3DFC4'}}>
        <View style={{flexDirection:isArabic?'row-reverse':'row',alignItems:'center',padding:5,gap:3,borderRadius:38,backgroundColor:dark?'#35291F':'#FFFAF1',shadowColor:'#543620',shadowOffset:{width:0,height:4},shadowOpacity:0.1,shadowRadius:14,elevation:5}}>
          {state.routes.map((route,index)=>{
            const selected=state.index===index;const options=descriptors[route.key].options;
            const label=typeof options.title==='string'?options.title:route.name;
            const color=selected?(dark?'#352216':'#462E1C'):(dark?'#DBC4A4':'#775D48');
            return <OvalTab key={route.key} selected={selected} dark={dark} ar={isArabic} label={label} icon={options.tabBarIcon?.({focused:selected,color,size:22})} onPress={()=>{const event=navigation.emit({type:'tabPress',target:route.key,canPreventDefault:true});if(!selected&&!event.defaultPrevented)navigation.navigate(route.name,route.params);}} onLongPress={()=>navigation.emit({type:'tabLongPress',target:route.key})}/>;
          })}
        </View>
      </View>
    )}
    screenOptions={{
      headerShown: false,
      tabBarActiveBackgroundColor: "transparent",
      tabBarButton: props => <CapsuleTabButton {...props}/>,
      tabBarLabel: ({children,color}) => <Text style={{fontSize:12,fontWeight:"700",color,lineHeight:19,marginTop:2}}>{children}</Text>,
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
        marginBottom: Math.max(insets.bottom,12),
        height: 74,
        paddingTop: 8,
        paddingBottom: 8,
        paddingHorizontal: 7,
        elevation: 5,
        shadowColor: "#4F2D17",
        shadowOffset: {width:0,height:5},
        shadowOpacity: .12,
        shadowRadius: 14,
      },
    }}
  >
    <Tabs.Screen
      name="index"
      options={{
        title: isArabic ? "الرئيسية" : "Home",
        tabBarIcon: ({ color, focused }) => (
          <Ionicons name={focused ? "home" : "home-outline"} size={22} color={color} />
        ),
      }}
    />

    <Tabs.Screen
      name="providers"
      options={{
        title: isArabic ? "المزودون" : "Providers",
        tabBarIcon: ({ color, focused }) => (
          <Ionicons name={focused ? "people" : "people-outline"} size={22} color={color} />
        ),
      }}
    />

    <Tabs.Screen
      name="requests"
      options={{
        title: isArabic ? "الطلبات" : "Requests",
        tabBarIcon: ({ color, focused }) => (
          <Ionicons name={focused ? "clipboard" : "clipboard-outline"} size={22} color={color} />
        ),
      }}
    />

    <Tabs.Screen
      name="more"
      options={{
        title: isArabic ? "المزيد" : "More",
        tabBarIcon: ({ color, focused }) => (
          <Ionicons name={focused ? "menu" : "menu-outline"} size={22} color={color} />
        ),
      }}
    />
  </Tabs>
);
}
function CapsuleTabButton({style,children,...props}: PressableProps) {
 const {dark}=useAppearance();const [focused,setFocused]=useState(false);const selected=props["aria-selected"]===true || props.accessibilityState?.selected===true;
 return <Pressable {...props} onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)} style={state=>[typeof style === "function" ? style(state) : style,{borderRadius:27,backgroundColor:selected?(dark?'#E5BE8A':'#422414'):'transparent',minHeight:56,paddingVertical:4,overflow:'hidden'},focused&&{outlineStyle:'solid',outlineWidth:2,outlineColor:'#AF7A43',outlineOffset:2}]}>{children}</Pressable>;
}

function OvalTab({selected,dark,ar,label,icon,onPress,onLongPress}:{selected:boolean;dark:boolean;ar:boolean;label:string;icon:ReactNode;onPress:()=>void;onLongPress:()=>void}){
 const [focused,setFocused]=useState(false);const reduced=useReducedMotion();const width=useRef(new Animated.Value(1)).current;
 useEffect(()=>{if(reduced){width.setValue(selected?2.5:1);return;}const animation=Animated.timing(width,{toValue:selected?2.5:1,duration:220,useNativeDriver:false});animation.start();return()=>animation.stop();},[selected,reduced,width]);
 return <Animated.View style={{flex:width,minWidth:44}}><Pressable accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{selected}} onPress={onPress} onLongPress={onLongPress} onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)} style={({pressed,hovered})=>({height:50,borderRadius:26,flexDirection:'column',gap:2,alignItems:'center',justifyContent:'center',paddingHorizontal:selected?9:0,backgroundColor:selected?(dark?'#E5BE8A':'#E5BF92'):'transparent',opacity:pressed?0.78:hovered?0.9:1,outlineStyle:focused?'solid':undefined,outlineWidth:focused?2:0,outlineColor:'#AD7847',outlineOffset:2})}>{icon}{<Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={{fontSize:11,fontWeight:'400',color:dark?'#352216':'#462E1C',flexShrink:1}}>{label}</Text>}</Pressable></Animated.View>;
}


