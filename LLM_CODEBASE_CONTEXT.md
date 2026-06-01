LLM CODEBASE CONTEXT FOR SHIACAST
=================================

Purpose of this file
--------------------
This file is meant as a compact but high-signal briefing for another LLM that
needs to understand and safely modify this project. It describes the current
architecture, data model, routes, UI flows, stores, backend expectations, and
important project conventions.

Project summary
---------------
Shiacast is an Expo / React Native app for browsing curated Islamic YouTube
videos. The app supports German, English, and Arabic, including RTL layout for
Arabic. Users can browse videos by topic rows, search and filter videos, open a
dedicated video player page, mark videos as watched/finished, and save videos
into local favorite folders.

The project was previously closer to a "podcast" naming model, but current code
should use "video" terminology everywhere. Do not reintroduce "podcast" names
for routes, variables, folders, or UI concepts.

Tech stack
----------
- Expo SDK 55
- React 19 / React Native 0.83
- Expo Router with typed routes enabled
- expo-router unstable NativeTabs for bottom tabs
- React Query for Supabase server data
- Zustand for local app/user state
- AsyncStorage for persisted local Zustand stores and small local caches
- Supabase JS client for database, realtime, and push token storage
- react-native-youtube-iframe on native
- Custom YouTube iframe implementation on web
- i18next / react-i18next for translations
- expo-image for thumbnails
- expo-notifications for push notifications

Important commands
------------------
- Install dependencies: npm install
- Start app: npm run start or npx expo start
- Start web: npm run web
- Lint: npm run lint
- Type check: npx tsc --noEmit
- Whitespace check: git diff --check

Project layout
--------------
Important top-level paths:

- src/app/
  Expo Router routes. The main root stack is in src/app/_layout.tsx.

- src/app/(tabs)/
  Main tab group. Contains home, favorites, and settings tabs.

- src/app/video/[id].tsx
  Dedicated video detail/player screen.

- src/components/
  Shared UI components and feature components.

- src/hooks/
  React Query hooks, persisted watched/finished stores, notification logic,
  and UI helpers.

- stores/
  Zustand stores that are shared across features.

- contexts/
  React context for app language and RTL state.

- utils/
  Supabase client, YouTube parsing, topic parsing, formatting, i18n setup, and
  external URL handling.

- locales/
  Translation objects for de, en, and ar.

- supabase/migrations/
  SQL helper migration(s), especially RPCs for video filters/languages and the
  normalized video schema.

Routing and navigation
----------------------
Root layout:
- File: src/app/_layout.tsx
- Wraps the app in LanguageProvider, GestureHandlerRootView, ThemeProvider,
  ErrorBoundary, QueryClientProvider, SupabaseRealtimeProvider, and Toast.
- Uses an Expo Router Stack with these important screens:
  - index
  - (tabs)
  - video/[id]
  - favorite-folders
  - video-filters
  - +not-found
- favorite-folders and video-filters are presented as formSheet bottom sheets
  using Expo Router screen options. There is no gorhom bottom sheet dependency
  for these flows.

Tabs:
- File: src/components/app-tabs.tsx
- Uses NativeTabs from expo-router/unstable-native-tabs.
- Tab names:
  - home
  - favorites
  - settings

Main routes:
- src/app/(tabs)/home/index.tsx
  Main video browsing screen.

- src/app/(tabs)/favorites/index.tsx
  Favorites tab entry, renders RenderFavoriteVideos.

- src/app/(tabs)/settings/index.tsx
  Settings screen.

- src/app/video/[id].tsx
  Video player page. Header contains back button, title, optional author, and
  favorite heart. Player fills the remaining available space.

- src/app/video-filters.tsx
  Sheet route that renders FilterModal.

- src/app/favorite-folders.tsx
  Sheet route that renders VideoFavoriteFolderModal for a videoId param.

Data model and Supabase
-----------------------
The current app expects a normalized video schema centered on public.videos.

Expected videos fields in app TypeScript:
- id: number
- title: string
- youtube_url: string | null
- start_time: number | null
- end_time: number | null
- language_code: string | null
- video_topic: string | null
- author_name: string | null
- created_at: string

