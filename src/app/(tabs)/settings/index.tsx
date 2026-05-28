import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { setWebColorScheme, useColorScheme } from "@/hooks/useColorScheme";
import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/Colors";
import { useLanguage } from "../../../../contexts/LanguageContext";
import { useConnectionStatus } from "../../../hooks/useConnectionStatus";
import useNotificationStore from "../../../../stores/notificationStore";
import handleOpenExternalUrl from "../../../../utils/handleOpenExternalUrl";
import Constants from "expo-constants";
import { Image } from "expo-image";
import { type Href, router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Appearance,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import ClearAppCacheButton from "@/components/ClearCacheButton";
import FeedbackButton from "@/components/FeedbackButton";
import { useScreenFadeIn } from "@/hooks/useScreenFadeIn";

const IS_WEB = Platform.OS === "web";
const WEB_TAB_BAR_TOP_OFFSET = 80;
const ADD_VIDEO_ROUTE = "/settings/add-video" as Href;

const Settings = () => {
  const colorScheme = useColorScheme();
  const webBorderColor =
    colorScheme === "dark" ? "rgba(255,255,255,0.09)" : "rgba(17,24,28,0.08)";
  const [isDarkMode, setIsDarkMode] = useState(colorScheme === "dark");
  const [payPalLink, setPayPalLink] = useState<string | null>("");

  const { getNotifications, toggleGetNotifications, permissionStatus } =
    useNotificationStore();
  const { rtl } = useLanguage();
  const connectionStatus = useConnectionStatus();
  const hasInternet = connectionStatus !== "offline";
  const effectiveEnabled = getNotifications && permissionStatus === "granted";

  const { t } = useTranslation();

  const { fadeAnim, onLayout } = useScreenFadeIn(800);
  const version = Constants.expoConfig?.version;
  const titleTapCountRef = useRef(0);
  const titleTapResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  useEffect(() => {
    setIsDarkMode(colorScheme === "dark");
  }, [colorScheme]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const paypal = await AsyncStorage.getItem("paypal");
        if (mounted) setPayPalLink(paypal);
      } catch (error: any) {
        if (mounted) Alert.alert(t("errorTitle"), error.message);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [t]);

  useEffect(() => {
    return () => {
      if (titleTapResetTimeoutRef.current) {
        clearTimeout(titleTapResetTimeoutRef.current);
      }
    };
  }, []);

  const handleSettingsTitlePress = () => {
    if (titleTapResetTimeoutRef.current) {
      clearTimeout(titleTapResetTimeoutRef.current);
    }

    titleTapCountRef.current += 1;

    if (titleTapCountRef.current >= 10) {
      titleTapCountRef.current = 0;
      titleTapResetTimeoutRef.current = null;
      router.push(ADD_VIDEO_ROUTE);
      return;
    }

    titleTapResetTimeoutRef.current = setTimeout(() => {
      titleTapCountRef.current = 0;
      titleTapResetTimeoutRef.current = null;
    }, 3000);
  };

  const toggleDarkMode = async () => {
    const newDarkMode = !isDarkMode;
    await AsyncStorage.setItem("isDarkMode", `${newDarkMode}`);
    setIsDarkMode(newDarkMode);

    if (IS_WEB) {
      setWebColorScheme(newDarkMode);
      return;
    }

    Appearance.setColorScheme(newDarkMode ? "dark" : "light");
  };

  return (
    <Animated.View
      onLayout={onLayout}
      style={[
        styles.container,
        { opacity: fadeAnim, backgroundColor: Colors[colorScheme].background },
      ]}
    >
      <SafeAreaView
        style={[
          styles.container,
          { backgroundColor: Colors[colorScheme].background },
          IS_WEB && styles.webSafeArea,
        ]}
        edges={["top"]}
      >
        <View
          style={[styles.header, rtl && styles.rtl, IS_WEB && styles.webHeader]}
        >
          <Pressable onPress={handleSettingsTitlePress} hitSlop={12}>
            <ThemedText
              style={[
                rtl && { textAlign: "right", paddingRight: 15 },
                IS_WEB && styles.webScreenTitle,
              ]}
              type="title"
            >
              {t("settings")}
            </ThemedText>
          </Pressable>
        </View>

        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
        >
          <View style={IS_WEB ? styles.webColumn : undefined}>
            <View
              style={[
                styles.section,
                IS_WEB && styles.webSection,
                IS_WEB && {
                  backgroundColor: Colors[colorScheme].contrast,
                  borderColor: webBorderColor,
                },
              ]}
            >
              <View
                style={[
                  styles.settingRow,
                  rtl && styles.rtl,
                  IS_WEB && styles.webSettingRow,
                  IS_WEB && { borderBottomColor: webBorderColor },
                ]}
              >
                <View>
                  <ThemedText
                    style={[styles.settingTitle, rtl && { textAlign: "right" }]}
                  >
                    {t("darkMode")}
                  </ThemedText>
                  <ThemedText
                    style={[
                      styles.settingSubtitle,
                      rtl && { textAlign: "right" },
                    ]}
                  >
                    {t("enableDarkMode")}
                  </ThemedText>
                </View>
                <Switch
                  value={isDarkMode}
                  onValueChange={toggleDarkMode}
                  trackColor={{
                    false: Colors.light.trackColor,
                    true: Colors.dark.trackColor,
                  }}
                  thumbColor={Colors[colorScheme].thumbColor}
                />
              </View>

              {!IS_WEB && (
                <View
                  style={[
                    styles.settingRow,
                    rtl && styles.rtl,
                    IS_WEB && styles.webSettingRow,
                    IS_WEB && { borderBottomColor: webBorderColor },
                  ]}
                >
                  <View>
                    <ThemedText
                      style={[
                        styles.settingTitle,
                        rtl && { textAlign: "right" },
                      ]}
                    >
                      {t("notifications")}
                    </ThemedText>
                    <ThemedText
                      style={[
                        styles.settingSubtitle,
                        rtl && { textAlign: "right" },
                      ]}
                    >
                      {t("receivePushNotifications")}
                    </ThemedText>
                  </View>
                  <Switch
                    value={effectiveEnabled}
                    onValueChange={() => {
                      if (!hasInternet) return;
                      toggleGetNotifications();
                    }}
                    trackColor={{
                      false: Colors.light.trackColor,
                      true: Colors.dark.trackColor,
                    }}
                    thumbColor={
                      isDarkMode
                        ? Colors.light.thumbColor
                        : Colors.dark.thumbColor
                    }
                  />
                </View>
              )}

              <LanguageSwitcher disabled={false} />

              <View style={{ gap: 10 }}>
                {!IS_WEB ? <ClearAppCacheButton /> : null}
                <FeedbackButton />
              </View>
            </View>

            <Pressable
              style={styles.paypalButton}
              onPress={() => payPalLink && handleOpenExternalUrl(payPalLink)}
            >
              <Image
                source={require("@/assets/images/paypal.png")}
                style={[styles.paypalImage, IS_WEB && styles.webPaypalImage]}
              />
            </Pressable>

            {!IS_WEB ? (
              <View style={styles.infoSection}>
                <ThemedText
                  style={[styles.versionText, rtl && { textAlign: "right" }]}
                >
                  {t("appVersion")} : {}
                  {version}
                </ThemedText>
              </View>
            ) : null}

            <View
              style={[
                styles.footer,
                rtl && { flexDirection: "row-reverse" },
                { borderTopColor: Colors[colorScheme].border },
                IS_WEB && styles.webFooter,
              ]}
            >
              <Pressable
                onPress={() =>
                  handleOpenExternalUrl(
                    "https://bufib.github.io/Islam-Fragen-App-rechtliches/datenschutz",
                  )
                }
              >
                <ThemedText
                  style={[styles.footerLink, rtl && { textAlign: "right" }]}
                >
                  {t("dataPrivacy")}
                </ThemedText>
              </Pressable>

              <Pressable onPress={() => router.push("/settings/impressum")}>
                <ThemedText
                  style={[styles.footerLink, rtl && { textAlign: "right" }]}
                >
                  {t("imprint")}
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webSafeArea: {
    paddingTop: WEB_TAB_BAR_TOP_OFFSET,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingLeft: 15,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  scrollView: {
    flex: 1,
  },
  webHeader: {
    borderBottomWidth: 0,
    alignSelf: "center",
    width: "100%",
    maxWidth: 640,
    paddingLeft: 32,
    paddingRight: 32,
    paddingTop: 22,
    paddingBottom: 2,
  },
  webScreenTitle: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  webColumn: {
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
    paddingHorizontal: 16,
  },
  webSection: {
    borderBottomWidth: 0,
    borderWidth: 1,
    borderRadius: 16,
    paddingTop: 6,
    paddingBottom: 14,
    paddingHorizontal: 18,
    marginTop: 14,
    shadowColor: "#0b1220",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 18,
  },
  webSettingRow: {
    marginBottom: 0,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  webPaypalImage: {
    height: 56,
  },
  webFooter: {
    borderTopWidth: 0,
    marginTop: 4,
    marginBottom: 28,
  },
  section: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    marginBottom: 8,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 4,
  },
  settingSubtitle: {
    fontSize: 14,
    opacity: 0.6,
  },
  paypalButton: {
    alignItems: "center",
    padding: 20,
  },
  paypalImage: {
    height: 80,
    aspectRatio: 2,
  },
  infoSection: {
    alignItems: "center",
    padding: 20,
  },
  versionText: {
    fontSize: 14,
    opacity: 0.5,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 20,
    borderTopWidth: 0.5,
    marginBottom: 40,
    paddingTop: 15,
  },
  footerLink: {
    color: Colors.universal.link,
    fontSize: 14,
  },
  rtl: {
    flexDirection: "row-reverse",
  },
});

export default Settings;
