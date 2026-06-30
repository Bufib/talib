import VideoGridCard from "@/components/VideoGridCard";
import { Colors } from "@/constants/Colors";
import type { VideoType } from "@/constants/Types";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useLanguage } from "../../contexts/LanguageContext";
import {
  compareBySortOrderThenName,
  getTopicDisplayName,
  getTopicColor,
  getTopicSortOrder,
  getVideoTopics,
  hexToRgba,
  type TopicSortOrders,
} from "../../utils/videoTopics";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FlatList,
  type FlatListProps,
  type ListRenderItemInfo,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

const IS_WEB = Platform.OS === "web";
const WEB_MAX_CONTENT_WIDTH = 960;
// Eine einspaltige Grid-Karte auf Web nicht ueber diese Breite wachsen lassen.
const WEB_SINGLE_CARD_MAX = 560;
const HORIZONTAL_PADDING = IS_WEB ? 10 : 16;
const ROW_CARD_GAP = IS_WEB ? 12 : 14;
const GRID_CARD_GAP = 12;
const UNCATEGORIZED_TOPIC_KEY = "__uncategorized__";
const GRID_ITEM_PADDING_BOTTOM = 16;
// Worst-case Card-Hoehe (Web): Thumbnail (16:9) + Title/Author/Date/Button.
// Author-Row ist konditional – wir reservieren immer Platz, damit FlatList
// stabile Offsets behaelt und beim Schnellscrollen nicht springt.
const WEB_GRID_CARD_CONTENT_HEIGHT = 144;

type TopicVideoSection = {
  key: string;
  title: string;
  fullTitle: string;
  videos: VideoType[];
  isUncategorized: boolean;
  isDirectRoot: boolean;
  sortOrder: number | null;
  colorHex: string;
};

type TopicVideoGroup = {
  key: string;
  title: string;
  sections: TopicVideoSection[];
  isUncategorized: boolean;
  videoCount: number;
  sortOrder: number | null;
  colorHex: string;
};

type VideoGridListProps = {
  videos: VideoType[];
  layout?: "topicRows" | "grid";
  gridColumns?: number;
  ListHeaderComponent?: FlatListProps<VideoType>["ListHeaderComponent"];
  ListEmptyComponent?: FlatListProps<VideoType>["ListEmptyComponent"];
  refreshing?: boolean;
  onRefresh?: () => void;
  topicSortOrders?: TopicSortOrders;
};

