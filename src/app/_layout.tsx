import "react-native-reanimated";
import "../../utils/i18n";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Appearance, Platform, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { MenuProvider } from "react-native-popup-menu";
import Toast from "react-native-toast-message";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useTranslation } from "react-i18next";

import AppReviewPrompt from "@/components/AppReviewPrompt";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import ForceUpdateGate from "@/components/ForceUpdateGate";
import IntroVideo, { useIntroVideo } from "@/components/Intro";
import LanguageSelection from "@/components/LanguageSelectionScreen";
import { SupabaseRealtimeProvider } from "@/components/SupabaseRealtimeProvider";
import { Colors } from "@/constants/Colors";
import { useVideoFinishedStore } from "@/hooks/useVideoFinishedStore";
import { useVideoWatchedStore } from "@/hooks/useVideoWatchedStore";
import { LanguageProvider, useLanguage } from "../../contexts/LanguageContext";
import useNotificationStore from "../../stores/notificationStore";
import { useColorScheme } from "../hooks/useColorScheme";
import {
  type ConnectionStatus,
  useConnectionStatus,
} from "../hooks/useConnectionStatus";
import { usePushNotifications } from "../hooks/usePushNotifications";
import { useFontSizeStore } from "../../stores/fontSizeStore";
import { useVideoFavoriteFoldersStore } from "../../stores/videoFavoriteFoldersStore";

if (Platform.OS !== "web") {
  void SplashScreen.preventAutoHideAsync().catch(() => {});
}

const queryClient = new QueryClient();

const favoriteFolderSheetOptions = {
  headerShown: false,
  presentation: "formSheet" as const,
  sheetAllowedDetents: [0.75, 1],
  sheetInitialDetentIndex: 0,
  sheetGrabberVisible: true,
  sheetCornerRadius: 24,
  gestureEnabled: true,
  contentStyle: { backgroundColor: "transparent" },
  webModalStyle: {
    width: 560,
    minHeight: "55%",
    height: "80%",
  },
};

const filterSheetOptions = {
  headerShown: false,
  presentation: "formSheet" as const,
  sheetAllowedDetents: [0.75, 1],
  sheetGrabberVisible: true,
  sheetCornerRadius: 24,
  gestureEnabled: true,
  contentStyle: { backgroundColor: "transparent" },
  webModalStyle: {
    width: 640,
    minHeight: "75%",
    height: "90%",
  },
};