Relevant SQL schema context:
- public.videos has id, title, youtube_url, created_at, language_code,
  video_topic, author_name, start_time, end_time.
- public.videos.author_name references public.authors.author_name.
- public.authors currently matters for author names, but the app no longer uses
  author images. The migration drops authors.image_url.
- The app derives all visual thumbnails from YouTube IDs, not from Supabase
  image_url columns.

Migration:
- File: supabase/migrations/20260521_videos_authors_fk.sql
- Drops authors.image_url and authors_image_filename_key.
- Adds/updates helper RPCs:
  - public.video_distinct_languages()
  - public.video_distinct_topics(p_lang text default null)
  - public.video_distinct_authors(p_lang text default null)

Supabase client:
- File: utils/supabase.ts
- Reads supabaseUrl and supabasePublishableKey from app.json extra config.
- Uses AsyncStorage auth storage on native.
- Starts/stops Supabase auth auto-refresh based on AppState on native.

Server data hooks
-----------------
useVideoList:
- File: src/hooks/useVideoList.ts
- Infinite React Query for the home video list.
- Query key starts with ["videos", "grid", ...].
- Reads from public.videos with select("*").
- Orders by created_at desc and id desc.
- Server-side filters:
  - language_code eq language, when language is not null
  - author_name eq selectedAuthor
  - title ilike search query
- Topic filtering is client-side using matchesTopic because video_topic may
  contain comma-separated or JSON-like values.
- Dedupe by video id across pages.
- Uses long stale/gc times and disables refetch on window focus.

useVideoById:
- File: src/hooks/useVideoById.ts
- React Query for a single video by id from public.videos.
- Query key ["videos", "by-id", id].

useVideosByIdsForFavorites:
- File: src/hooks/useVideosByIdsForFavorites.ts
- Fetches videos by local favorite ids.
- Optional language filter.
- Keeps same created_at/id descending order.

useVideoFilters:
- File: src/hooks/useVideoFilters.ts
- Loads language/topic/author metadata for FilterModal.
- Selects language_code, video_topic and author_name from public.videos.
- Computes dependent facets client-side: available topics are constrained by
  language/author, authors by language/topic and languages by topic/author.

useVideoLanguages:
- File: src/hooks/useVideoLanguages.ts
- Loads distinct language codes via RPC video_distinct_languages, with SELECT
  fallback if RPC is missing.

Realtime data sync
------------------
File: src/components/SupabaseRealtimeProvider.tsx

This provider subscribes to Supabase realtime:
- public.videos changes
- public.authors changes
- public.paypal changes

On videos/authors changes:
- Debounces invalidation for 300ms.
- Invalidates React Query keys:
  - ["videos"]
  - ["video_filter_pairs"]
  - ["video_languages"]
- Increments dataVersionStore.videoVersion.
- If a DELETE event was seen, it redirects to /home after invalidation.

On paypal changes:
- Stores/removes a paypal link in AsyncStorage under key "paypal".
- Settings screen reads this cached paypal link.

Local persisted state
---------------------
Favorite folders:
- File: stores/videoFavoriteFoldersStore.ts
- Zustand persist store using AsyncStorage key "video-favorite-folders".
- Shape:
  - folders: { id, name, color, createdAt }[]
  - favorites: { videoId, folderIds, createdAt }[]
- setVideoFolders(videoId, folderIds) is the core API.
- A video is favorited when it has at least one folder id.

Watched state:
- File: src/hooks/useVideoWatchedStore.ts
- Zustand persist store using AsyncStorage key "video-watched".
- Key format is "lang:id" when lang is provided.
- APIs: markAsWatched, unmarkAsWatched, toggleWatched, isWatched,
  getWatchedAt.

Finished state:
- File: src/hooks/useVideoFinishedStore.ts
- Zustand persist store using AsyncStorage key "video-finished".
- Same lang:id key pattern as watched.
- Used when the YouTube player reports "ended".

Filter state:
- File: stores/videoFilterStore.ts
- Non-persisted Zustand store for active home filters.
- Tracks:
  - defaultLanguage
  - selectedTopic
  - selectedAuthor
  - selectedLanguage
- setDefaultLanguage synchronizes selectedLanguage with app language when the
  user has not intentionally selected another language.
