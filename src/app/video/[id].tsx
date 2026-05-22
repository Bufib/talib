import HeaderLeftBackButton from "@/components/HeaderLeftBackButton";
import { LoadingIndicator } from "@/components/LoadingIndicator";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import YoutubeVideoPlayer from "@/components/YoutubeVideoPlayer";
import { Colors } from "@/constants/Colors";
import type { YoutubeVideoPlayerRef } from "@/constants/Types";
import { webTransition } from "@/constants/webStyle";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useHover } from "@/hooks/useHover";
import {
  useIsVideoFinished,
  useVideoFinishedStore,
} from "@/hooks/useVideoFinishedStore";
import {
  useIsVideoWatched,
  useVideoWatchedStore,
} from "@/hooks/useVideoWatchedStore";
import { useVideoById } from "@/hooks/useVideoById";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  type LayoutChangeEvent,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { useLanguage } from "../../../contexts/LanguageContext";
import { useVideoFavoriteFoldersStore } from "../../../stores/videoFavoriteFoldersStore";
import { getYoutubeVideoId, parseYoutubeTime } from "../../../utils/youtube";

const IS_WEB = Platform.OS === "web";
const PLAYER_ASPECT_RATIO = 16 / 9;
const WEB_FULL_HEIGHT_PLAYER_BREAKPOINT = 640;

function firstYoutubeTime(...values: (string | number | null | undefined)[]) {
  for (const value of values) {
    const seconds = parseYoutubeTime(value);
    if (seconds !== undefined) return seconds;
  }
  return undefined;
}

