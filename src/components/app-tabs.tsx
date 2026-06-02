import React from "react";
import { useColorScheme } from "@/hooks/useColorScheme";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { Colors } from "@/constants/Colors";
import { useTranslation } from "react-i18next";

export default function AppTabs() {
  const colorScheme = useColorScheme();
  const { t } = useTranslation();

  return (
    <NativeTabs
      backgroundColor={Colors[colorScheme].contrast}
      indicatorColor={Colors[colorScheme].background}
      labelStyle={{
        selected: { color: Colors[colorScheme].tint, fontSize: 50 },
        default: { color: Colors[colorScheme].text, fontSize: 50},
      }}
    >
      <NativeTabs.Trigger name="home" disableTransparentOnScrollEdge>
        <NativeTabs.Trigger.Label>{t("home")}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf="house.fill"
          md="home"
          renderingMode="template"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="favorites" disableTransparentOnScrollEdge>
        <NativeTabs.Trigger.Label>{t("favorites")}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf="heart"
          md="favorite"
          renderingMode="template"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings" disableTransparentOnScrollEdge>
        <NativeTabs.Trigger.Label>{t("settings")}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf="gear.circle"
          md="settings"
          renderingMode="template"
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