- setSelectedLanguage preserves topic and author because FilterModal only
  exposes compatible language options.
- resetFilters(defaultLanguage) clears topic/author and returns language to the
  default app language.

Notification state:
- File: stores/notificationStore.ts
- Persisted Zustand store using AsyncStorage key "notification-storage".
- Tracks in-app notification opt-in and OS permission status.
- iOS default opt-in is false; Android default is true.
- toggleGetNotifications requests permission if needed.

Other stores:
- stores/fontSizeStore.ts persists a fontSize setting under "font-settings".
- stores/useAppReviewStore.ts persists app review timing under
  "app-review-storage".
- stores/dataVersionStore.ts has counters for video and videoFavorites
  versions. Current realtime provider increments videoVersion.

Video browsing flow
-------------------
Home screen:
- File: src/app/(tabs)/home/index.tsx
- Uses useVideoList with language/topic/author/search state.
- Search input is debounced by 350ms.
- Search is wrapped in KeyboardAvoidingView on native when search is visible.
- Active filters are shown as chips below the header.
- Filter button opens /video-filters.
- Search or any active filter switches VideoGridList to layout="grid" and
  gridColumns={1}. This means filtered/search results are shown in a single
  vertical column.
- With no active search/filter, VideoGridList uses layout="topicRows".

VideoGridList:
- File: src/components/VideoGridList.tsx
- Props:
  - videos
  - layout: "topicRows" | "grid"
  - gridColumns
  - ListHeaderComponent, ListEmptyComponent
  - refreshing, onRefresh
  - isLoadingMore, onEndReached
- topicRows mode:
  - Groups videos by parsed video_topic.
  - Each topic is a vertical section with a horizontal FlatList of cards.
  - Uncategorized videos are grouped under translated "uncategorizedTopic".
  - Initially sorts topic sections alphabetically, uncategorized last.
  - Keeps visible topic sections stable during pagination and appends newly
    discovered topics at the bottom so the vertical list does not jump.
- grid mode:
  - Vertical FlatList.
  - Can use one or more columns.
  - Favorites and filtered/search home views use one column.

VideoGridCard:
- File: src/components/VideoGridCard.tsx
- Used in lists and can still support inline playback mode, but default is
  playbackMode="navigate".
- Default list behavior:
  - Shows YouTube thumbnail, play icon, title, author name, date, favorite
    heart, and watched button.
  - Does not mount YouTube player in lists.
  - Tapping thumbnail or title navigates to /video/[id].
- Thumbnail source:
  - Derived from getYoutubeVideoId(video.youtube_url)
  - URL: https://i.ytimg.com/vi/{videoId}/hqdefault.jpg
  - expo-image cachePolicy="memory-disk"
- If no thumbnail/video id, it uses a deterministic gradient fallback.
- Favorite heart opens /favorite-folders sheet.
- Watched button toggles local watched state and shows a toast.
- If inline mode is used, ended playback marks watched and finished.

Video detail/player flow
------------------------
File: src/app/video/[id].tsx

Current design:
- Header contains:
  - back button
  - video title, two lines max
  - optional author name
  - favorite heart button
- Player area fills the remaining screen space.
- Uses onLayout to measure the player frame, then passes exact width/height to
  YoutubeVideoPlayer.
- Parses YouTube video id from youtube_url.
- Parses optional start_time and end_time into initialPlayerParams.
- On player state "playing": set isPlaying true.
- On "paused": set isPlaying false.
- On "ended":
  - set isPlaying false
  - mark video watched if not already watched
  - mark video finished if not already finished
  - show "marked_as_finished" toast
- Favorite heart opens /favorite-folders with videoId param.

YouTube helpers and players
---------------------------
utils/youtube.ts:
- getYoutubeVideoId accepts raw 11-char id or common YouTube URLs:
  - youtu.be
  - youtube.com/watch?v=
  - embed
  - shorts
  - live
- parseYoutubeTime accepts:
  - numbers
  - numeric strings
  - HH:MM:SS / MM:SS forms
  - compact forms like 1h2m3s

src/components/YoutubeVideoPlayer.tsx:
- Native implementation using react-native-youtube-iframe.