export default function VideoScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const videoId = id ? Number(id) : null;
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const { lang, rtl } = useLanguage();
  const [isPlaying, setIsPlaying] = useState(true);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [playerSize, setPlayerSize] = useState({ width: 0, height: 0 });
  const playerRef = useRef<YoutubeVideoPlayerRef | null>(null);
  const hasHandledEndRef = useRef(false);
  const hasRequestedFullscreenRef = useRef(false);

  // Web-only Hover-State fuer den Favoriten-Button.
  const { hovered: favHovered, hoverProps: favHoverProps } = useHover();

  const { data: video, isLoading, isError } = useVideoById(videoId);
  const isFavorite = useVideoFavoriteFoldersStore((s) =>
    videoId != null ? s.isVideoFavorited(videoId) : false,
  );
  const isWatched = useIsVideoWatched(video?.id, lang);
  const isFinished = useIsVideoFinished(video?.id, lang);
  const markAsWatched = useVideoWatchedStore((s) => s.markAsWatched);
  const markAsFinished = useVideoFinishedStore((s) => s.markAsFinished);

  const youtubeVideoId = useMemo(
    () => getYoutubeVideoId(video?.youtube_url),
    [video?.youtube_url],
  );

  const { videoStartSeconds, videoEndSeconds } = useMemo(() => {
    const start = firstYoutubeTime(video?.start_time);
    const rawEnd = firstYoutubeTime(video?.end_time);
    const end =
      rawEnd !== undefined && (start === undefined || rawEnd > start)
        ? rawEnd
        : undefined;

    return { videoStartSeconds: start, videoEndSeconds: end };
  }, [video?.end_time, video?.start_time]);

  const initialPlayerParams = useMemo(
    () => ({
      ...(videoStartSeconds !== undefined ? { start: videoStartSeconds } : {}),
      ...(videoEndSeconds !== undefined ? { end: videoEndSeconds } : {}),
    }),
    [videoEndSeconds, videoStartSeconds],
  );

  const playerKey = `${youtubeVideoId ?? "no-video"}:${videoStartSeconds ?? "start"}:${videoEndSeconds ?? "end"}`;

  const thumbnailImageSource = useMemo(() => {
    if (!youtubeVideoId) return null;

    return {
      uri: `https://i.ytimg.com/vi/${youtubeVideoId}/hqdefault.jpg`,
      cacheKey: `youtube-thumbnail:${youtubeVideoId}:detail`,
    };
  }, [youtubeVideoId]);

  const playerDimensions = useMemo(() => {
    if (playerSize.width <= 0 || playerSize.height <= 0) {
      return { width: 0, height: 0 };
    }

    if (!IS_WEB) {
      return playerSize;
    }

    if (playerSize.width <= WEB_FULL_HEIGHT_PLAYER_BREAKPOINT) {
      return playerSize;
    }

    const availableAspectRatio = playerSize.width / playerSize.height;

    if (availableAspectRatio > PLAYER_ASPECT_RATIO) {
      return {
        width: Math.round(playerSize.height * PLAYER_ASPECT_RATIO),
        height: playerSize.height,
      };
    }

    return {
      width: playerSize.width,
      height: Math.round(playerSize.width / PLAYER_ASPECT_RATIO),
    };
  }, [playerSize]);

  const onPlayerLayout = useCallback((event: LayoutChangeEvent) => {
    const nextWidth = Math.round(event.nativeEvent.layout.width);
    const nextHeight = Math.round(event.nativeEvent.layout.height);

    if (nextWidth <= 0 || nextHeight <= 0) return;

    setPlayerSize((current) =>
      current.width === nextWidth && current.height === nextHeight
        ? current
        : { width: nextWidth, height: nextHeight },
    );
  }, []);

  const onPressToggleFavorite = useCallback(() => {
    if (videoId == null) return;

    router.push({
      pathname: "/favorite-folders",
      params: { videoId: String(videoId) },
    });
  }, [videoId]);

  const onPlayerReady = useCallback(() => {
    setIsPlayerReady(true);

    if (IS_WEB) return;
    if (hasRequestedFullscreenRef.current) return;

    hasRequestedFullscreenRef.current = true;
    void playerRef.current?.requestFullscreen();
  }, []);

  const handlePlaybackEnded = useCallback(() => {
    if (!video) return;

    setIsPlaying(false);

    if (hasHandledEndRef.current) return;
    hasHandledEndRef.current = true;

    if (!isWatched) {
      markAsWatched(video.id, lang);
    }

    if (!isFinished) {
      markAsFinished(video.id, lang);

      Toast.show({
        type: "success",
        text1: t("marked_as_finished"),
        visibilityTime: 2000,
        position: "top",
      });
    }
  }, [
    isFinished,
    isWatched,
    lang,
    markAsFinished,
    markAsWatched,
    t,
    video,
  ]);

  const onStateChange = useCallback(
    (state: string) => {
      if (state === "playing") {
        setIsPlayerReady(true);
        setIsPlaying(true);
        return;
      }

      if (state === "buffering" || state === "video cued") {
        setIsPlayerReady(true);
        return;
      }

      if (state === "paused") {
        setIsPlaying(false);
        return;
      }

      if (state === "ended") {
        handlePlaybackEnded();
      }
    },
    [handlePlaybackEnded],
  );

  useEffect(() => {
    hasHandledEndRef.current = false;
    hasRequestedFullscreenRef.current = false;
    setIsPlaying(true);
    setIsPlayerReady(false);
  }, [playerKey]);

  useEffect(() => {
    if (!isPlaying || videoEndSeconds === undefined || !youtubeVideoId) return;

    let cancelled = false;

    const checkEndTime = async () => {
      try {
        const currentTime = await playerRef.current?.getCurrentTime();
        if (cancelled || currentTime === undefined) return;

        if (currentTime >= videoEndSeconds - 0.25) {
          handlePlaybackEnded();
        }
      } catch (error) {
        if (__DEV__) {
          console.warn("Failed to read YouTube current time:", error);
        }
      }
    };

    const interval = setInterval(checkEndTime, 500);
    void checkEndTime();

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [handlePlaybackEnded, isPlaying, videoEndSeconds, youtubeVideoId]);

  if (isLoading) {
    return (
      <ThemedView
        style={[styles.center, { backgroundColor: colors.background }]}
      >
        <LoadingIndicator size="large" />
      </ThemedView>
    );
  }

  if (isError || !video) {
    return (
      <ThemedView
        style={[styles.center, { backgroundColor: colors.background }]}
      >
        <ThemedText style={[styles.errorText, { color: colors.error }]}>
          {t("error")}
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <View
        style={[
          styles.header,
          IS_WEB && styles.webHeader,
          {
            backgroundColor: Colors[colorScheme].contrast,
            borderBottomColor: colors.backgroundElement,
            flexDirection: rtl ? "row-reverse" : "row",
            paddingTop: insets.top + 4,
          },
        ]}
      >
        <HeaderLeftBackButton
          color={colors.text}
          size={IS_WEB ? 28 : 34}
          style={styles.backButton}
        />

        <View style={styles.headerTitleBlock}>
          <Text
            numberOfLines={2}
            ellipsizeMode="tail"
            style={[
              styles.headerTitle,
              IS_WEB && styles.webHeaderTitle,
              {
                color: colors.text,
                textAlign: rtl ? "right" : "left",
                writingDirection: rtl ? "rtl" : "ltr",
              },
            ]}
          >
            {video.title}
          </Text>

          {video.author_name && (
            <Text
              numberOfLines={1}
              style={[
                styles.headerAuthor,
                IS_WEB && styles.webHeaderAuthor,
                {
                  color: colors.tabIconDefault,
                  textAlign: rtl ? "right" : "left",
                  writingDirection: rtl ? "rtl" : "ltr",
                },
              ]}
            >
              {video.author_name}
            </Text>
          )}
        </View>

        <TouchableOpacity
          {...favHoverProps}
          accessibilityRole="button"
          activeOpacity={0.75}
          hitSlop={8}
          onPress={onPressToggleFavorite}
          style={[
            styles.favoriteButton,
            IS_WEB && styles.webFavoriteButton,
            IS_WEB && webTransition("transform", 160, "ease"),
            IS_WEB && favHovered && styles.webFavoriteButtonHover,
          ]}
        >
          <Ionicons
            name={isFavorite ? "heart" : "heart-outline"}
            size={IS_WEB ? 24 : 30}
            color={isFavorite ? colors.error : colors.text}
          />
        </TouchableOpacity>
      </View>

      <View
        style={[
          styles.playerStage,
          IS_WEB && styles.webPlayerStage,
          { backgroundColor: IS_WEB ? colors.background : "#000" },
        ]}
      >
        <View
          onLayout={onPlayerLayout}
          style={[styles.playerFrame, IS_WEB && styles.webPlayerFrame]}
        >
          {youtubeVideoId &&
          playerDimensions.width > 0 &&
          playerDimensions.height > 0 ? (
            <View
              style={[
                styles.playerShell,
                {
                  width: playerDimensions.width,
                  height: playerDimensions.height,
                },
                IS_WEB && styles.webPlayerCard,
              ]}
            >
              <YoutubeVideoPlayer
                ref={playerRef}
                key={playerKey}
                height={playerDimensions.height}
                width={playerDimensions.width}
                play={isPlaying}
                autoFullscreen={!IS_WEB}
                videoId={youtubeVideoId}
                initialPlayerParams={initialPlayerParams}
                onChangeState={onStateChange}
                onReady={onPlayerReady}
              />

              {!isPlayerReady && (
                <View pointerEvents="none" style={styles.playerLoadingOverlay}>
                  {thumbnailImageSource && (
                    <Image
                      source={thumbnailImageSource}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                      priority="high"
                      recyclingKey={thumbnailImageSource.cacheKey}
                    />
                  )}

                  <View style={styles.playerLoadingScrim} />

                  <ActivityIndicator color="#FFFFFF" size="small" />
                </View>
              )}
            </View>
          ) : (
            <View style={styles.playerFallback}>
              {youtubeVideoId ? (
                <>
                  {thumbnailImageSource && (
                    <Image
                      source={thumbnailImageSource}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                      priority="high"
                      recyclingKey={thumbnailImageSource.cacheKey}
                    />
                  )}

                  <View style={styles.playerLoadingScrim} />

                  <ActivityIndicator color="#FFFFFF" size="small" />
                </>
              ) : (
                <Text style={styles.playerFallbackText}>
                  {t("videoUnavailable")}
                </Text>
              )}
            </View>
          )}
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
    minHeight: 76,
    paddingBottom: 10,
    paddingHorizontal: 8,
  },
  webHeader: {
    minHeight: 66,
    paddingBottom: 8,
    paddingHorizontal: 18,
  },
  backButton: {
    alignItems: "center",
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  headerTitleBlock: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 20,
  },
  webHeaderTitle: {
    fontSize: 15,
    lineHeight: 19,
  },
  headerAuthor: {
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
  },
  webHeaderAuthor: {
    fontSize: 11,
    lineHeight: 15,
  },
  favoriteButton: {
    alignItems: "center",
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  webFavoriteButton: {
    height: 36,
    width: 36,
    borderRadius: 18,
    transform: [{ scale: 1 }],
  },
  webFavoriteButtonHover: {
    transform: [{ scale: 1.12 }],
  },
  playerStage: {
    flex: 1,
  },
  webPlayerStage: {
    justifyContent: "center",
    paddingBottom: 28,
    paddingHorizontal: 28,
    paddingTop: 28,
  },
  playerFrame: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    overflow: "hidden",
    width: "100%",
    alignSelf: "center",
  },
  webPlayerFrame: {
    maxWidth: 1120,
  },
  playerShell: {
    backgroundColor: "#000",
    overflow: "hidden",
    position: "relative",
  },
  webPlayerCard: {
    borderRadius: 16,
    shadowColor: "#0b1220",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  playerLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  playerLoadingScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.32)",
  },
  playerFallback: {
    alignItems: "center",
    backgroundColor: "#000",
    flex: 1,
    justifyContent: "center",
    width: "100%",
  },
  playerFallbackText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
  },
  center: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  errorText: {
    marginBottom: 12,
  },
});
