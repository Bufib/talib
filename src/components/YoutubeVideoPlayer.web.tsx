import {
  YoutubePlayerState,
  YoutubeVideoPlayerProps,
  type YoutubeVideoPlayerRef,
} from "@/constants/Types";
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import { View, type ViewStyle } from "react-native";


type YoutubeApiPlayer = {
  getCurrentTime?: () => number;
  getIframe?: () => HTMLIFrameElement;
  playVideo?: () => void;
  pauseVideo?: () => void;
  seekTo?: (seconds: number, allowSeekAhead: boolean) => void;
  destroy?: () => void;
};

type YoutubePlayerVars = {
  autoplay: number;
  controls: number;
  enablejsapi: number;
  end?: number;
  origin?: string;
  playsinline: number;
  rel: number;
  start?: number;
};

type FullscreenElement = HTMLElement & {
  mozRequestFullScreen?: () => Promise<void> | void;
  msRequestFullscreen?: () => Promise<void> | void;
  webkitRequestFullscreen?: () => Promise<void> | void;
};

declare global {
  interface Window {
    YT?: {
      Player: new (
        element: HTMLElement,
        options: {
          height?: number | string;
          host?: string;
          playerVars?: YoutubePlayerVars;
          videoId?: string;
          width?: number | string;
          events?: {
            onReady?: () => void;
            onStateChange?: (event: { data: number }) => void;
            onError?: () => void;
          };
        },
      ) => YoutubeApiPlayer;
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let youtubeApiPromise: Promise<void> | null = null;

function loadYoutubeApi() {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  if (window.YT?.Player) {
    return Promise.resolve();
  }

  if (!youtubeApiPromise) {
    youtubeApiPromise = new Promise((resolve) => {
      const previousCallback = window.onYouTubeIframeAPIReady;

      window.onYouTubeIframeAPIReady = () => {
        previousCallback?.();
        resolve();
      };

      if (!document.getElementById("youtube-iframe-api")) {
        const script = document.createElement("script");
        script.id = "youtube-iframe-api";
        script.src = "https://www.youtube.com/iframe_api";
        document.body.appendChild(script);
      }
    });
  }

  return youtubeApiPromise;
}

function mapPlayerState(state: number): YoutubePlayerState | string {
  switch (state) {
    case -1:
      return "unstarted";
    case 0:
      return "ended";
    case 1:
      return "playing";
    case 2:
      return "paused";
    case 3:
      return "buffering";
    case 5:
      return "video cued";
    default:
      return String(state);
  }
}

const YoutubeVideoPlayer = forwardRef<
  YoutubeVideoPlayerRef,
  YoutubeVideoPlayerProps
>(function YoutubeVideoPlayer(
  {
    videoId,
    width,
    height,
    play,
    autoFullscreen,
    initialPlayerParams,
    onChangeState,
    onError,
    onReady,
  },
  ref,
) {
  const fullscreenRef = useRef<HTMLDivElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YoutubeApiPlayer | null>(null);
  const playRef = useRef(play);
  // Callbacks/Props in Refs halten, damit der Player-Effekt nur von videoId
  // und playerVars abhaengt und das iframe nicht bei jeder neuen
  // Callback-Identitaet komplett neu aufgebaut wird.
  const onChangeStateRef = useRef(onChangeState);
  const onErrorRef = useRef(onError);
  const onReadyRef = useRef(onReady);
  const autoFullscreenRef = useRef(autoFullscreen);

  const requestFullscreen = useCallback(async () => {
    const target = fullscreenRef.current as FullscreenElement | null;
    if (!target || typeof document === "undefined") return false;

    const fullscreenDocument = document as Document & {
      mozFullScreenElement?: Element | null;
      msFullscreenElement?: Element | null;
      webkitFullscreenElement?: Element | null;
    };

    if (
      document.fullscreenElement ||
      fullscreenDocument.webkitFullscreenElement ||
      fullscreenDocument.mozFullScreenElement ||
      fullscreenDocument.msFullscreenElement
    ) {
      return true;
    }

    const request =
      target.requestFullscreen ??
      target.webkitRequestFullscreen ??
      target.mozRequestFullScreen ??
      target.msRequestFullscreen;

    if (!request) return false;

    try {
      await request.call(target);
      return true;
    } catch {
      return false;
    }
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      getCurrentTime: async () => {
        return playerRef.current?.getCurrentTime?.() ?? 0;
      },
      requestFullscreen,
      seekTo: (seconds, allowSeekAhead) => {
        playerRef.current?.seekTo?.(seconds, allowSeekAhead);
      },
    }),
    [requestFullscreen],
  );

  useEffect(() => {
    playRef.current = play;
  }, [play]);

  useEffect(() => {
    onChangeStateRef.current = onChangeState;
    onErrorRef.current = onError;
    onReadyRef.current = onReady;
    autoFullscreenRef.current = autoFullscreen;
  });

  const playerVars = useMemo<YoutubePlayerVars>(() => {
    return {
      autoplay: playRef.current ? 1 : 0,
      controls: 1,
      enablejsapi: 1,
      ...(initialPlayerParams?.end !== undefined
        ? { end: initialPlayerParams.end }
        : {}),
      ...(typeof window !== "undefined"
        ? { origin: window.location.origin }
        : {}),
      playsinline: 1,
      rel: 0,
      ...(initialPlayerParams?.start !== undefined
        ? { start: initialPlayerParams.start }
        : {}),
    };
  }, [initialPlayerParams?.end, initialPlayerParams?.start]);

  const configureIframe = useCallback(() => {
    const iframe =
      playerRef.current?.getIframe?.() ?? hostRef.current?.querySelector("iframe");

    if (!iframe) return;

    iframe.allow =
      "accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; gyroscope; picture-in-picture; web-share";
    iframe.allowFullscreen = true;
    iframe.style.border = "0";
    iframe.style.display = "block";
    iframe.style.height = "100%";
    iframe.style.width = "100%";
  }, []);

  useEffect(() => {
    let cancelled = false;
    const host = hostRef.current;

    if (!host) return;

    playerRef.current?.destroy?.();
    playerRef.current = null;
    host.replaceChildren();

    const placeholder = document.createElement("div");
    placeholder.style.width = "100%";
    placeholder.style.height = "100%";
    host.appendChild(placeholder);

    loadYoutubeApi().then(() => {
      if (cancelled || !window.YT?.Player) return;

      playerRef.current = new window.YT.Player(placeholder, {
        height: "100%",
        host: "https://www.youtube-nocookie.com",
        playerVars,
        videoId,
        width: "100%",
        events: {
          onReady: () => {
            configureIframe();
            onReadyRef.current?.();
            if (playRef.current) {
              playerRef.current?.playVideo?.();
            }
            if (autoFullscreenRef.current) {
              void requestFullscreen();
            }
          },
          onStateChange: (event) => {
            onChangeStateRef.current?.(mapPlayerState(event.data));
          },
          onError: () => {
            onErrorRef.current?.();
          },
        },
      });
    });

    return () => {
      cancelled = true;
      playerRef.current?.destroy?.();
      playerRef.current = null;
      host.replaceChildren();
    };
  }, [configureIframe, playerVars, requestFullscreen, videoId]);

  useEffect(() => {
    if (play) {
      playerRef.current?.playVideo?.();
    } else {
      playerRef.current?.pauseVideo?.();
    }
  }, [play]);

  return (
    <View style={[containerStyle, { width, height }]}>
      <div ref={fullscreenRef} style={fullscreenStyle}>
        <div
          ref={hostRef}
          aria-label={`YouTube video ${videoId}`}
          style={hostStyle}
        />
      </div>
    </View>
  );
});

export default YoutubeVideoPlayer;

const containerStyle: ViewStyle = {
  backgroundColor: "#000",
  overflow: "hidden",
};

const fullscreenStyle: React.CSSProperties = {
  backgroundColor: "#000",
  height: "100%",
  width: "100%",
};

const hostStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
};