src/components/YoutubeVideoPlayer.web.tsx:
- Web implementation using the YouTube iframe API.
- Dynamically loads https://www.youtube.com/iframe_api once.
- Maps numeric YT states to the app's string state names.
- Builds embed URL with enablejsapi, playsinline, rel=0, controls=1, origin,
  and optional start/end params.

Favorites flow
--------------
Favorites tab:
- File: src/components/RenderFavoriteVideos.tsx
- Reads local favorite folder data from videoFavoriteFoldersStore.
- Can filter favorites by selected folder.
- Fetches matching video records via useVideosByIdsForFavorites.
- Renders VideoGridList layout="grid" gridColumns={1}.
- Folder chips are horizontal; edit mode lets the user delete folders.

Favorite folder sheet:
- Route file: src/app/favorite-folders.tsx
- Component: src/components/VideoFavoriteFolderModal.tsx
- Receives videoId from route params.
- Lets user select/unselect folders for that video.
- Lets user create a new folder with a color.
- Writes immediately through setVideoFolders.
- Dismisses via router.dismiss().

Filter flow
-----------
Filter sheet route:
- File: src/app/video-filters.tsx
- Renders FilterModal.

Filter UI:
- File: src/components/FilterModal.tsx
- Reads filter state from videoFilterStore.
- Reads language from LanguageContext.
- Loads available languages via useVideoLanguages.
- Loads available topics/authors via useVideoFilters.
- Lets user select:
  - topic
  - author
  - language
- "All languages" maps to selectedLanguage null, which means no language
  filter in useVideoList.
- Reset returns to app language and clears topic/author.

Language and i18n
-----------------
Language context:
- File: contexts/LanguageContext.tsx
- Supported app languages: de, en, ar.
- Default language: de.
- Persists selected language in AsyncStorage keys:
  - language
  - userPickedLanguage
- rtl is true only for ar.
- hasStoredLanguage controls whether the language selection gate should show.

i18n:
- File: utils/i18n.ts
- Uses expo-localization plus AsyncStorage cache key "i18nextLng".
- Loads locale objects from locales/de.ts, locales/en.ts, locales/ar.ts.
- fallbackLng is de.

App gate:
- File: src/app/_layout.tsx
- Before the main app is available, it waits for language context and persisted
  stores to hydrate.
- If no stored language exists, it shows LanguageSelection.
- On native, if intro video has not played, it shows IntroVideo.
- Web skips the intro gate.

Settings flow
-------------
File: src/app/(tabs)/settings/index.tsx

Settings includes:
- Dark mode toggle stored as AsyncStorage key "isDarkMode"; also calls
  Appearance.setColorScheme.
- Notification toggle controlled by notificationStore and OS permission.
- LanguageSwitcher.
- Clear cache button.
- Feedback button.
- PayPal button using AsyncStorage key "paypal" maintained by realtime.
- App version from Constants.expoConfig.version.
- Links for data privacy, about app, imprint.

Push notifications
------------------
File: src/hooks/usePushNotifications.ts

Behavior:
- Root layout calls usePushNotifications.
- Effective enabled = user opt-in + OS permission granted.
- On native device, registers Expo push token.
- Upserts into Supabase table user_tokens with:
  - expo_push_token
  - app_version
  - platform
  - language_code
  - guest_id
- If notifications are disabled, deletes the stored token from Supabase and
  removes local AsyncStorage token.
- Notification tap navigates to data.route if provided, otherwise to home.

Force update and review prompt
------------------------------
ForceUpdateGate:
- File: src/components/ForceUpdateGate.tsx
- Native only; web returns null.
- In production, reads required version from Supabase table versions.
- Caches required_app_version in AsyncStorage.
- If installed version differs, blocks app with update overlay.
- Store URLs are placeholders and should be updated before production.

AppReviewPrompt:
- File: src/components/AppReviewPrompt.tsx
- Sets install date if missing.
- After 10 seconds, if eligible, requests native store review or opens store URL.
- Eligibility is controlled by stores/useAppReviewStore.ts.

Design and UI conventions in this app
-------------------------------------
- The app supports RTL. When adding row layouts, check rtl from useLanguage and
  flip flexDirection / textAlign / writingDirection where appropriate.