export default function VideoGridList({
  videos,
  layout = "topicRows",
  gridColumns = 2,
  ListHeaderComponent,
  ListEmptyComponent,
  refreshing = false,
  onRefresh,
  topicSortOrders,
}: VideoGridListProps) {
  const { width } = useWindowDimensions();
  const { lang, rtl } = useLanguage();
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const categoryHeaderColor =
    colorScheme === "dark"
      ? "rgba(255,255,255,0.045)"
      : "rgba(255,255,255,0.72)";
  const categoryBorderColor =
    colorScheme === "dark"
      ? "rgba(255,255,255,0.10)"
      : "rgba(17,24,28,0.08)";
  const controlSurfaceColor =
    colorScheme === "dark"
      ? "rgba(255,255,255,0.07)"
      : "rgba(17,24,28,0.045)";
  const subtopicHeaderColor =
    colorScheme === "dark"
      ? "rgba(255,255,255,0.032)"
      : "rgba(255,255,255,0.50)";
  const defaultTopicColor = Colors.universal.primary;
  const [expandedTopicGroups, setExpandedTopicGroups] = useState<Set<string>>(
    () => new Set(),
  );
  const [expandedTopicSections, setExpandedTopicSections] = useState<Set<string>>(
    () => new Set(),
  );
  const topicTapStateRef = useRef<{
    key: string | null;
    count: number;
    timeout: ReturnType<typeof setTimeout> | null;
  }>({
    key: null,
    count: 0,
    timeout: null,
  });

  const layoutWidth = IS_WEB ? Math.min(width, WEB_MAX_CONTENT_WIDTH) : width;

  const topicCardWidth = useMemo(() => {
    const availableWidth = Math.max(0, layoutWidth - HORIZONTAL_PADDING * 2);
    const targetWidth =
      layoutWidth >= 640
        ? IS_WEB
          ? 300
          : 360
        : Math.round(availableWidth * 0.82);

    return Math.min(availableWidth, Math.max(260, targetWidth));
  }, [layoutWidth]);

  const gridCardWidth = useMemo(() => {
    const availableWidth = Math.max(0, layoutWidth - HORIZONTAL_PADDING * 2);
    const minWidth = gridColumns === 1 ? 0 : IS_WEB ? 160 : 120;
    const totalGap = Math.max(0, gridColumns - 1) * GRID_CARD_GAP;
    const computed = Math.max(
      minWidth,
      Math.floor((availableWidth - totalGap) / Math.max(1, gridColumns)),
    );

    // Auf Web einspaltige Karten begrenzen, damit sie nicht uebergross wirken.
    // Auf kleinen Screens dieselbe kompakte Breite wie in den Topic-Reihen
    // verwenden, statt fast die komplette Viewport-Breite zu fuellen.
    if (IS_WEB && gridColumns === 1) {
      const singleCardMax =
        layoutWidth >= 640
          ? WEB_SINGLE_CARD_MAX
          : Math.max(260, Math.round(availableWidth * 0.82));

      return Math.min(computed, singleCardMax);
    }

    return computed;
  }, [gridColumns, layoutWidth]);

  const uncategorizedTitle = t("uncategorizedTopic");

  const topicGroups = useMemo<TopicVideoGroup[]>(() => {
    const groupsByKey = new Map<
      string,
      Omit<TopicVideoGroup, "videoCount"> & { videoIds: Set<number> }
    >();

    const getOrCreateGroup = (
      key: string,
      title: string,
      isUncategorized: boolean,
      sortOrder: number | null,
      colorHex: string,
    ) => {
      const existing = groupsByKey.get(key);
      if (existing) {
        if (existing.sortOrder === null && sortOrder !== null) {
          existing.sortOrder = sortOrder;
        }
        if (existing.colorHex === defaultTopicColor && colorHex !== defaultTopicColor) {
          existing.colorHex = colorHex;
        }
        return existing;
      }

      const group = {
        key,
        title,
        sections: [],
        isUncategorized,
        sortOrder,
        colorHex,
        videoIds: new Set<number>(),
      };
      groupsByKey.set(key, group);
      return group;
    };

    const addVideoToSection = (
      group: Omit<TopicVideoGroup, "videoCount"> & { videoIds: Set<number> },
      section: Omit<TopicVideoSection, "videos">,
      video: VideoType,
    ) => {
      group.videoIds.add(video.id);

      const existing = group.sections.find(
        (currentSection) => currentSection.key === section.key,
      );

      if (existing) {
        if (!existing.videos.some((existingVideo) => existingVideo.id === video.id)) {
          existing.videos.push(video);
        }
        return;
      }

      group.sections.push({ ...section, videos: [video] });
    };

    for (const video of videos) {
      const topics = getVideoTopics(video);

      if (topics.length === 0) {
        const group = getOrCreateGroup(
          UNCATEGORIZED_TOPIC_KEY,
          uncategorizedTitle,
          true,
          null,
          defaultTopicColor,
        );

        addVideoToSection(
          group,
          {
            key: UNCATEGORIZED_TOPIC_KEY,
            title: uncategorizedTitle,
            fullTitle: uncategorizedTitle,
            isUncategorized: true,
            isDirectRoot: true,
            sortOrder: null,
            colorHex: defaultTopicColor,
          },
          video,
        );
        continue;
      }

      for (const topic of topics) {
        const categoryName = topic.category?.name.trim();
        const topicTitle = topic.name.trim();
        if (!topicTitle) continue;

        const fullTitle = getTopicDisplayName(topic);
        const isRootCategory = !categoryName;
        const groupTitle = categoryName || topicTitle;
        const groupSortOrder = topicSortOrders
          ? getTopicSortOrder(topicSortOrders.categories, groupTitle)
          : null;
        const groupColorHex = topicSortOrders
          ? getTopicColor(
              topicSortOrders.categoryColors,
              groupTitle,
              defaultTopicColor,
            )
          : defaultTopicColor;
        const sectionSortOrder =
          categoryName && topicSortOrders
            ? getTopicSortOrder(topicSortOrders.subcategories, topicTitle)
            : null;
        const sectionColorHex =
          categoryName && topicSortOrders
            ? getTopicColor(
                topicSortOrders.subcategoryColors,
                topicTitle,
                groupColorHex,
              )
            : groupColorHex;
        const groupKey = topic.category_id
          ? `category:${topic.category_id}`
          : `category:${groupTitle.toLocaleLowerCase()}`;
        const sectionKey = categoryName
          ? `subcategory:${topic.subcategory_id ?? fullTitle.toLocaleLowerCase()}`
          : `${groupKey}:root`;

        const group = getOrCreateGroup(
          groupKey,
          groupTitle,
          false,
          groupSortOrder,
          groupColorHex,
        );
        addVideoToSection(
          group,
          {
            key: sectionKey,
            title: categoryName ? topicTitle : groupTitle,
            fullTitle,
            isUncategorized: false,
            isDirectRoot: isRootCategory,
            sortOrder: sectionSortOrder,
            colorHex: sectionColorHex,
          },
          video,
        );
      }
    }

    return Array.from(groupsByKey.values()).map((group) => ({
      key: group.key,
      title: group.title,
      sections: group.sections.sort((a, b) => {
        if (a.isDirectRoot !== b.isDirectRoot) {
          return a.isDirectRoot ? -1 : 1;
        }

        return compareBySortOrderThenName(
          { name: a.title, sortOrder: a.sortOrder },
          { name: b.title, sortOrder: b.sortOrder },
          lang,
        );
      }),
      isUncategorized: group.isUncategorized,
      videoCount: group.videoIds.size,
      sortOrder: group.sortOrder,
      colorHex: group.colorHex,
    })).sort((a, b) => {
      if (a.isUncategorized !== b.isUncategorized) {
        return a.isUncategorized ? 1 : -1;
      }

      return compareBySortOrderThenName(
        { name: a.title, sortOrder: a.sortOrder },
        { name: b.title, sortOrder: b.sortOrder },
        lang,
      );
    });
  }, [defaultTopicColor, lang, topicSortOrders, uncategorizedTitle, videos]);

  // Stabile Card-Hoehe auf Web, damit FlatList beim Schnellscrollen
  // keine variierenden Item-Hoehen schaetzen muss (Author-Row ist konditional).
  const webGridCardMinHeight = useMemo(() => {
    if (!IS_WEB) return undefined;
    const thumbnailHeight = Math.round(gridCardWidth * (9 / 16));
    return thumbnailHeight + WEB_GRID_CARD_CONTENT_HEIGHT;
  }, [gridCardWidth]);

  const renderGridItem = useCallback(
    ({ item }: ListRenderItemInfo<VideoType>) => {
      const isWebCentered = IS_WEB && gridColumns === 1;

      return (
        <View
          style={[
            styles.gridItemWrapper,
            isWebCentered
              ? styles.webCenteredGridItem
              : { width: gridCardWidth },
            webGridCardMinHeight ? { minHeight: webGridCardMinHeight } : null,
          ]}
        >
          <View
            style={[
              { width: gridCardWidth },
              webGridCardMinHeight ? { minHeight: webGridCardMinHeight } : null,
            ]}
          >
            <VideoGridCard
              video={item}
              width={gridCardWidth}
              rtl={rtl}
              lang={lang}
            />
          </View>
        </View>
      );
    },
    [gridCardWidth, gridColumns, lang, rtl, webGridCardMinHeight],
  );

  const getTopicItemLayout = useCallback(
    (_data: ArrayLike<VideoType> | null | undefined, index: number) => ({
      length: topicCardWidth,
      offset: (topicCardWidth + ROW_CARD_GAP) * index,
      index,
    }),
    [topicCardWidth],
  );

  const renderVideo = useCallback(
    ({ item }: ListRenderItemInfo<VideoType>) => (
      <View style={styles.itemWrapper}>
        <VideoGridCard video={item} width={topicCardWidth} rtl={rtl} lang={lang} />
      </View>
    ),
    [lang, rtl, topicCardWidth],
  );

  const handleTopicTitlePress = useCallback(
    (target: { key: string; title: string; isUncategorized: boolean }) => {
      if (target.isUncategorized) return;

      const tapState = topicTapStateRef.current;

      if (tapState.timeout) {
        clearTimeout(tapState.timeout);
        tapState.timeout = null;
      }

      if (tapState.key !== target.key) {
        tapState.key = target.key;
        tapState.count = 0;
      }

      tapState.count += 1;

      if (tapState.count >= 10) {
        tapState.key = null;
        tapState.count = 0;

        router.push({
          pathname: "/settings/add-video",
          params: {
            mode: "manage",
            topic: target.title,
            authNonce: String(Date.now()),
          },
        });
        return;
      }

      tapState.timeout = setTimeout(() => {
        tapState.key = null;
        tapState.count = 0;
        tapState.timeout = null;
      }, 3000);
    },
    [],
  );

  useEffect(() => {
    const tapState = topicTapStateRef.current;

    return () => {
      if (tapState.timeout) clearTimeout(tapState.timeout);
    };
  }, []);

  const toggleTopicGroup = useCallback((key: string) => {
    setExpandedTopicGroups((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const toggleTopicSection = useCallback((key: string) => {
    setExpandedTopicSections((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const renderSectionRow = useCallback(
    (section: TopicVideoSection, hideTitle: boolean) => {
      const isCollapsed =
        !hideTitle && !expandedTopicSections.has(section.key);
      const accentSoftColor = hexToRgba(
        section.colorHex,
        colorScheme === "dark" ? 0.2 : 0.1,
      );

      return (
        <View
          key={section.key}
          style={[
            styles.subtopicSection,
            hideTitle && styles.subtopicSectionWithoutTitle,
            !hideTitle && styles.subtopicSectionIndented,
            !hideTitle && rtl && styles.subtopicSectionIndentedRtl,
            !hideTitle &&
              (rtl
                ? { borderRightColor: categoryBorderColor }
                : { borderLeftColor: categoryBorderColor }),
          ]}
        >
          {!hideTitle ? (
            <Pressable
              accessibilityLabel={
                isCollapsed ? `${section.title} öffnen` : `${section.title} schließen`
              }
              accessibilityRole="button"
              onPress={() => {
                toggleTopicSection(section.key);
                handleTopicTitlePress({
                  key: section.key,
                  title: section.fullTitle,
                  isUncategorized: section.isUncategorized,
                });
              }}
              style={[
                styles.subtopicHeader,
                rtl && styles.topicHeaderReverse,
                {
                  backgroundColor: subtopicHeaderColor,
                  borderColor: categoryBorderColor,
                },
              ]}
            >
              <View
                style={[
                  styles.chevronButton,
                  {
                    backgroundColor: controlSurfaceColor,
                    borderColor: categoryBorderColor,
                  },
                ]}
              >
                <Ionicons
                  name={
                    isCollapsed
                      ? rtl
                        ? "chevron-back"
                        : "chevron-forward"
                      : "chevron-down"
                  }
                  size={16}
                  color={colors.tabIconDefault}
                />
              </View>

              <View
                style={[
                  styles.subtopicMarker,
                  { backgroundColor: section.colorHex },
                ]}
              />

              <Text
                style={[
                  styles.subtopicTitle,
                  {
                    color: colors.text,
                    textAlign: rtl ? "right" : "left",
                    writingDirection: rtl ? "rtl" : "ltr",
                  },
                ]}
                numberOfLines={1}
              >
                {section.title}
              </Text>

              <Text
                style={[
                  styles.subtopicCount,
                  {
                    backgroundColor: accentSoftColor,
                    color: section.colorHex,
                  },
                  rtl && { textAlign: "left" },
                ]}
                numberOfLines={1}
              >
                {section.videos.length}
              </Text>
            </Pressable>
          ) : null}

          {!isCollapsed ? (
            <FlatList
              data={section.videos}
              horizontal
              keyExtractor={(item) => item.id.toString()}
              getItemLayout={getTopicItemLayout}
              renderItem={renderVideo}
              ItemSeparatorComponent={TopicCardSeparator}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[
                styles.rowContent,
                IS_WEB && styles.webRowContent,
              ]}
              style={styles.rowList}
            />
          ) : null}
        </View>
      );
    },
    [
      categoryBorderColor,
      colorScheme,
      controlSurfaceColor,
      colors.tabIconDefault,
      colors.text,
      expandedTopicSections,
      getTopicItemLayout,
      handleTopicTitlePress,
      renderVideo,
      rtl,
      subtopicHeaderColor,
      toggleTopicSection,
    ],
  );

  const renderGroup = useCallback(
    ({ item: group }: ListRenderItemInfo<TopicVideoGroup>) => {
      const isGroupCollapsed =
        !group.isUncategorized && !expandedTopicGroups.has(group.key);
      const directRootSections = group.sections.filter(
        (section) => section.isDirectRoot,
      );
      const subtopicSections = group.sections.filter(
        (section) => !section.isDirectRoot,
      );
      const hasSubtopicRows = subtopicSections.length > 0;
      const hasMixedRows = directRootSections.length > 0 && hasSubtopicRows;
      const topicAccentSoftColor = hexToRgba(
        group.colorHex,
        colorScheme === "dark" ? 0.18 : 0.11,
      );

      return (
        <View style={[styles.topicGroup, IS_WEB && styles.webTopicGroup]}>
          <Pressable
            accessibilityLabel={
              isGroupCollapsed ? `${group.title} öffnen` : `${group.title} schließen`
            }
            accessibilityRole="button"
            disabled={group.isUncategorized}
            onPress={() => {
              toggleTopicGroup(group.key);
              handleTopicTitlePress({
                key: group.key,
                title: group.title,
                isUncategorized: group.isUncategorized,
              });
            }}
            style={[
              styles.topicHeader,
              IS_WEB && styles.webTopicHeader,
              rtl && styles.topicHeaderReverse,
              {
                backgroundColor: categoryHeaderColor,
                borderColor: categoryBorderColor,
              },
            ]}
          >
            <View
              style={[
                styles.topicTitleWrap,
                { flexDirection: rtl ? "row-reverse" : "row" },
              ]}
            >
              {IS_WEB && (
                <View
                  style={[
                    styles.webTopicAccent,
                    { backgroundColor: group.colorHex },
                  ]}
                />
              )}

              <View
                style={[
                  styles.chevronButton,
                  {
                    backgroundColor: controlSurfaceColor,
                    borderColor: categoryBorderColor,
                  },
                ]}
              >
                <Ionicons
                  name={
                    isGroupCollapsed
                      ? rtl
                        ? "chevron-back"
                        : "chevron-forward"
                      : "chevron-down"
                  }
                  size={18}
                  color={colors.tabIconDefault}
                />
              </View>

              <View
                style={[
                  styles.topicIconTile,
                  IS_WEB && styles.webTopicIconTile,
                  { backgroundColor: topicAccentSoftColor },
                ]}
              >
                <Ionicons
                  name={hasSubtopicRows ? "folder-open-outline" : "albums-outline"}
                  size={IS_WEB ? 14 : 15}
                  color={group.colorHex}
                />
              </View>

              <Text
                style={[
                  styles.topicTitle,
                  IS_WEB && styles.webTopicTitle,
                  {
                    color: colors.text,
                    textAlign: rtl ? "right" : "left",
                    writingDirection: rtl ? "rtl" : "ltr",
                  },
                ]}
                numberOfLines={1}
              >
                {group.title}
              </Text>
            </View>

            <Text
              style={[
                styles.topicCount,
                {
                  backgroundColor:
                    colorScheme === "dark" ? controlSurfaceColor : colors.contrast,
                  color:
                    group.colorHex,
                },
                !IS_WEB && { textAlign: rtl ? "left" : "right" },
              ]}
              numberOfLines={1}
            >
              {group.videoCount}
            </Text>
          </Pressable>

          {!isGroupCollapsed ? (
            <View style={hasSubtopicRows && styles.subtopicList}>
              {directRootSections.map((section) =>
                renderSectionRow(section, true),
              )}
              {hasMixedRows ? <View style={styles.mixedRowsSpacer} /> : null}
              {subtopicSections.map((section) =>
                renderSectionRow(section, false),
              )}
            </View>
          ) : null}
        </View>
      );
    },
    [
      categoryBorderColor,
      categoryHeaderColor,
      colorScheme,
      colors.contrast,
      colors.tabIconDefault,
      colors.text,
      controlSurfaceColor,
      expandedTopicGroups,
      rtl,
      handleTopicTitlePress,
      renderSectionRow,
      toggleTopicGroup,
    ],
  );

  if (layout === "grid") {
    return (
      <FlatList
        key={`video-grid-${gridColumns}`}
        style={IS_WEB && styles.webListFrame}
        data={videos}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderGridItem}
        numColumns={gridColumns}
        columnWrapperStyle={
          gridColumns > 1
            ? [
                styles.gridColumnWrapper,
                rtl && styles.gridColumnWrapperReverse,
              ]
            : undefined
        }
        refreshing={refreshing}
        onRefresh={onRefresh}
        ListHeaderComponent={ListHeaderComponent}
        ListEmptyComponent={ListEmptyComponent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      />
    );
  }

  return (
    <FlatList
      key="topic-rows"
      style={IS_WEB && styles.webListFrame}
      data={topicGroups}
      keyExtractor={(item) => item.key}
      renderItem={renderGroup}
      refreshing={refreshing}
      onRefresh={onRefresh}
      ListHeaderComponent={ListHeaderComponent}
      ListEmptyComponent={ListEmptyComponent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.listContent}
      // initialNumToRender={4}
      // maxToRenderPerBatch={4}
      // windowSize={7}
    />
  );
}

function TopicCardSeparator() {
  return <View style={styles.cardSeparator} />;
}

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingBottom: 30,
  },
  topicGroup: {
    marginBottom: 30,
  },
  webTopicGroup: {
    marginBottom: 24,
  },
  topicHeader: {
    minHeight: 34,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: IS_WEB ? 10 : 12,
    paddingVertical: IS_WEB ? 7 : 9,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  webTopicHeader: {
    minHeight: 38,
    marginBottom: 10,
  },
  topicHeaderReverse: {
    flexDirection: "row-reverse",
  },
  topicTitleWrap: {
    flex: 1,
    alignItems: "center",
    gap: 8,
  },
  topicTitlePressable: {
    flex: 1,
    minWidth: 0,
  },
  chevronButton: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  webTopicAccent: {
    width: 4,
    height: 17,
    borderRadius: 2,
  },
  topicIconTile: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  webTopicIconTile: {
    width: 26,
    height: 26,
  },
  topicTitle: {
    flex: 1,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: "900",
  },
  webTopicTitle: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "800",
    letterSpacing: 0,
  },
  topicCount: {
    minWidth: 28,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
    textAlign: "center",
  },
  webTopicCountPill: {
    minWidth: 26,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: "hidden",
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "800",
    textAlign: "center",
  },
  webListFrame: {
    width: "100%",
    maxWidth: WEB_MAX_CONTENT_WIDTH,
    alignSelf: "center",
  },
  rowList: {
    overflow: "visible",
  },
  subtopicList: {
    gap: 16,
  },
  mixedRowsSpacer: {
    height: 2,
  },
  subtopicSection: {
    marginBottom: 2,
  },
  subtopicSectionWithoutTitle: {
    marginBottom: 0,
  },
  subtopicSectionIndented: {
    marginLeft: IS_WEB ? 12 : 6,
    paddingLeft: IS_WEB ? 14 : 10,
    borderLeftWidth: StyleSheet.hairlineWidth,
  },
  subtopicSectionIndentedRtl: {
    marginLeft: 0,
    marginRight: IS_WEB ? 12 : 6,
    paddingLeft: 0,
    paddingRight: IS_WEB ? 14 : 10,
    borderLeftWidth: 0,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  subtopicHeader: {
    minHeight: 34,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingHorizontal: IS_WEB ? 8 : 10,
    paddingVertical: IS_WEB ? 5 : 7,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  subtopicMarker: {
    width: 3,
    height: 18,
    borderRadius: 2,
  },
  subtopicTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: IS_WEB ? 13 : 15,
    lineHeight: IS_WEB ? 18 : 20,
    fontWeight: "800",
    letterSpacing: 0,
  },
  subtopicCount: {
    minWidth: 24,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: "hidden",
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "800",
    textAlign: "center",
  },
  rowContent: {
    paddingTop: 2,
    paddingBottom: 6,
  },
  webRowContent: {
    paddingBottom: 4,
  },
  gridColumnWrapper: {
    justifyContent: "space-between",
  },
  gridColumnWrapperReverse: {
    flexDirection: "row-reverse",
  },
  gridItemWrapper: {
    paddingBottom: GRID_ITEM_PADDING_BOTTOM,
  },
  webCenteredGridItem: {
    width: "100%",
    alignItems: "center",
    paddingBottom: GRID_ITEM_PADDING_BOTTOM,
  },
  itemWrapper: {
    paddingBottom: 8,
  },
  cardSeparator: {
    width: ROW_CARD_GAP,
  },
});
