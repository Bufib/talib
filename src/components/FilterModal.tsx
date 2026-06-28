import { Colors } from "@/constants/Colors";
import { LoadingIndicator } from "@/components/LoadingIndicator";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useVideoFilters } from "@/hooks/useVideoFilters";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo } from "react";
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

type TopicFilterGroup = {
  key: string;
  title: string | null;
  topics: {
    label: string;
    value: string;
    isDirectRoot: boolean;
  }[];
};

function splitTopicLabel(topic: string) {
  const parts = topic
    .split(">")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length <= 1) {
    return { parent: null, child: topic.trim() };
  }

  return {
    parent: parts.slice(0, parts.length - 1).join(" > "),
    child: parts[parts.length - 1],
  };
}

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

  const topicGroups = useMemo<TopicFilterGroup[]>(() => {
    const groupsByParent = new Map<string, TopicFilterGroup>();

    for (const topic of availableTopics) {
      const { parent, child } = splitTopicLabel(topic);
      const groupTitle = parent ?? child;
      const topicItem = {
        label: child,
        value: topic,
        isDirectRoot: !parent,
      };
      const existing = groupsByParent.get(groupTitle);

      if (existing) {
        existing.topics.push(topicItem);
      } else {
        groupsByParent.set(groupTitle, {
          key: groupTitle,
          title: groupTitle,
          topics: [topicItem],
        });
      }
    }

    const sortTopicItems = (items: TopicFilterGroup["topics"]) =>
      items.sort((a, b) => {
        if (a.isDirectRoot !== b.isDirectRoot) {
          return a.isDirectRoot ? -1 : 1;
        }

        return a.label.localeCompare(b.label, lang);
      });

    return [...groupsByParent.values()]
      .map((group) => ({
        ...group,
        title: group.topics.some((topic) => !topic.isDirectRoot)
          ? group.title
          : null,
        topics: sortTopicItems(group.topics),
      }))
      .sort((a, b) => (a.title ?? "").localeCompare(b.title ?? "", lang));
  }, [availableTopics, lang]);

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
              {!isCompactWeb && (
                <Text style={styles.headerClearBtnText}>
                  {t("resetFilters")}
                </Text>
              )}
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
            {!isCompactWeb && (
              <Text style={styles.headerApplyBtnText}>{t("applyFilters")}</Text>
            )}
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
                  {topicGroups.map((group) => (
                    <View key={group.key} style={styles.topicFilterGroup}>
                      {group.title ? (
                        <Text
                          style={[
                            styles.topicFilterGroupTitle,
                            { color: sectionLabelColor },
                          ]}
                          numberOfLines={1}
                        >
                          {group.title}
                        </Text>
                      ) : null}
                      <View style={styles.chipsWrap}>
                        {group.topics.map((topic) => (
                          <TouchableOpacity
                            key={topic.value}
                            style={[
                              styles.chip,
                              {
                                backgroundColor: chipBg,
                                borderColor: chipBorder,
                              },
                              selectedTopic === topic.value && {
                                backgroundColor: activeBg,
                                borderColor: activeBg,
                              },
                            ]}
                            onPress={() =>
                              setSelectedTopic(
                                selectedTopic === topic.value
                                  ? null
                                  : topic.value,
                              )
                            }
                          >
                            <Text
                              style={[
                                styles.chipText,
                                { color: isDark ? "#ccd6e0" : "#444" },
                                selectedTopic === topic.value &&
                                  styles.chipTextActive,
                              ]}
                            >
                              {topic.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
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
    width: 28,
    height: 28,
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderRadius: 8,
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
    letterSpacing: 0,
  },
  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  topicFilterGroup: {
    width: "100%",
    gap: 8,
    marginTop: 2,
  },
  topicFilterGroupTitle: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
    letterSpacing: 0,
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