- Web UI intentionally uses smaller sizes than native in many components.
- Avoid making cards too large on web.
- Lists should not mount many YouTube players. The desired pattern is:
  - list cards show thumbnail only
  - tap opens /video/[id]
  - only the detail screen mounts the player
- Images from Supabase were removed. Use YouTube thumbnails instead.
- Video cards should remain same height even when titles have different
  lengths; title uses numberOfLines and minHeight.
- When search or filters are active, home should show a single-column grid,
  similar to favorites.
- No "podcast" naming should remain or be added.

Known implementation details and caveats
----------------------------------------
- Topic filtering in useVideoList is client-side after a page is fetched. If a
  selected topic is sparse, pagination may not fill the UI with pageSize items
  even though more matching items may exist later. Improving this would require
  a server-side schema/query change, e.g. normalized topic table or RPC.
- useVideoFilters has a better dependent topic-author filter only in fallback
  mode because RPCs return independent distinct lists.
- The README is mostly Expo starter text and not a reliable project
  architecture guide. Prefer this file for LLM context.
- Expo typed routes are enabled. After adding/removing routes, Expo may need to
  regenerate .expo/types/router.d.ts. TypeScript should catch bad route names.
- The project has a Metro resolver override for "zustand/middleware".
- Some older files/comments may still have starter-template traces, but current
  feature code is video-focused.

How to safely modify the project
--------------------------------
- Prefer existing patterns:
  - React Query for Supabase reads
  - Zustand for local state
  - AsyncStorage persistence through Zustand persist
  - Expo Router Stack/sheet routes for modal sheets
  - Colors/useColorScheme/useLanguage for themed and RTL UI
- Do not add author images or image_url dependencies. The app dropped those.
- Do not use gorhom bottom sheet; use Expo Router sheet/formSheet routes.
- Do not mount players in large lists unless explicitly requested.
- If adding a new video query, ensure realtime invalidation still covers it by
  using query keys under ["videos"] or updating SupabaseRealtimeProvider.
- If adding persistent Zustand stores, add them to useAllStoresHydrated in
  src/app/_layout.tsx if app startup depends on them.
- If adding translation keys, update all three locale files: de.ts, en.ts,
  ar.ts.
- Check both web and native layout assumptions. There are many Platform.OS
  branches for web sizing.
- For video route changes, keep the canonical player route under /video/[id].
- After code changes, run:
  - npx tsc --noEmit
  - npm run lint
  - git diff --check

Current key files by responsibility
-----------------------------------
- App root/providers: src/app/_layout.tsx
- Tabs: src/components/app-tabs.tsx, src/app/(tabs)/_layout.tsx
- Home: src/app/(tabs)/home/index.tsx
- Video detail/player: src/app/video/[id].tsx
- Video list layout: src/components/VideoGridList.tsx
- Video preview card: src/components/VideoGridCard.tsx
- Favorites screen: src/components/RenderFavoriteVideos.tsx
- Favorite folder sheet: src/components/VideoFavoriteFolderModal.tsx
- Filter sheet: src/components/FilterModal.tsx
- Supabase client: utils/supabase.ts
- Realtime provider: src/components/SupabaseRealtimeProvider.tsx
- Video list query: src/hooks/useVideoList.ts
- Single video query: src/hooks/useVideoById.ts
- Favorite videos query: src/hooks/useVideosByIdsForFavorites.ts
- Filter data query: src/hooks/useVideoFilters.ts
- Language data query: src/hooks/useVideoLanguages.ts
- Video types: src/constants/Types.ts
- Colors: src/constants/Colors.ts
- YouTube parsing: utils/youtube.ts
- Topic parsing: utils/videoTopics.ts
- i18n setup: utils/i18n.ts
- Language context: contexts/LanguageContext.tsx
- Favorite store: stores/videoFavoriteFoldersStore.ts
- Filter store: stores/videoFilterStore.ts
- Watched store: src/hooks/useVideoWatchedStore.ts
- Finished store: src/hooks/useVideoFinishedStore.ts
- Notification store: stores/notificationStore.ts
- Push notifications: src/hooks/usePushNotifications.ts
- Settings: src/app/(tabs)/settings/index.tsx
- Force update: src/components/ForceUpdateGate.tsx
- App review: src/components/AppReviewPrompt.tsx
