// Sprache
export type LanguageCode = "de" | "ar" | "en";

export type LanguageContextType = {
  lang: LanguageCode;
  setAppLanguage: (lng: LanguageCode) => Promise<void>;
  ready: boolean;
  rtl: boolean;
  hasStoredLanguage: boolean;
};

// Layout-Sizes (für LanguageSwitcher)
export type SizesType = {
  fontSize: number;
  badgeSize: number;
  iconSize: number;
  imageSize: number;
  gap: number;
  emptyIconSize: number;
  emptyTextSize: number;
  emptyGap: number;
  previewSizes: number;
  previewSizesPaddingHorizontal: number;
  isTablet: boolean;
  isLarge: boolean;
  isMedium: boolean;
  isSmall: boolean;
  fontsizeHomeHeaders: number;
  fontsizeHomeShowAll: number;
};

// Gradients
export type UseGradientOptionsType = {
  customGradients?: string[][];
  defaultIndex?: number;
};

// Videos
export type TopicCategoryType = {
  id: number;
  name: string;
  sort_order_categories: number | null;
  color_hex_categories: string | null;
};

export type TopicSubcategoryType = {
  id: number;
  name: string;
  sort_order_subcategories: number | null;
  color_hex_subcategories: string | null;
};

export type TopicType = {
  key: string;
  id: number;
  name: string;
  category_id: number | null;
  subcategory_id: number | null;
  sort_order: number | null;
  color_hex?: string | null;
  category?: TopicCategoryType | null;
};

export type VideoType = {
  id: number;
  title: string;
  youtube_url: string | null;
  start_time: number | null;
  end_time: number | null;
  language_code: string | null;
  category: string | null;
  subcategory: string | null;
  topics?: TopicType[];
  author_name: string | null;
  created_at: string;
};

export type VideoGridCardType = {
  video: VideoType;
  width: number;
  rtl: boolean;
  lang: string;
  /**
   * Optional. Wenn weggelassen, wählt VideoGridCard einen deterministischen
   * Gradient anhand der Video-ID.
   */
  gradientColors?: readonly [string, string, ...string[]] | string[];
  playbackMode?: "navigate" | "inline";
  isPlaying?: boolean;
  onRequestPlay?: () => void;
  onStopPlaying?: () => void;
};

// YouTube-Player
export type YoutubePlayerState =
  | "unstarted"
  | "ended"
  | "playing"
  | "paused"
  | "buffering"
  | "video cued";

export type YoutubeVideoPlayerParams = {
  start?: number;
  end?: number;
};

export type YoutubeVideoPlayerProps = {
  videoId: string;
  width: number;
  height: number;
  play: boolean;
  autoFullscreen?: boolean;
  initialPlayerParams?: YoutubeVideoPlayerParams;
  onChangeState?: (state: YoutubePlayerState | string) => void;
  onError?: () => void;
  onReady?: () => void;
};

export type YoutubeVideoPlayerRef = {
  getCurrentTime: () => Promise<number>;
  requestFullscreen: () => Promise<boolean>;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
};
