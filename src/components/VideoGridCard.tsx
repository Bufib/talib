import { Colors } from "@/constants/Colors";
import { webTransition } from "@/constants/webStyle";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useHover } from "@/hooks/useHover";
import { VideoGridCardType } from "@/constants/Types";
import YoutubeVideoPlayer from "@/components/YoutubeVideoPlayer";
import { useGradient } from "@/hooks/useGradient";
import {
  useIsVideoFinished,
  useVideoFinishedStore,
} from "@/hooks/useVideoFinishedStore";
import {
  useIsVideoWatched,
  useVideoWatchedStore,
} from "@/hooks/useVideoWatchedStore";
import { formatDate } from "../../utils/formatDate";
import { getYoutubeVideoId, parseYoutubeTime } from "../../utils/youtube";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Toast from "react-native-toast-message";
import { useVideoFavoriteFoldersStore } from "../../stores/videoFavoriteFoldersStore";
import { deviceName } from "expo-device";

type Props = VideoGridCardType;

const IS_WEB = Platform.OS === "web";
const PLAYER_ASPECT_RATIO = 9 / 16;
const CARD_RADIUS = 18;
const WEB_CARD_RADIUS = 18;
const STATUS_BUTTON_RADIUS = 14;

function firstYoutubeTime(...values: (string | number | null | undefined)[]) {
  for (const value of values) {
    const seconds = parseYoutubeTime(value);
    if (seconds !== undefined) return seconds;
  }
  return undefined;
}

