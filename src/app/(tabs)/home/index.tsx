import RetryButton from "@/components/RetryButton";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useHover } from "@/hooks/useHover";
import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/Colors";
import { webTransition } from "@/constants/webStyle";
import { useScreenFadeIn } from "@/hooks/useScreenFadeIn";
import { useDebouncedValue } from "../../../hooks/useDebouncedValue";
import { useVideoList } from "../../../hooks/useVideoList";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLanguage } from "../../../../contexts/LanguageContext";
import VideoGridList from "@/components/VideoGridList";
import VideoGridCardSkeleton from "@/components/VideoGridCardSkeleton";
import { getLanguageLabel } from "../../../../utils/languageLabel";
import { useVideoFilterStore } from "../../../../stores/videoFilterStore";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const IS_WEB = Platform.OS === "web";
const SEARCH_ICON_SIZE = IS_WEB ? 16 : 18;
const HEADER_ICON_SIZE = IS_WEB ? 22 : 27;
const HEADER_CLOSE_ICON_SIZE = IS_WEB ? 21 : 25;
// Floating NativeTabs pill on web sits at top: 24px with height 40px (ends at 64px).
const WEB_TAB_BAR_TOP_OFFSET = 80;

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const { t } = useTranslation();
  const { lang, rtl } = useLanguage();
  const { fadeAnim, onLayout } = useScreenFadeIn(800);
  const listOpacity = useRef(new Animated.Value(1)).current;
  const insets = useSafeAreaInsets();

  const searchInputRef = useRef<TextInput>(null);
  const storeDefaultLanguage = useVideoFilterStore((s) => s.defaultLanguage);
  const selectedTopic = useVideoFilterStore((s) => s.selectedTopic);
  const selectedAuthor = useVideoFilterStore((s) => s.selectedAuthor);
  const selectedLanguageValue = useVideoFilterStore((s) => s.selectedLanguage);
  const setDefaultLanguage = useVideoFilterStore((s) => s.setDefaultLanguage);
  const resetFilters = useVideoFilterStore((s) => s.resetFilters);
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);

  // Web-only Hover-States fuer die Header-Buttons.
  const { hovered: searchBtnHovered, hoverProps: searchBtnHoverProps } =
    useHover();
  const { hovered: filterBtnHovered, hoverProps: filterBtnHoverProps } =
    useHover();

  const selectedVideoLanguage =
    storeDefaultLanguage === null ? lang : selectedLanguageValue;
  const debouncedSearchQuery = useDebouncedValue(searchQuery.trim(), 350);
  const activeFilterCount =
    (selectedTopic ? 1 : 0) +
    (selectedAuthor ? 1 : 0) +
    (selectedVideoLanguage !== lang ? 1 : 0);
  const hasActiveSearch = debouncedSearchQuery.length > 0;
  const {
    videos,
    isLoading: videosLoading,
    isError: videosError,
    error: videosErrorObj,
    refetch: videosRefetch,
    isRefetching: videosIsRefetching,
    isFetching: videosIsFetching,
  } = useVideoList({
    language: selectedVideoLanguage,
    selectedTopic,
    selectedAuthor,
    searchQuery: debouncedSearchQuery,
  });

  useEffect(() => {
    setDefaultLanguage(lang);
  }, [lang, setDefaultLanguage]);

  useEffect(() => {
    if (!videosIsRefetching) setIsManualRefreshing(false);
  }, [videosIsRefetching]);

  useEffect(() => {
    const isBusyFetching = videosIsFetching && !videosLoading;
    Animated.timing(listOpacity, {
      toValue: isBusyFetching ? 0.4 : 1,
      duration: isBusyFetching ? 120 : 280,
      useNativeDriver: true,
    }).start();
  }, [videosIsFetching, videosLoading, listOpacity]);

  useEffect(() => {
    if (!searchVisible) return;

    const timeout = setTimeout(() => {
      searchInputRef.current?.focus();
    }, 120);

    return () => clearTimeout(timeout);
  }, [searchVisible]);

  const clearFilters = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    resetFilters(lang);
  }, [lang, resetFilters]);

  const clearSearch = () => {
    setSearchQuery("");
    Keyboard.dismiss();
  };

  const closeSearch = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSearchQuery("");
    setSearchVisible(false);
    Keyboard.dismiss();
  };

  const renderHeader = useCallback(
    () => (
      <View style={[styles.headerWrapper, IS_WEB && styles.webHeaderWrapper]}>
        <View
          style={[
            styles.sectionHeaderRow,
            IS_WEB && styles.webSectionHeaderRow,
            {
              flexDirection: rtl ? "row-reverse" : "row",
            },
          ]}
        >
          <View
            style={[
              styles.titleGroup,
              IS_WEB && styles.webTitleGroup,
              {
                flexDirection: rtl ? "row-reverse" : "row",
              },
            ]}
          >
            {searchVisible ? (
              <View
                style={[
                  styles.searchContainer,
                  IS_WEB && styles.webSearchContainer,
                  IS_WEB && webTransition("border-color", 160, "ease"),
                  {
                    backgroundColor: Colors[colorScheme].contrast,
                    flexDirection: rtl ? "row-reverse" : "row",
                  },
                  IS_WEB && {
                    borderWidth: 1.5,
                    borderColor: searchFocused
                      ? Colors.universal.primary
                      : "transparent",
                  },
                ]}
              >
                <Ionicons
                  name="search-outline"
                  size={SEARCH_ICON_SIZE}
                  color={colors.tabIconDefault}
                />

                <TextInput
                  ref={searchInputRef}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder={t("search")}
                  placeholderTextColor={Colors[colorScheme].text}
                  returnKeyType="search"
                  autoCorrect={false}
                  autoCapitalize="none"
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                  style={[
                    styles.searchInput,
                    IS_WEB && styles.webSearchInput,
                    {
                      color: colors.text,
                      textAlign: rtl ? "right" : "left",
                      writingDirection: rtl ? "rtl" : "ltr",
                    },
                  ]}
                />

                {searchQuery.length > 0 && (
                  <TouchableOpacity
                    activeOpacity={0.75}
                    onPress={clearSearch}
                    style={[
                      styles.clearSearchButton,
                      IS_WEB && styles.webClearSearchButton,
                    ]}
                  >
                    <Ionicons
                      name="close-circle"
                      size={SEARCH_ICON_SIZE}
                      color={colors.tabIconDefault}
                    />
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <ThemedText
                type="title"
                style={[
                  styles.sectionLabel,
                  IS_WEB && styles.webSectionLabel,
                  {
                    textAlign: rtl ? "right" : "left",
                  },
                ]}
              >
                {t("videosTitle")}
              </ThemedText>
            )}
          </View>

          <View
            style={[
              styles.headerActions,
              IS_WEB && styles.webHeaderActions,
              {
                flexDirection: rtl ? "row-reverse" : "row",
              },
            ]}
          >
            <TouchableOpacity
              {...searchBtnHoverProps}
              activeOpacity={0.75}
              onPress={() => {
                if (searchVisible) {
                  closeSearch();
                } else {
                  setSearchVisible(true);
                }
              }}
              style={[
                styles.iconButton,
                IS_WEB && styles.webIconButton,
                IS_WEB && webTransition("transform, background-color", 160, "ease"),
                {
                  backgroundColor: searchVisible
                    ? Colors.universal.primary
                    : colors.backgroundElement,
                },
                IS_WEB && searchBtnHovered && styles.webIconButtonHover,
              ]}
            >
              <Ionicons
                name={searchVisible ? "close-outline" : "search-outline"}
                size={searchVisible ? HEADER_CLOSE_ICON_SIZE : HEADER_ICON_SIZE}
                color={searchVisible ? "#FFFFFF" : colors.text}
              />
            </TouchableOpacity>

            <TouchableOpacity
              {...filterBtnHoverProps}
              activeOpacity={0.75}
              onPress={() => router.push("/video-filters")}
              style={[
                styles.iconButton,
                IS_WEB && styles.webIconButton,
                IS_WEB && webTransition("transform, background-color", 160, "ease"),
                {
                  backgroundColor: colors.backgroundElement,
                },
                IS_WEB && filterBtnHovered && styles.webIconButtonHover,
              ]}
            >
              <Ionicons
                name="options-outline"
                size={HEADER_ICON_SIZE}
                color={
                  activeFilterCount > 0 ? Colors.universal.primary : colors.text
                }
              />

              {activeFilterCount > 0 && (
                <View style={styles.filterBadge}>
                  <Text style={styles.filterBadgeText}>
                    {activeFilterCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {activeFilterCount > 0 && (
          <View
            style={[
              styles.activeFiltersRow,
              IS_WEB && styles.webActiveFiltersRow,
              {
                flexDirection: rtl ? "row-reverse" : "row",
              },
            ]}
          >
            {selectedTopic && (
              <View
                style={[
                  styles.filterChip,
                  IS_WEB && styles.webFilterChip,
                  {
                    backgroundColor: colors.backgroundElement,
                  },
                ]}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.filterChipText,
                    IS_WEB && styles.webFilterChipText,
                    {
                      color: colors.text,
                      textAlign: rtl ? "right" : "left",
                    },
                  ]}
                >
                  {selectedTopic}
                </Text>
              </View>
            )}

            {selectedAuthor && (
              <View
                style={[
                  styles.filterChip,
                  IS_WEB && styles.webFilterChip,
                  {
                    backgroundColor: colors.backgroundElement,
                  },
                ]}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.filterChipText,
                    IS_WEB && styles.webFilterChipText,
                    {
                      color: colors.text,
                      textAlign: rtl ? "right" : "left",
                    },
                  ]}
                >
                  {selectedAuthor}
                </Text>
              </View>
            )}

            {selectedVideoLanguage !== lang && (
              <View
                style={[
                  styles.filterChip,
                  IS_WEB && styles.webFilterChip,
                  {
                    backgroundColor: colors.backgroundElement,
                  },
                ]}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.filterChipText,
                    IS_WEB && styles.webFilterChipText,
                    {
                      color: colors.text,
                      textAlign: rtl ? "right" : "left",
                    },
                  ]}
                >
                  {getLanguageLabel(selectedVideoLanguage)}
                </Text>
              </View>
            )}

            <TouchableOpacity onPress={clearFilters} activeOpacity={0.75}>
              <Text
                style={[
                  styles.clearFiltersText,
                  IS_WEB && styles.webClearFiltersText,
                  {
                    color: Colors.universal.link,
                  },
                ]}
              >
                {t("reset")}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    ),
    [
      rtl,
      searchVisible,
      searchQuery,
      searchFocused,
      searchBtnHovered,
      searchBtnHoverProps,
      filterBtnHovered,
      filterBtnHoverProps,
      colorScheme,
      colors,
      t,
      activeFilterCount,
      selectedTopic,
      selectedAuthor,
      selectedVideoLanguage,
      lang,
      clearFilters,
    ],
  );

  const renderEmpty = useCallback(() => {
    if (videosLoading) {
      return <VideoGridCardSkeleton />;
    }

    if (videosError) {
      return (
        <View style={styles.errorContainer}>
          <Text
            style={[
              styles.errorText,
              {
                color: colors.error,
              },
            ]}
          >
            {videosErrorObj?.message ?? t("errorLoadingData")}
          </Text>

          <RetryButton onPress={() => videosRefetch()} />
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <ThemedText style={styles.emptyText} type="subtitle">
          {hasActiveSearch || activeFilterCount > 0 && !videosLoading
            ? t("noSearchResult")
            : t("videosEmpty")}
        </ThemedText>
      </View>
    );
  }, [
    videosLoading,
    videosError,
    videosErrorObj,
    t,
    hasActiveSearch,
    activeFilterCount,
    videosRefetch,
    colors,
  ]);

  return (
    <Animated.View
      onLayout={onLayout}
      style={[
        styles.animatedContainer,
        {
          opacity: fadeAnim,
          backgroundColor: colors.background,
          paddingTop: IS_WEB ? WEB_TAB_BAR_TOP_OFFSET : insets.top,
        },
        // Platform.OS === "ios" &&
        //   parseInt(Platform.Version, 10) >= 26 && {
        //     paddingBottom: insets.bottom,
        //   },
      ]}
    >
      <KeyboardAvoidingView
        enabled={!IS_WEB && searchVisible}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
        style={styles.keyboardAvoidingView}
      >
        <Animated.View style={{ flex: 1, opacity: listOpacity }}>
          <VideoGridList
            videos={videos}
            layout={
              hasActiveSearch || activeFilterCount > 0 ? "grid" : "topicRows"
            }
            gridColumns={hasActiveSearch || activeFilterCount > 0 ? 1 : 2}
            ListHeaderComponent={renderHeader()}
            ListEmptyComponent={renderEmpty}
            refreshing={isManualRefreshing}
            onRefresh={() => {
              setIsManualRefreshing(true);
              videosRefetch();
            }}
          />
        </Animated.View>
      </KeyboardAvoidingView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  animatedContainer: {
    flex: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
    backgroundColor: "transparent"
  },
  headerWrapper: {
    paddingBottom: 16,
    paddingTop: 10,
  },
  webHeaderWrapper: {
    paddingBottom: 12,
    paddingTop: 8,
  },
  sectionHeaderRow: {
    minHeight: 40,
    justifyContent: "space-between",
    alignItems: "center",
  },
  webSectionHeaderRow: {
    minHeight: 36,
  },
  titleGroup: {
    flex: 1,
    alignItems: "center",
    gap: 10,
    paddingRight: 12,
    height: 40,
  },
  webTitleGroup: {
    height: 36,
  },
  sectionLabel: {},
  webSectionLabel: {
    fontSize: 24,
    lineHeight: 26,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  headerActions: {
    alignItems: "center",
    gap: 8,
  },
  webHeaderActions: {
    gap: 6,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
  },
  webIconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    transform: [{ scale: 1 }],
  },
  webIconButtonHover: {
    transform: [{ scale: 1.08 }],
  },
  searchContainer: {
    minHeight: 44,
    borderRadius: 22,
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 8,
    flex: 1,
  },
  webSearchContainer: {
    minHeight: 36,
    borderRadius: 18,
    paddingHorizontal: 12,
    gap: 7,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    paddingVertical: 10,
    ...(Platform.OS === "web" && {
      outlineStyle: "none",
    }),
  },
  webSearchInput: {
    fontSize: 13,
    paddingVertical: 7,
  },
  clearSearchButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
  },
  webClearSearchButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  filterBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    backgroundColor: Colors.universal.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  filterBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  activeFiltersRow: {
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  webActiveFiltersRow: {
    gap: 6,
    marginTop: 8,
  },
  filterChip: {
    maxWidth: 170,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  webFilterChip: {
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: "600",
  },
  webFilterChipText: {
    fontSize: 11,
  },
  clearFiltersText: {
    fontSize: 12,
    fontWeight: "700",
  },
  webClearFiltersText: {
    fontSize: 11,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
    backgroundColor: "transparent",
  },
  emptyText: {
    textAlign: "center",
  },
  errorContainer: {
    alignItems: "center",
    gap: 10,
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  errorText: {
    fontSize: 16,
    textAlign: "center",
  },
});
