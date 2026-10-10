import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Stack, router } from "expo-router";
import * as SecureStore from "expo-secure-store";

type AuthStatus = "checking" | "authorized" | "unauthorized";

export default function AdminLayout() {
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
          `${apiUrl.replace(/\/$/, "")}/auth/me`,
          {
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
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    />
  );
}