export default function VideoGridCard({
  video,
  width,
  rtl,
  lang,
  gradientColors,
  playbackMode = "navigate",
  isPlaying = false,
  onRequestPlay,
  onStopPlaying,
}: Props) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const formattedDate = formatDate(video.created_at);

  // Web-only Hover-States – auf Nativ bleiben diese inaktiv.
  const { hovered: cardHovered, hoverProps: cardHoverProps } = useHover();
  const { hovered: watchedHovered, hoverProps: watchedHoverProps } = useHover();

  const webBorderColor =
    colorScheme === "dark" ? "rgba(255,255,255,0.09)" : "rgba(17,24,28,0.08)";

  const authorName = video.author_name;

  const videoId = useMemo(
    () => getYoutubeVideoId(video.youtube_url),
    [video.youtube_url],
  );

  const playerHeight = Math.round(width * PLAYER_ASPECT_RATIO);
  const usesInlinePlayer = playbackMode === "inline";

  // Deterministischer Gradient pro Video-ID. Wenn der Aufrufer einen eigenen
  // gradientColors-Prop übergibt, hat dieser Vorrang.
  const { gradientColors: deterministicGradient } = useGradient({
    seed: video.id,
  });
  const effectiveGradient = gradientColors ?? deterministicGradient;

  const { videoStartSeconds, videoEndSeconds } = useMemo(() => {
    const start = firstYoutubeTime(video.start_time);
    const rawEnd = firstYoutubeTime(video.end_time);
    const end =
      rawEnd !== undefined && (start === undefined || rawEnd > start)
        ? rawEnd
        : undefined;

    return { videoStartSeconds: start, videoEndSeconds: end };
  }, [video.start_time, video.end_time]);

  const initialPlayerParams = useMemo(
    () => ({
      ...(videoStartSeconds !== undefined ? { start: videoStartSeconds } : {}),
      ...(videoEndSeconds !== undefined ? { end: videoEndSeconds } : {}),
    }),
    [videoEndSeconds, videoStartSeconds],
  );

  const playerKey = `${videoId ?? "no-video"}:${videoStartSeconds ?? "start"}:${videoEndSeconds ?? "end"}`;

  const isWatched = useIsVideoWatched(video?.id, lang);
  const isFinished = useIsVideoFinished(video?.id, lang);
  const toggleWatched = useVideoWatchedStore((s) => s.toggleWatched);
  const markAsWatched = useVideoWatchedStore((s) => s.markAsWatched);
  const markAsFinished = useVideoFinishedStore((s) => s.markAsFinished);

  const isFavorite = useVideoFavoriteFoldersStore((s) =>
    s.isVideoFavorited(video.id),
  );

  const [hasVideoError, setHasVideoError] = useState(false);

  // Lazy-Mount: Player erst nach Tap montieren – spart RAM/CPU bei langen Listen.
  const [playerMounted, setPlayerMounted] = useState(false);

  useEffect(() => {
    setHasVideoError(false);
    setPlayerMounted(false);
  }, [usesInlinePlayer, videoId]);

  // Wenn diese Karte das "aktive" Video ist, montieren.
  useEffect(() => {
    if (usesInlinePlayer && isPlaying) setPlayerMounted(true);
  }, [isPlaying, usesInlinePlayer]);

  const onPressToggleFavorite = useCallback(() => {
    router.push({
      pathname: "/favorite-folders",
      params: { videoId: String(video.id) },
    });
  }, [video.id]);

  const onPressToggleWatched = useCallback(() => {
    const willBeWatched = !isWatched;

    toggleWatched(video.id, lang);

    Toast.show({
      type: willBeWatched ? "success" : "info",
      text1: willBeWatched ? t("marked_as_watched") : t("unmarked_as_watched"),
      visibilityTime: 2000,
      position: "top",
    });
  }, [isWatched, lang, video.id, t, toggleWatched]);

  const onPressOpenVideo = useCallback(() => {
    if (usesInlinePlayer) {
      setPlayerMounted(true);
      onRequestPlay?.();
      return;
    }

    router.push({
      pathname: "/video/[id]",
      params: { id: String(video.id) },
    });
  }, [onRequestPlay, usesInlinePlayer, video.id]);

  const onStateChange = useCallback(
    (state: string) => {
      if (state === "playing") {
        onRequestPlay?.();
        return;
      }

      if (state === "paused" || state === "unstarted") {
        onStopPlaying?.();
        return;
      }

      if (state === "ended") {
        onStopPlaying?.();

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
      }
    },
    [
      isFinished,
      isWatched,
      lang,
      markAsFinished,
      markAsWatched,
      onRequestPlay,
      onStopPlaying,
      video.id,
      t,
    ],
  );

  const thumbnailUrl = videoId
    ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
    : null;

  const thumbnailImageSource = useMemo(() => {
    if (!thumbnailUrl || !videoId) return null;

    return {
      uri: thumbnailUrl,
      cacheKey: `youtube-thumbnail:${videoId}:hqdefault`,
    };
  }, [thumbnailUrl, videoId]);

  const playIconSize = IS_WEB ? 52 : 70;
  const favoriteIconSize = IS_WEB ? 24 : 30;
  const statusIconSize = IS_WEB ? 15 : 18;

  return (
    <View
      {...cardHoverProps}
      style={[
        styles.cardShadow,
        IS_WEB && styles.webCardShadow,
        IS_WEB && webTransition("transform, box-shadow", 240),
        IS_WEB && styles.webCardMotion,
        IS_WEB && cardHovered && styles.webCardShadowHover,
        { width },
      ]}
    >
      <View
        style={[
          styles.card,
          IS_WEB && styles.webCard,
          IS_WEB && webTransition("border-color", 200, "ease"),
          { backgroundColor: colors.contrast },
          IS_WEB && { borderColor: webBorderColor },
        ]}
      >
        {videoId && !hasVideoError ? (
          usesInlinePlayer && playerMounted ? (
            <View style={[styles.playerClip, { height: playerHeight }]}>
              <YoutubeVideoPlayer
                key={playerKey}
                height={playerHeight}
                width={width}
                play={isPlaying}
                videoId={videoId}
                initialPlayerParams={initialPlayerParams}
                onChangeState={onStateChange}
                onError={() => setHasVideoError(true)}
              />
            </View>
          ) : (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t("playVideo")}
              activeOpacity={0.9}
              onPress={onPressOpenVideo}
              style={[
                styles.playerClip,
                { height: playerHeight },
                isWatched && { opacity: 0.7 },
              ]}
            >
              {thumbnailImageSource ? (
                <Image
                  source={thumbnailImageSource}
                  style={[
                    StyleSheet.absoluteFill,
                    IS_WEB && webTransition("transform", 420, "ease"),
                    IS_WEB && cardHovered && styles.webThumbnailZoom,
                  ]}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  priority="normal"
                  transition={150}
                  recyclingKey={thumbnailImageSource.cacheKey}
                />
              ) : (
                <LinearGradient
                  style={StyleSheet.absoluteFill}
                  colors={effectiveGradient as any}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
              )}

              <View style={styles.thumbnailOverlay} />

              <View style={styles.playButtonWrapper}>
                {IS_WEB ? (
                  <View
                    style={[
                      styles.webPlayButton,
                      webTransition(
                        "transform, background-color, border-color",
                        200,
                        "ease",
                      ),
                      cardHovered && styles.webPlayButtonHover,
                    ]}
                  >
                    <Ionicons
                      name="play"
                      size={22}
                      color="#FFFFFF"
                      style={styles.webPlayIcon}
                    />
                  </View>
                ) : (
                  <Ionicons
                    name="play-circle"
                    size={playIconSize}
                    color="#FFFFFF"
                  />
                )}
              </View>
            </TouchableOpacity>
          )
        ) : (
          <View style={[styles.videoFallback, { height: playerHeight }]}>
            {thumbnailImageSource ? (
              <>
                <Image
                  source={thumbnailImageSource}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  recyclingKey={thumbnailImageSource.cacheKey}
                />

                <LinearGradient
                  colors={[
                    "rgba(0,0,0,0.15)",
                    "rgba(0,0,0,0.45)",
                    "rgba(0,0,0,0.85)",
                  ]}
                  locations={[0, 0.55, 1]}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                />
              </>
            ) : (
              <LinearGradient
                style={StyleSheet.absoluteFill}
                colors={effectiveGradient as any}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
            )}

            <View style={styles.fallbackContent}>
              <Ionicons name="logo-youtube" size={34} color="#FFFFFF" />

              <Text style={styles.fallbackText}>{t("videoUnavailable")}</Text>
            </View>
          </View>
        )}

        <View style={[styles.content, IS_WEB && styles.webContent]}>
          <View
            style={[
              styles.titleRow,
              IS_WEB && styles.webTitleRow,
              { flexDirection: rtl ? "row-reverse" : "row" },
              isWatched && { opacity: 0.7 },
            ]}
          >
            <TouchableOpacity
              accessibilityRole={usesInlinePlayer ? undefined : "button"}
              activeOpacity={0.82}
              disabled={usesInlinePlayer}
              onPress={onPressOpenVideo}
              style={styles.titleContainer}
            >
              <View
                style={[
                  styles.titleLine,
                  { flexDirection: rtl ? "row-reverse" : "row" },
                ]}
              >
                <Text
                  style={[
                    styles.cardTitle,
                    IS_WEB && styles.webCardTitle,
                    {
                      color: colors.text,
                      textAlign: rtl ? "right" : "left",
                      writingDirection: rtl ? "rtl" : "ltr",
                      flex: 1,
                    },
                  ]}
                  numberOfLines={2}
                  ellipsizeMode="tail"
                >
                  {video.title}
                </Text>
              </View>

              {authorName && (
                <View
                  style={[
                    styles.authorRow,
                    { flexDirection: rtl ? "row-reverse" : "row" },
                  ]}
                >
                  <Text
                    style={[
                      styles.authorName,
                      IS_WEB && styles.webAuthorName,
                      {
                        color: colors.text,
                        textAlign: rtl ? "right" : "left",
                        writingDirection: rtl ? "rtl" : "ltr",
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {authorName}
                  </Text>
                </View>
              )}

              <Text
                style={[
                  styles.createdAt,
                  IS_WEB && styles.webCreatedAt,
                  {
                    color: colors.tabIconDefault,
                    textAlign: rtl ? "right" : "left",
                    writingDirection: rtl ? "rtl" : "ltr",
                  },
                ]}
                numberOfLines={1}
              >
                {formattedDate}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onPressToggleFavorite}
              style={[styles.iconButton, IS_WEB && styles.webIconButton]}
              activeOpacity={0.7}
              hitSlop={8}
            >
              <Ionicons
                name={isFavorite ? "heart" : "heart-outline"}
                size={favoriteIconSize}
                color={isFavorite ? Colors[colorScheme].error : colors.text}
              />
            </TouchableOpacity>
          </View>

          <View
            style={[
              styles.actionsRow,
              { flexDirection: rtl ? "row-reverse" : "row" },
            ]}
          >
            <TouchableOpacity
              {...watchedHoverProps}
              onPress={onPressToggleWatched}
              style={[
                styles.statusButton,
                IS_WEB && styles.webStatusButton,
                IS_WEB &&
                  webTransition("background-color, border-color", 160, "ease"),
                {
                  backgroundColor: isWatched
                    ? Colors.universal.primary
                    : colors.background,
                },
                IS_WEB && { borderColor: webBorderColor },
                IS_WEB &&
                  watchedHovered && {
                    backgroundColor: isWatched
                      ? Colors.universal.third
                      : colors.backgroundElement,
                    borderColor: Colors.universal.primary,
                  },
              ]}
              activeOpacity={0.75}
            >
              <Ionicons
                name={isWatched ? "eye" : "eye-outline"}
                size={statusIconSize}
                color={isWatched ? "#FFFFFF" : colors.text}
              />

              <Text
                numberOfLines={1}
                style={[
                  styles.statusButtonText,
                  IS_WEB && styles.webStatusButtonText,
                  { color: isWatched ? "#FFFFFF" : colors.text },
                ]}
              >
                {t("watched")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardShadow: {
    borderRadius: CARD_RADIUS,
    // shadowColor: "#000",
    // shadowOffset: { width: 0, height: 2},
    // shadowOpacity: 0.16,
    // shadowRadius: 5,
    // elevation: 3,
    // overflow: "visible",
  },
  webCardShadow: {
    borderRadius: WEB_CARD_RADIUS,
    elevation: 1,
  },
  webCardMotion: {
    transform: [{ translateY: 0 }],
    cursor: "pointer",
  },
  webCardShadowHover: {
    shadowColor: "#0b1220",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    transform: [{ translateY: -6 }],
  },

  card: {
    width: "100%",
    borderRadius: CARD_RADIUS,
    overflow: "hidden",
    borderWidth: 0.6,
  },
  webCard: {
    borderRadius: WEB_CARD_RADIUS,
    borderWidth: 1,
  },

  playerClip: {
    width: "100%",
    backgroundColor: "#000",
    overflow: "hidden",
  },

  thumbnailOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.25)",
  },

  playButtonWrapper: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },

  webThumbnailZoom: {
    transform: [{ scale: 1.07 }],
  },

  webPlayButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(12,15,20,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    transform: [{ scale: 1 }],
  },
  webPlayButtonHover: {
    backgroundColor: Colors.universal.primary,
    borderColor: Colors.universal.primary,
    transform: [{ scale: 1.09 }],
  },
  webPlayIcon: {
    marginLeft: 3,
  },

  videoFallback: {
    width: "100%",
    backgroundColor: "#1a1a1a",
    overflow: "hidden",
  },

  fallbackContent: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
  },

  fallbackText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
  },

  content: {
    padding: 14,
    gap: 12,
  },
  webContent: {
    padding: 12,
    gap: 9,
  },

  titleRow: {
    alignItems: "flex-start",
    gap: 10,
  },
  webTitleRow: {
    gap: 8,
  },

  titleContainer: {
    flex: 1,
    gap: 5,
  },

  titleLine: {
    alignItems: "center",
    gap: 6,
  },

  watchedBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },

  cardTitle: {
    minHeight: 42,
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 21,
  },
  webCardTitle: {
    minHeight: 36,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
    letterSpacing: -0.1,
  },

  createdAt: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  webCreatedAt: {
    fontSize: 10,
    letterSpacing: 0.6,
  },

  authorRow: {
    alignItems: "center",
    marginTop: 2,
  },
  authorName: {
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
  },
  webAuthorName: {
    fontSize: 11,
  },

  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  webIconButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },

  actionsRow: {
    gap: 10,
  },

  statusButton: {
    flex: 1,
    minHeight: 38,
    borderRadius: STATUS_BUTTON_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
    overflow: "hidden",
  },
  webStatusButton: {
    minHeight: 32,
    borderRadius: STATUS_BUTTON_RADIUS,
    paddingHorizontal: 8,
    gap: 5,
  },

  statusButtonText: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: "800",
  },
  webStatusButtonText: {
    fontSize: 11,
  },
});
