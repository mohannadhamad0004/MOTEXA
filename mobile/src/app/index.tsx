import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
} from "react-native";

export default function Index() {
  const logoScale = useRef(new Animated.Value(0.5)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;

  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslate = useRef(new Animated.Value(20)).current;

  const taglineOpacity = useRef(new Animated.Value(0)).current;

  const lineWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Logo animation
    Animated.parallel([
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 5,
        tension: 55,
        useNativeDriver: true,
      }),

      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
    ]).start();

    // MOTEXA title animation
    Animated.sequence([
      Animated.delay(450),

      Animated.parallel([
        Animated.timing(titleOpacity, {
          toValue: 1,
          duration: 650,
          useNativeDriver: true,
        }),

        Animated.timing(titleTranslate, {
          toValue: 0,
          duration: 650,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // Tagline animation
    Animated.sequence([
      Animated.delay(900),

      Animated.timing(taglineOpacity, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
    ]).start();

    // Loading line animation
    Animated.sequence([
      Animated.delay(1200),

      Animated.timing(lineWidth, {
        toValue: 1,
        duration: 1100,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: false,
      }),
    ]).start();

    // Go to Login
    const timer = setTimeout(() => {
      router.replace("/auth/login");
    }, 4000);

    return () => clearTimeout(timer);
  }, []);

  const animatedLineWidth = lineWidth.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <LinearGradient
      colors={[
        "#0D0907",
        "#17100C",
        "#24160F",
        "#120C09",
      ]}
      locations={[0, 0.35, 0.72, 1]}
      style={styles.container}
    >
      {/* Background glow */}
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />

      {/* Decorative circles */}
      <View style={styles.circleOne} />
      <View style={styles.circleTwo} />

      <View style={styles.content}>
        {/* Logo */}
        <Animated.View
          style={[
            styles.logoShadow,
            {
              opacity: logoOpacity,
              transform: [{ scale: logoScale }],
            },
          ]}
        >
          <LinearGradient
            colors={["#F4C99E", "#D58B53", "#A85D34"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.logo}
          >
            <Ionicons
              name="car-sport-outline"
              size={49}
              color="#24130B"
            />
          </LinearGradient>
        </Animated.View>

        {/* Brand */}
        <Animated.View
          style={{
            opacity: titleOpacity,
            transform: [{ translateY: titleTranslate }],
          }}
        >
          <Text style={styles.brand}>MOTEXA</Text>
        </Animated.View>

        {/* Accent */}
        <Animated.View
          style={[
            styles.accentContainer,
            {
              opacity: taglineOpacity,
            },
          ]}
        >
          <View style={styles.smallLine} />

          <View style={styles.diamond} />

          <View style={styles.smallLine} />
        </Animated.View>

        {/* Tagline */}
        <Animated.Text
          style={[
            styles.tagline,
            {
              opacity: taglineOpacity,
            },
          ]}
        >
          YOUR SMART AUTOMOTIVE COMPANION
        </Animated.Text>
      </View>

      {/* Bottom */}
      <View style={styles.bottomSection}>
        <Text style={styles.startingText}>
          STARTING YOUR EXPERIENCE
        </Text>

        <View style={styles.loadingTrack}>
          <Animated.View
            style={[
              styles.loadingLine,
              {
                width: animatedLineWidth,
              },
            ]}
          >
            <LinearGradient
              colors={["#9D5834", "#F0B77E"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </View>

        <View style={styles.secureRow}>
          <Ionicons
            name="shield-checkmark-outline"
            size={13}
            color="#79675B"
          />

          <Text style={styles.secureText}>
            MOTEXA SECURE ADMIN SYSTEM
          </Text>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  content: {
    alignItems: "center",
    marginTop: -50,
  },

  glowTop: {
    position: "absolute",
    width: 340,
    height: 340,
    borderRadius: 170,
    backgroundColor: "rgba(190, 111, 61, 0.08)",
    top: -130,
    right: -130,
  },

  glowBottom: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "rgba(155, 82, 43, 0.07)",
    bottom: -140,
    left: -150,
  },

  circleOne: {
    position: "absolute",
    width: 190,
    height: 190,
    borderRadius: 95,
    borderWidth: 1,
    borderColor: "rgba(213, 139, 83, 0.06)",
    top: 100,
    left: -100,
  },

  circleTwo: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    borderWidth: 1,
    borderColor: "rgba(213, 139, 83, 0.05)",
    bottom: 80,
    right: -190,
  },

  logoShadow: {
    borderRadius: 31,

    shadowColor: "#E29A61",
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.35,
    shadowRadius: 25,

    elevation: 15,
  },

  logo: {
    width: 105,
    height: 105,
    borderRadius: 31,
    alignItems: "center",
    justifyContent: "center",
  },

  brand: {
    color: "#FFF7EF",
    fontSize: 45,
    fontWeight: "800",
    letterSpacing: 11,
    marginLeft: 11,
    marginTop: 30,
  },

  accentContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 15,
    marginBottom: 15,
  },

  smallLine: {
    width: 35,
    height: 1,
    backgroundColor: "rgba(215, 151, 101, 0.45)",
  },

  diamond: {
    width: 6,
    height: 6,
    backgroundColor: "#D7925F",
    transform: [{ rotate: "45deg" }],
    marginHorizontal: 11,
  },

  tagline: {
    color: "#A99384",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 2.4,
    textAlign: "center",
  },

  bottomSection: {
    position: "absolute",
    bottom: 48,
    width: "70%",
    alignItems: "center",
  },

  startingText: {
    color: "#8A7669",
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 1.8,
    marginBottom: 13,
  },

  loadingTrack: {
    width: "100%",
    height: 2,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.07)",
    overflow: "hidden",
  },

  loadingLine: {
    height: "100%",
    borderRadius: 2,
    overflow: "hidden",
  },

  secureRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
  },

  secureText: {
    color: "#6F6057",
    fontSize: 7,
    fontWeight: "600",
    letterSpacing: 1.3,
    marginLeft: 6,
  },
});