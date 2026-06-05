import {
  YoutubeVideoPlayerProps,
  type YoutubeVideoPlayerRef,
} from "@/constants/Types";
import React, { forwardRef, useImperativeHandle, useRef } from "react";
import YoutubePlayer, {
  type YoutubeIframeRef,
} from "react-native-youtube-iframe";

const FULL_HEIGHT_PLAYER_SCRIPT = `
  (function () {
    var style = document.getElementById('shiacast-full-height-player-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'shiacast-full-height-player-style';
      style.textContent = [
        'html, body { width: 100%; height: 100%; margin: 0; background: #000; overflow: hidden; }',
        '.container { width: 100% !important; height: 100% !important; padding-bottom: 0 !important; background: #000; }',
        '.video, #player, iframe { width: 100% !important; height: 100% !important; }'
      ].join('\\n');
      document.head.appendChild(style);
    }
  })();
  true;
`;

const YoutubeVideoPlayer = forwardRef<
  YoutubeVideoPlayerRef,
  YoutubeVideoPlayerProps
>(function YoutubeVideoPlayer(
  {
    videoId,
    width,
    height,
    play,
    initialPlayerParams,
    onChangeState,
    onError,
    onReady,
  },
  ref,
) {
  const playerRef = useRef<YoutubeIframeRef | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      getCurrentTime: async () => {
        return playerRef.current?.getCurrentTime() ?? 0;
      },
      requestFullscreen: async () => false,
      seekTo: (seconds, allowSeekAhead) => {
        playerRef.current?.seekTo(seconds, allowSeekAhead);
      },
    }),
    [],
  );

  return (
    <YoutubePlayer
      ref={playerRef}
      height={height}
      width={width}
      play={play}
      videoId={videoId}
      initialPlayerParams={initialPlayerParams}
      onChangeState={onChangeState}
      i18nIsDynamicList
      baseUrlOverride="https://www.youtube-nocookie.com"
      onError={onError}
      onReady={onReady}
      webViewStyle={{ backgroundColor: "#000" }}
      webViewProps={{
        injectedJavaScriptBeforeContentLoaded: FULL_HEIGHT_PLAYER_SCRIPT,
        injectedJavaScript: FULL_HEIGHT_PLAYER_SCRIPT,
      }}
    />
  );
});

export default YoutubeVideoPlayer;
