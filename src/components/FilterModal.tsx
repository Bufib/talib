import { Colors } from "@/constants/Colors";
import { LoadingIndicator } from "@/components/LoadingIndicator";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useVideoFilters } from "@/hooks/useVideoFilters";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useLanguage } from "../../contexts/LanguageContext";
import { useVideoFilterStore } from "../../stores/videoFilterStore";
import { getLanguageLabel } from "../../utils/languageLabel";

const IS_WEB = Platform.OS === "web";
const COMPACT_WEB_BREAKPOINT = 480;

export default function FilterModal() {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const insets = useSafeAreaInsets();
  const { lang } = useLanguage();
  const isCompactWeb = IS_WEB && width <= COMPACT_WEB_BREAKPOINT;

  const storeDefaultLanguage = useVideoFilterStore((s) => s.defaultLanguage);
  const selectedTopic = useVideoFilterStore((s) => s.selectedTopic);
  const selectedAuthor = useVideoFilterStore((s) => s.selectedAuthor);
  const selectedLanguageValue = useVideoFilterStore((s) => s.selectedLanguage);
  const setDefaultLanguage = useVideoFilterStore((s) => s.setDefaultLanguage);
  const setSelectedTopic = useVideoFilterStore((s) => s.setSelectedTopic);
  const setSelectedAuthor = useVideoFilterStore((s) => s.setSelectedAuthor);
  const setSelectedLanguage = useVideoFilterStore((s) => s.setSelectedLanguage);
  const resetFilters = useVideoFilterStore((s) => s.resetFilters);

  const selectedLanguage =
    storeDefaultLanguage === null ? lang : selectedLanguageValue;

  const {
    availableTopics,
    availableAuthors,
    availableLanguages,
    isLoading,
  } = useVideoFilters({
    language: selectedLanguage,
    selectedTopic,
    selectedAuthor,
  });

  useEffect(() => {
    setDefaultLanguage(lang);
  }, [lang, setDefaultLanguage]);

  const closeSheet = useCallback(() => {
    router.dismiss();
  }, []);

  const hasActiveFilters =
    selectedTopic !== null ||
    selectedAuthor !== null ||
    selectedLanguage !== lang;

  const panelBg = isDark ? "#1e2a3a" : "#ffffff";
  const sectionLabelColor = isDark ? "#8899aa" : "#888";
  const chipBg = isDark ? "#2a3a4e" : "#f0f2f5";
  const chipBorder = isDark ? "#3a4e63" : "#e0e4ea";
  const activeBg = Colors.universal.primary;

  return (
    <View style={[styles.sheetRoot, { backgroundColor: panelBg }]}>
      <View
        style={[styles.panelHeader, isCompactWeb && styles.compactPanelHeader]}
      >
        <View style={styles.panelTitleRow}>
          <Ionicons
            name="options-outline"
            size={20}
            color={Colors.universal.primary}
            style={{ marginRight: 8 }}
          />
          <Text
            style={[styles.panelTitle, { color: isDark ? "#fff" : "#111" }]}
          >
            {t("filter")}
          </Text>
        </View>
        <View
          style={[
            styles.headerActions,
            isCompactWeb && styles.compactHeaderActions,
          ]}
        >
          {hasActiveFilters && (
            <TouchableOpacity
              accessibilityLabel={t("resetFilters")}
              style={[
                styles.headerActionBtn,
                styles.headerClearBtn,
                isCompactWeb && styles.compactHeaderActionBtn,
              ]}
              onPress={() => resetFilters(lang)}
            >
              <Ionicons
                name="refresh-outline"
                size={14}
                color={Colors.universal.primary}
              />
              <Text
                style={[
                  styles.headerClearBtnText,
                  isCompactWeb && styles.compactHeaderActionText,
                ]}
              >
                {t("resetFilters")}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            accessibilityLabel={t("applyFilters")}
            style={[
              styles.headerActionBtn,
              styles.headerApplyBtn,
              isCompactWeb && styles.compactHeaderActionBtn,
            ]}
            onPress={closeSheet}
          >
            <Ionicons name="checkmark" size={15} color="#fff" />
            <Text
              style={[
                styles.headerApplyBtnText,
                isCompactWeb && styles.compactHeaderActionText,
              ]}
            >
              {t("applyFilters")}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={closeSheet} style={styles.closeBtn}>
            <Ionicons
              name="close"
              size={22}
              color={isDark ? "#8899aa" : "#666"}
            />
          </TouchableOpacity>
        </View>
      </View>

      <View
        style={[
          styles.divider,
          { backgroundColor: isDark ? "#2d3d50" : "#f0f2f5" },
        ]}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 16 },
        ]}
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <LoadingIndicator size="small" />
          </View>
        ) : (
          <>
            {availableTopics.length > 0 && (
              <View style={styles.section}>
                <Text
                  style={[styles.sectionLabel, { color: sectionLabelColor }]}
                >
                  {t("topics").toUpperCase()}
                </Text>
                <View style={styles.chipsWrap}>
                  <TouchableOpacity
                    style={[
                      styles.chip,
                      { backgroundColor: chipBg, borderColor: chipBorder },
                      !selectedTopic && {
                        backgroundColor: activeBg,
                        borderColor: activeBg,
                      },
                    ]}
                    onPress={() => setSelectedTopic(null)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: isDark ? "#ccd6e0" : "#444" },
                        !selectedTopic && styles.chipTextActive,
                      ]}
                    >
                      {t("allTopics")}
                    </Text>
                  </TouchableOpacity>
                  {availableTopics.map((topic) => (
                    <TouchableOpacity
                      key={topic}
                      style={[
                        styles.chip,
                        { backgroundColor: chipBg, borderColor: chipBorder },
                        selectedTopic === topic && {
                          backgroundColor: activeBg,
                          borderColor: activeBg,
                        },
                      ]}
                      onPress={() =>
                        setSelectedTopic(selectedTopic === topic ? null : topic)
                      }
                    >
                      <Text
                        style={[
                          styles.chipText,
                          { color: isDark ? "#ccd6e0" : "#444" },
                          selectedTopic === topic && styles.chipTextActive,
                        ]}
                      >
                        {topic}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {availableAuthors.length > 0 && (
              <View style={styles.section}>
                <Text
                  style={[styles.sectionLabel, { color: sectionLabelColor }]}
                >
                  {t("authors").toUpperCase()}
                </Text>
                <View style={styles.chipsWrap}>
                  <TouchableOpacity
                    style={[
                      styles.chip,
                      { backgroundColor: chipBg, borderColor: chipBorder },
                      !selectedAuthor && {
                        backgroundColor: activeBg,
                        borderColor: activeBg,
                      },
                    ]}
                    onPress={() => setSelectedAuthor(null)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: isDark ? "#ccd6e0" : "#444" },
                        !selectedAuthor && styles.chipTextActive,
                      ]}
                    >
                      {t("allAuthors")}
                    </Text>
                  </TouchableOpacity>
                  {availableAuthors.map((author) => (
                    <TouchableOpacity
                      key={author}
                      style={[
                        styles.chip,
                        { backgroundColor: chipBg, borderColor: chipBorder },
                        selectedAuthor === author && {
                          backgroundColor: activeBg,
                          borderColor: activeBg,
                        },
                      ]}
                      onPress={() =>
                        setSelectedAuthor(
                          selectedAuthor === author ? null : author,
                        )
                      }
                    >
                      <Text
                        style={[
                          styles.chipText,
                          { color: isDark ? "#ccd6e0" : "#444" },
                          selectedAuthor === author && styles.chipTextActive,
                        ]}
                      >
                        {author}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: sectionLabelColor }]}>
                {t("language").toUpperCase()}
              </Text>
              <View style={styles.chipsWrap}>
                <TouchableOpacity
                  style={[
                    styles.chip,
                    { backgroundColor: chipBg, borderColor: chipBorder },
                    selectedLanguage === null && {
                      backgroundColor: activeBg,
                      borderColor: activeBg,
                    },
                  ]}
                  onPress={() => setSelectedLanguage(null)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: isDark ? "#ccd6e0" : "#444" },
                      selectedLanguage === null && styles.chipTextActive,
                    ]}
                  >
                    {t("allLanguages")}
                  </Text>
                </TouchableOpacity>
                {availableLanguages.map((language) => (
                  <TouchableOpacity
                    key={language}
                    style={[
                      styles.chip,
                      { backgroundColor: chipBg, borderColor: chipBorder },
                      selectedLanguage === language && {
                        backgroundColor: activeBg,
                        borderColor: activeBg,
                      },
                    ]}
                    onPress={() => setSelectedLanguage(language)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: isDark ? "#ccd6e0" : "#444" },
                        selectedLanguage === language && styles.chipTextActive,
                      ]}
                    >
                      {getLanguageLabel(language)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sheetRoot: {
    flex: 1,
    overflow: "hidden",
  },
  panelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  compactPanelHeader: {
    paddingHorizontal: 14,
  },
  panelTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  panelTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  compactHeaderActions: {
    gap: 6,
  },
  headerActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 10,
  },
  compactHeaderActionBtn: {
    height: 28,
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 8,
  },
  compactHeaderActionText: {
    fontSize: 9,
  },
  headerClearBtn: {
    borderWidth: 1,
    borderColor: Colors.universal.primary,
  },
  headerClearBtnText: {
    color: Colors.universal.primary,
    fontSize: 12,
    fontWeight: "600",
  },
  headerApplyBtn: {
    backgroundColor: Colors.universal.primary,
  },
  headerApplyBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  divider: {
    height: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 24,
  },
  loadingContainer: {
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center",
  },
  section: {
    gap: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "500",
  },
  chipTextActive: {
    color: "#fff",
    fontWeight: "600",
  },
});