function useAllStoresHydrated() {
  const [hydrated, setHydrated] = useState(() => {
    return (
      useFontSizeStore.persist.hasHydrated() &&
      useNotificationStore.persist.hasHydrated() &&
      useVideoFinishedStore.persist.hasHydrated() &&
      useVideoWatchedStore.persist.hasHydrated() &&
      useVideoFavoriteFoldersStore.persist.hasHydrated()
    );
  });

  useEffect(() => {
    if (hydrated) return;

    const stores = [
      useFontSizeStore,
      useNotificationStore,
      useVideoFinishedStore,
      useVideoWatchedStore,
      useVideoFavoriteFoldersStore,
    ];

    const checkHydration = () => {
      const allHydrated = stores.every((s) => s.persist.hasHydrated());
      if (allHydrated) setHydrated(true);
    };

    const unsubscribes = stores.map((store) =>
      store.persist.onFinishHydration(() => checkHydration()),
    );

    checkHydration();

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [hydrated]);

  return hydrated;
}

function AppContent() {
  const colorScheme = useColorScheme() || "light";
  const { ready: languageContextReady, hasStoredLanguage } = useLanguage();

  const { hasPlayed: hasPlayedIntro, markAsPlayed: markIntroAsPlayed } =
    useIntroVideo();

  const storesHydrated = useAllStoresHydrated();

  const connectionStatus = useConnectionStatus();

  // Push-Notification-Registration: kein Auto-Permission-Request,
  // nur reagieren wenn User in Settings den Toggle aktiviert + OS-Permission granted.
  usePushNotifications();

  const hasHiddenSplashRef = useRef(false);
  const previousConnectionStatusRef = useRef<ConnectionStatus>("unknown");

  const { t } = useTranslation();

  useEffect(() => {
    if (Platform.OS === "web") return;

    const setColorTheme = async () => {
      try {
        const saved = await AsyncStorage.getItem("isDarkMode");

        if (saved === "true") {
          Appearance.setColorScheme("dark");
        } else if (saved === "false") {
          Appearance.setColorScheme("light");
        }
      } catch (error) {
        console.error("Failed to set color scheme:", error);
      }
    };

    setColorTheme();
  }, []);

  // Permission-Status nach Hydration einmal abfragen (kein automatischer Request).
  useEffect(() => {
    if (storesHydrated) {
      useNotificationStore.getState().checkPermissions();
    }
  }, [storesHydrated]);

  const essentialsReady = languageContextReady && storesHydrated;

  useEffect(() => {
    if (!essentialsReady) return;
    if (connectionStatus === "unknown") return;

    const previousConnectionStatus = previousConnectionStatusRef.current;
    previousConnectionStatusRef.current = connectionStatus;

    if (
      previousConnectionStatus !== "online" ||
      connectionStatus !== "offline"
    ) {
      return;
    }

    Toast.show({
      type: "error",
      text1: t("noInternetConnectionTitle"),
      text2: t("noInternetConnectionMessage"),
      visibilityTime: 5000,
    });
  }, [connectionStatus, essentialsReady, t]);

  const hideSplashIfReady = useCallback(() => {
    if (hasHiddenSplashRef.current) return;
    if (!essentialsReady) return;
    if (hasPlayedIntro === null) return;

    hasHiddenSplashRef.current = true;
    void SplashScreen.hideAsync().catch(() => {});
  }, [essentialsReady, hasPlayedIntro]);

  useEffect(() => {
    hideSplashIfReady();
  }, [hideSplashIfReady]);

  const gateMode: "language" | "intro" | null =
    !essentialsReady || hasPlayedIntro === null
      ? null
      : !hasStoredLanguage
        ? "language"
        : hasPlayedIntro === false && Platform.OS !== "web"
          ? "intro"
          : null;

  const showAppGate = gateMode !== null;

  return (
    <View
      style={[styles.root, { backgroundColor: Colors[colorScheme].background }]}
      onLayout={hideSplashIfReady}
    >
      <GestureHandlerRootView
        style={[
          styles.root,
          { backgroundColor: Colors[colorScheme].background },
        ]}
      >
        <ThemeProvider
          value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
        >
          <StatusBar style={"auto"} />
          <ErrorBoundary>
            <MenuProvider>
              <QueryClientProvider client={queryClient}>
                <SupabaseRealtimeProvider>
                  <Stack
                    screenOptions={{
                      headerShown: false,
                      headerBackButtonMenuEnabled: false,
                    }}
                  >
                    <Stack.Screen name="index" />
                    <Stack.Screen name="(tabs)" />
                    <Stack.Screen name="video/[id]" />
                    <Stack.Screen
                      name="favorite-folders"
                      options={favoriteFolderSheetOptions}
                    />
                    <Stack.Screen
                      name="video-filters"
                      options={filterSheetOptions}
                    />
                    <Stack.Screen
                      name="+not-found"
                      options={{ headerShown: true }}
                    />
                  </Stack>

                  <AppReviewPrompt />

                  {showAppGate && (
                    <View style={styles.gateOverlay} pointerEvents="auto">
                      {gateMode === "language" && <LanguageSelection />}

                      {gateMode === "intro" && (
                        <IntroVideo
                          source={require("@/assets/videos/intro.mp4")}
                          onComplete={markIntroAsPlayed}
                        />
                      )}
                    </View>
                  )}

                  <ForceUpdateGate />
                </SupabaseRealtimeProvider>
              </QueryClientProvider>
            </MenuProvider>
          </ErrorBoundary>

          <Toast />
        </ThemeProvider>
      </GestureHandlerRootView>
    </View>
  );
}

export default function RootLayout() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  gateOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9998,
    elevation: 9998,
    backgroundColor: "#fff",
  },
});
