import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useQueryClient } from "@tanstack/react-query";
import { Stack, useLocalSearchParams } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import type { TopicType } from "@/constants/Types";
import { supabase } from "../../../../utils/supabase";
import {
  getVideoTopicNames,
  getVideoTopics,
  normalizeVideoRows,
  parseTopics,
  VIDEO_WITH_TOPICS_SELECT,
} from "../../../../utils/videoTopics";
import { getYoutubeVideoId, parseYoutubeTime } from "../../../../utils/youtube";

type ViewMode = "insert" | "manage";

type SharedFieldKey =
  | "authorName"
  | "languageCode"
  | "videoTopic"
  | "startTime"
  | "endTime";

type VideoFieldKey = "title" | "youtubeUrl" | SharedFieldKey;

type SharedValues = Record<SharedFieldKey, string>;

type SharedFieldState = Record<SharedFieldKey, boolean>;

type VideoRow = SharedValues & {
  id: string;
  title: string;
  youtubeUrl: string;
};

type VideoDraft = Record<VideoFieldKey, string>;

type ManagedVideo = {
  id: number;
  title: string;
  youtube_url: string;
  created_at: string;
  language_code: string | null;
  video_topic: string | null;
  topics?: TopicType[];
  author_name: string | null;
  start_time: number | null;
  end_time: number | null;
};

type AuthorRow = {
  id: number;
  created_at: string | null;
  author_name: string;
  source: "authors" | "videos";
};

type TopicRow = {
  id: number;
  topic: string;
  count: number;
};

type Feedback = {
  type: "error" | "success";
  message: string;
};

type VideoInsertPayload = {
  title: string;
  youtube_url: string;
  language_code: string | null;
  author_name: string | null;
  start_time: number | null;
  end_time: number | null;
};

type PreparedVideoPayload = {
  payload: VideoInsertPayload;
  topicNames: string[];
};

type FieldDefinition<Key extends string> = {
  key: Key;
  label: string;
  placeholder: string;
  required?: boolean;
  keyboardType?: TextInputProps["keyboardType"];
  autoCapitalize?: TextInputProps["autoCapitalize"];
  autoCorrect?: boolean;
};

type PreparedVideo = {
  title: string;
  authorName: string | null;
  languageCode: string | null;
  topicNames: string[];
  payload: VideoInsertPayload;
};

const initialSharedValues: SharedValues = {
  authorName: "",
  languageCode: "",
  videoTopic: "",
  startTime: "",
  endTime: "",
};

const initialSharedFields: SharedFieldState = {
  authorName: true,
  languageCode: true,
  videoTopic: true,
  startTime: false,
  endTime: false,
};

const baseVideoFields: FieldDefinition<"title" | "youtubeUrl">[] = [
  {
    key: "title",
    label: "Titel",
    placeholder: "Titel des Videos",
    required: true,
  },
  {
    key: "youtubeUrl",
    label: "YouTube URL",
    placeholder: "https://www.youtube.com/watch?v=...",
    required: true,
    keyboardType: "url",
    autoCapitalize: "none",
    autoCorrect: false,
  },
];

const sharedFieldDefinitions: FieldDefinition<SharedFieldKey>[] = [
  {
    key: "authorName",
    label: "Autor",
    placeholder: "Name des Autors",
  },
  {
    key: "languageCode",
    label: "Sprache",
    placeholder: "de, en, ar",
    autoCapitalize: "none",
    autoCorrect: false,
  },
  {
    key: "videoTopic",
    label: "Thema",
    placeholder: "Thema oder mehrere Themen",
  },
  {
    key: "startTime",
    label: "Startzeit",
    placeholder: "Sekunden oder 01:23",
  },
  {
    key: "endTime",
    label: "Endzeit",
    placeholder: "Sekunden oder 12:34",
  },
];

const managedVideoFieldDefinitions: FieldDefinition<VideoFieldKey>[] = [
  ...baseVideoFields,
  ...sharedFieldDefinitions,
];

let videoRowSequence = 0;

function createVideoRow(values?: Partial<VideoRow>): VideoRow {
  videoRowSequence += 1;

  return {
    id: `video-row-${Date.now()}-${videoRowSequence}`,
    title: "",
    youtubeUrl: "",
    ...initialSharedValues,
    ...values,
  };
}

function createBlankVideoDraft(): VideoDraft {
  return {
    title: "",
    youtubeUrl: "",
    ...initialSharedValues,
  };
}

function createVideoDraft(video: ManagedVideo): VideoDraft {
  return {
    title: video.title ?? "",
    youtubeUrl: video.youtube_url ?? "",
    authorName: video.author_name ?? "",
    languageCode: video.language_code ?? "",
    videoTopic: serializeTopicList(getVideoTopicNames(video)) ?? "",
    startTime: video.start_time == null ? "" : String(video.start_time),
    endTime: video.end_time == null ? "" : String(video.end_time),
  };
}

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseOptionalTime(value: string, label: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const seconds = parseYoutubeTime(trimmed);
  if (seconds === undefined) {
    throw new Error(`${label} muss Sekunden oder eine Zeit wie 01:23 sein.`);
  }

  return seconds;
}

function getErrorMessage(
  error: unknown,
  fallback = "Die Aktion konnte nicht abgeschlossen werden.",
) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return fallback;
}

function getDuplicateKey(
  title: string,
  authorName: string | null,
  languageCode: string | null,
) {
  return [
    languageCode ?? "NO_LANGUAGE",
    authorName ?? "NO_AUTHOR",
    title.toLocaleLowerCase("de"),
  ].join("::");
}

function normalizeAuthorNameForComparison(authorName: string) {
  return authorName.trim().toLocaleLowerCase("de");
}

function mergeAuthorsFromSources(
  authorRows: {
    id: number;
    created_at: string;
    author_name: string;
  }[],
  videoRows: ManagedVideo[],
): AuthorRow[] {
  const authorMap = new Map<string, AuthorRow>();

  for (const author of authorRows) {
    const authorName = author.author_name.trim();
    if (!authorName) continue;

    authorMap.set(normalizeAuthorNameForComparison(authorName), {
      id: author.id,
      created_at: author.created_at,
      author_name: authorName,
      source: "authors",
    });
  }

  for (const video of videoRows) {
    const authorName = video.author_name?.trim();
    if (!authorName) continue;

    const key = normalizeAuthorNameForComparison(authorName);
    if (authorMap.has(key)) continue;

    authorMap.set(key, {
      id: -(authorMap.size + 1),
      created_at: null,
      author_name: authorName,
      source: "videos",
    });
  }

  return [...authorMap.values()].sort((a, b) =>
    a.author_name.localeCompare(b.author_name, "de"),
  );
}

function buildVideoPayloadFromDraft(
  draft: VideoDraft,
  rowLabel = "Video",
): PreparedVideoPayload {
  const title = draft.title.trim();
  const youtubeUrl = draft.youtubeUrl.trim();
  const authorName = optionalText(draft.authorName);
  const languageCode = optionalText(draft.languageCode)?.toLowerCase() ?? null;
  const topicNames = normalizeTopicList(parseTopics(draft.videoTopic));

  if (!title || !youtubeUrl) {
    throw new Error(`${rowLabel}: Titel und YouTube URL sind Pflicht.`);
  }

  if (!getYoutubeVideoId(youtubeUrl)) {
    throw new Error(`${rowLabel}: Bitte eine gültige YouTube URL eintragen.`);
  }

  const startTime = parseOptionalTime(draft.startTime, `${rowLabel} Startzeit`);
  const endTime = parseOptionalTime(draft.endTime, `${rowLabel} Endzeit`);

  if (startTime !== null && endTime !== null && endTime <= startTime) {
    throw new Error(
      `${rowLabel}: Die Endzeit muss größer sein als die Startzeit.`,
    );
  }

  return {
    payload: {
      title,
      youtube_url: youtubeUrl,
      language_code: languageCode,
      author_name: authorName,
      start_time: startTime,
      end_time: endTime,
    },
    topicNames,
  };
}

function normalizeTopicList(topics: string[]) {
  const seen = new Set<string>();
  const normalizedTopics: string[] = [];

  for (const topic of topics) {
    const normalizedTopic = topic.trim();
    const key = normalizedTopic.toLocaleLowerCase("de");

    if (!normalizedTopic || seen.has(key)) continue;
    seen.add(key);
    normalizedTopics.push(normalizedTopic);
  }

  return normalizedTopics;
}

function serializeTopicList(topics: string[]) {
  const normalizedTopics = normalizeTopicList(topics);
  return normalizedTopics.length > 0 ? normalizedTopics.join(", ") : null;
}

async function ensureAuthorsExist(authorNames: (string | null)[]) {
  const uniqueAuthors = [
    ...new Set(authorNames.map((name) => name?.trim()).filter(Boolean)),
  ] as string[];

  if (uniqueAuthors.length === 0) return;

  const { error } = await supabase.from("authors").upsert(
    uniqueAuthors.map((author_name) => ({ author_name })),
    {
      onConflict: "author_name",
      ignoreDuplicates: true,
    },
  );

  if (error) throw error;
}

async function replaceVideoTopics(videoId: number, topicNames: string[]) {
  const normalizedTopicNames = normalizeTopicList(topicNames);

  const { error: deleteError } = await supabase
    .from("video_topics")
    .delete()
    .eq("video_id", videoId);

  if (deleteError) throw deleteError;

  if (normalizedTopicNames.length === 0) return;

  const topicPayloads = normalizedTopicNames.map((name) => ({ name }));
  const { error: upsertError } = await supabase
    .from("topics")
    .upsert(topicPayloads, { onConflict: "name" });

  if (upsertError) throw upsertError;

  const { data: topicRows, error: topicsError } = await supabase
    .from("topics")
    .select("id, name")
    .in("name", normalizedTopicNames);

  if (topicsError) throw topicsError;

  const rows = (topicRows ?? [])
    .filter(
      (topic): topic is { id: number; name: string } =>
        typeof topic.id === "number" && typeof topic.name === "string",
    )
    .map((topic) => ({
      video_id: videoId,
      topic_id: topic.id,
    }));

  if (rows.length !== normalizedTopicNames.length) {
    throw new Error("Nicht alle Themen konnten angelegt werden.");
  }

  const { error: insertError } = await supabase
    .from("video_topics")
    .insert(rows);

  if (insertError) throw insertError;
}

function confirmDestructiveAction(title: string, message: string) {
  if (Platform.OS === "web" && typeof globalThis.confirm === "function") {
    return Promise.resolve(globalThis.confirm(`${title}\n\n${message}`));
  }

  return new Promise<boolean>((resolve) => {
    Alert.alert(
      title,
      message,
      [
        {
          text: "Abbrechen",
          style: "cancel",
          onPress: () => resolve(false),
        },
        {
          text: "Löschen",
          style: "destructive",
          onPress: () => resolve(true),
        },
      ],
      {
        cancelable: true,
        onDismiss: () => resolve(false),
      },
    );
  });
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
}

function firstSearchParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function parseOptionalId(value: string | undefined) {
  if (!value) return null;

  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export default function AddVideo() {
  const colorScheme = useColorScheme();
  const queryClient = useQueryClient();
  const routeParams = useLocalSearchParams<{
    mode?: string | string[];
    editVideoId?: string | string[];
    topic?: string | string[];
    authNonce?: string | string[];
  }>();
  const requestedMode = firstSearchParam(routeParams.mode);
  const authResetKey = firstSearchParam(routeParams.authNonce) ?? "direct";
  const requestedEditVideoId = parseOptionalId(
    firstSearchParam(routeParams.editVideoId),
  );
  const requestedTopic =
    optionalText(firstSearchParam(routeParams.topic) ?? "") ?? null;
  const shouldOpenManagement =
    requestedMode === "manage" ||
    requestedEditVideoId !== null ||
    requestedTopic !== null;
  const shortcutKey =
    requestedEditVideoId !== null
      ? `video:${requestedEditVideoId}`
      : requestedTopic
        ? `topic:${requestedTopic}`
        : null;
  const handledShortcutRef = useRef<string | null>(null);
  const [mode, setMode] = useState<ViewMode>(() =>
    shouldOpenManagement ? "manage" : "insert",
  );
  const [sharedValues, setSharedValues] =
    useState<SharedValues>(initialSharedValues);
  const [sharedFields, setSharedFields] =
    useState<SharedFieldState>(initialSharedFields);
  const [videos, setVideos] = useState<VideoRow[]>(() => [createVideoRow()]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  const [passwordValue, setPasswordValue] = useState("");
  const [passwordFeedback, setPasswordFeedback] = useState<string | null>(null);
  const [isPasswordChecking, setIsPasswordChecking] = useState(false);
  const [managedVideos, setManagedVideos] = useState<ManagedVideo[]>([]);
  const [authors, setAuthors] = useState<AuthorRow[]>([]);
  const [managementLoaded, setManagementLoaded] = useState(false);
  const [isManagementLoading, setIsManagementLoading] = useState(false);
  const [isManagementSaving, setIsManagementSaving] = useState(false);
  const [managementFeedback, setManagementFeedback] =
    useState<Feedback | null>(null);
  const [managementSearch, setManagementSearch] = useState("");
  const [newAuthorName, setNewAuthorName] = useState("");
  const [editingAuthorId, setEditingAuthorId] = useState<number | null>(null);
  const [authorDraftName, setAuthorDraftName] = useState("");
  const [editingVideoId, setEditingVideoId] = useState<number | null>(null);
  const [videoDraft, setVideoDraft] = useState<VideoDraft>(() =>
    createBlankVideoDraft(),
  );
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [topicDraftName, setTopicDraftName] = useState("");

  const colors = Colors[colorScheme];
  const borderColor =
    colorScheme === "dark" ? "rgba(255,255,255,0.16)" : "rgba(17,24,28,0.14)";
  const mutedBorderColor =
    colorScheme === "dark" ? "rgba(255,255,255,0.1)" : "rgba(17,24,28,0.08)";
  const inputBackground =
    colorScheme === "dark" ? "rgba(255,255,255,0.07)" : "#fff";
  const mutedTextColor =
    colorScheme === "dark" ? "rgba(236,237,238,0.68)" : "rgba(17,24,28,0.62)";
  const operationDisabled =
    isSubmitting || isManagementLoading || isManagementSaving;

  const invalidateVideoCaches = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["videos"] }),
      queryClient.invalidateQueries({ queryKey: ["video_filter_pairs"] }),
      queryClient.invalidateQueries({ queryKey: ["video_languages"] }),
    ]);
  }, [queryClient]);

  const loadManagementData = useCallback(async () => {
    setIsManagementLoading(true);
    setManagementFeedback(null);

    try {
      const [authorsResult, videosResult] = await Promise.all([
        supabase
          .from("authors")
          .select("id, created_at, author_name")
          .order("author_name", { ascending: true }),
        supabase
          .from("videos")
          .select(VIDEO_WITH_TOPICS_SELECT)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false }),
      ]);

      if (videosResult.error) throw videosResult.error;

      const nextManagedVideos = normalizeVideoRows(
        videosResult.data,
      ) as ManagedVideo[];
      const nextAuthors = mergeAuthorsFromSources(
        authorsResult.error
          ? []
          : ((authorsResult.data ?? []) as {
              id: number;
              created_at: string;
              author_name: string;
            }[]),
        nextManagedVideos,
      );

      setAuthors(nextAuthors);
      setManagedVideos(nextManagedVideos);
      setManagementLoaded(true);

      if (authorsResult.error) {
        setManagementFeedback({
          type: "error",
          message:
            "Die authors-Tabelle konnte nicht gelesen werden. Ich zeige Autoren aus den Videos.",
        });
      }
    } catch (error) {
      const message = getErrorMessage(error);
      setManagementFeedback({ type: "error", message });
      Toast.show({
        type: "error",
        text1: "Daten konnten nicht geladen werden",
        text2: message,
      });
    } finally {
      setIsManagementLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mode === "manage" && isAdminUnlocked && !managementLoaded) {
      void loadManagementData();
    }
  }, [isAdminUnlocked, loadManagementData, managementLoaded, mode]);

  useEffect(() => {
    if (shouldOpenManagement) {
      setMode("manage");
    }
  }, [shouldOpenManagement]);

  useEffect(() => {
    setIsAdminUnlocked(false);
    setPasswordValue("");
    setPasswordFeedback(null);
    handledShortcutRef.current = null;
  }, [authResetKey]);

  const authorVideoCounts = useMemo(() => {
    const counts = new Map<string, number>();

    for (const video of managedVideos) {
      const authorName = video.author_name?.trim();
      if (!authorName) continue;
      counts.set(authorName, (counts.get(authorName) ?? 0) + 1);
    }

    return counts;
  }, [managedVideos]);

  const authorNamesForComparison = useMemo(() => {
    return new Set(
      authors.map((author) =>
        normalizeAuthorNameForComparison(author.author_name),
      ),
    );
  }, [authors]);

  const topicRows = useMemo<TopicRow[]>(() => {
    const counts = new Map<string, TopicRow>();

    for (const video of managedVideos) {
      for (const topic of getVideoTopics(video)) {
        const existing = counts.get(topic.name);
        counts.set(topic.name, {
          id: existing?.id && existing.id > 0 ? existing.id : topic.id,
          topic: topic.name,
          count: (existing?.count ?? 0) + 1,
        });
      }
    }

    return [...counts.values()].sort((a, b) =>
      a.topic.localeCompare(b.topic, "de"),
    );
  }, [managedVideos]);

  useEffect(() => {
    if (
      managementLoaded &&
      selectedTopic &&
      topicRows.length > 0 &&
      !topicRows.some((topicRow) => topicRow.topic === selectedTopic)
    ) {
      setSelectedTopic(null);
      setTopicDraftName("");
    }
  }, [managementLoaded, selectedTopic, topicRows]);

  const filteredManagedVideos = useMemo(() => {
    const normalizedSearch = managementSearch.trim().toLocaleLowerCase("de");

    return managedVideos.filter((video) => {
      const matchesSelectedTopic =
        !selectedTopic || getVideoTopicNames(video).includes(selectedTopic);

      if (!matchesSelectedTopic) return false;
      if (!normalizedSearch) return true;

      const values = [
        String(video.id),
        video.title,
        video.youtube_url,
        video.author_name ?? "",
        video.language_code ?? "",
        getVideoTopicNames(video).join(", "),
      ];

      return values.some((value) =>
        value.toLocaleLowerCase("de").includes(normalizedSearch),
      );
    });
  }, [managedVideos, managementSearch, selectedTopic]);

  const updateSharedValue = (key: SharedFieldKey, value: string) => {
    setSharedValues((current) => ({ ...current, [key]: value }));
    if (feedback) setFeedback(null);
  };

  const updateVideoField = (
    id: string,
    key: VideoFieldKey,
    value: string,
  ) => {
    setVideos((current) =>
      current.map((video) =>
        video.id === id ? { ...video, [key]: value } : video,
      ),
    );
    if (feedback) setFeedback(null);
  };

  const updateVideoDraft = (key: VideoFieldKey, value: string) => {
    setVideoDraft((current) => ({ ...current, [key]: value }));
    if (managementFeedback) setManagementFeedback(null);
  };

  const toggleSharedField = (key: SharedFieldKey) => {
    setSharedFields((current) => {
      const willBeShared = !current[key];

      if (willBeShared && !sharedValues[key]) {
        const firstValue = videos.find((video) => video[key].trim())?.[key];
        if (firstValue) {
          setSharedValues((values) => ({ ...values, [key]: firstValue }));
        }
      }

      return { ...current, [key]: willBeShared };
    });
    if (feedback) setFeedback(null);
  };

  const addVideoRow = () => {
    setVideos((current) => [...current, createVideoRow()]);
    if (feedback) setFeedback(null);
  };

  const removeVideoRow = (id: string) => {
    setVideos((current) => {
      if (current.length === 1) return [createVideoRow()];
      return current.filter((video) => video.id !== id);
    });
    if (feedback) setFeedback(null);
  };

  const isVideoRowEmpty = (video: VideoRow) => {
    if (video.title.trim() || video.youtubeUrl.trim()) return false;

    return sharedFieldDefinitions.every((field) => {
      if (sharedFields[field.key]) return true;
      return !video[field.key].trim();
    });
  };

  const getResolvedValue = (video: VideoRow, key: SharedFieldKey) =>
    sharedFields[key] ? sharedValues[key] : video[key];

  const buildPayloads = () => {
    const activeVideos = videos.filter((video) => !isVideoRowEmpty(video));

    if (activeVideos.length === 0) {
      throw new Error("Bitte mindestens ein Video eintragen.");
    }

    const seenVideos = new Set<string>();

    return activeVideos.map((video, index): PreparedVideo => {
      const rowLabel = `Video ${index + 1}`;
      const preparedPayload = buildVideoPayloadFromDraft(
        {
          title: video.title,
          youtubeUrl: video.youtubeUrl,
          authorName: getResolvedValue(video, "authorName"),
          languageCode: getResolvedValue(video, "languageCode"),
          videoTopic: getResolvedValue(video, "videoTopic"),
          startTime: getResolvedValue(video, "startTime"),
          endTime: getResolvedValue(video, "endTime"),
        },
        rowLabel,
      );
      const payload = preparedPayload.payload;

      const duplicateKey = getDuplicateKey(
        payload.title,
        payload.author_name,
        payload.language_code,
      );
      if (seenVideos.has(duplicateKey)) {
        throw new Error(
          `${rowLabel}: Dieser Titel ist für denselben Autor und dieselbe Sprache doppelt.`,
        );
      }
      seenVideos.add(duplicateKey);

      return {
        title: payload.title,
        authorName: payload.author_name,
        languageCode: payload.language_code,
        topicNames: preparedPayload.topicNames,
        payload,
      };
    });
  };

  const assertNoExistingDuplicates = async (preparedVideos: PreparedVideo[]) => {
    for (const video of preparedVideos) {
      let duplicateRequest = supabase
        .from("videos")
        .select("id")
        .eq("title", video.title)
        .limit(1);

      duplicateRequest = video.authorName
        ? duplicateRequest.eq("author_name", video.authorName)
        : duplicateRequest.is("author_name", null);

      duplicateRequest = video.languageCode
        ? duplicateRequest.eq("language_code", video.languageCode)
        : duplicateRequest.is("language_code", null);

      const { data: duplicateRows, error: duplicateError } =
        await duplicateRequest;

      if (duplicateError) throw duplicateError;

      if ((duplicateRows ?? []).length > 0) {
        throw new Error(
          `"${video.title}" existiert bereits für denselben Autor in derselben Sprache.`,
        );
      }
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;

    let preparedVideos: PreparedVideo[];
    try {
      preparedVideos = buildPayloads();
    } catch (error) {
      setFeedback({
        type: "error",
        message: getErrorMessage(
          error,
          "Die Videos konnten nicht vorbereitet werden.",
        ),
      });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      await assertNoExistingDuplicates(preparedVideos);
      await ensureAuthorsExist(preparedVideos.map((video) => video.authorName));

      const { data: insertedVideos, error: insertError } = await supabase
        .from("videos")
        .insert(preparedVideos.map((video) => video.payload))
        .select("id");

      if (insertError) throw insertError;

      const insertedRows = (insertedVideos ?? []) as { id: number }[];
      if (insertedRows.length !== preparedVideos.length) {
        throw new Error("Nicht alle eingefügten Videos wurden zurückgegeben.");
      }

      await Promise.all(
        insertedRows.map((video, index) =>
          replaceVideoTopics(video.id, preparedVideos[index].topicNames),
        ),
      );

      await invalidateVideoCaches();
      if (managementLoaded) await loadManagementData();

      const insertedCount = insertedRows.length;
      const message =
        insertedCount === 1
          ? "1 Video wurde eingefügt."
          : `${insertedCount} Videos wurden eingefügt.`;

      setVideos([createVideoRow()]);
      setFeedback({ type: "success", message });
      Toast.show({
        type: "success",
        text1: "Videos eingefügt",
        text2: message,
      });
    } catch (error) {
      const message = getErrorMessage(
        error,
        "Die Videos konnten nicht eingefügt werden.",
      );
      setFeedback({ type: "error", message });
      Toast.show({
        type: "error",
        text1: "Einfügen fehlgeschlagen",
        text2: message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnlockAdmin = async () => {
    if (isPasswordChecking) return;

    if (!passwordValue) {
      setPasswordFeedback("Bitte das Passwort eingeben.");
      return;
    }

    const submittedPassword = passwordValue;

    setIsPasswordChecking(true);
    setPasswordFeedback(null);

    try {
      const { data, error } = await supabase
        .from("password")
        .select("id")
        .eq("password", submittedPassword)
        .limit(1);

      if (error) throw error;

      setPasswordValue("");

      if ((data ?? []).length === 0) {
        setPasswordFeedback("Das Passwort ist falsch.");
        return;
      }

      setIsAdminUnlocked(true);
      setPasswordFeedback(null);
    } catch (error) {
      setPasswordValue("");
      setPasswordFeedback(
        getErrorMessage(error, "Das Passwort konnte nicht geprüft werden."),
      );
    } finally {
      setIsPasswordChecking(false);
    }
  };

  const handleAddAuthor = async () => {
    if (operationDisabled) return;

    const authorName = newAuthorName.trim();
    if (!authorName) {
      setManagementFeedback({
        type: "error",
        message: "Bitte einen Autorennamen eintragen.",
      });
      return;
    }

    if (authorNamesForComparison.has(normalizeAuthorNameForComparison(authorName))) {
      setManagementFeedback({
        type: "error",
        message: `"${authorName}" existiert bereits.`,
      });
      return;
    }

    setIsManagementSaving(true);
    setManagementFeedback(null);

    try {
      const { error } = await supabase
        .from("authors")
        .insert({ author_name: authorName });

      if (error) throw error;

      await invalidateVideoCaches();
      await loadManagementData();

      setNewAuthorName("");
      setManagementFeedback({
        type: "success",
        message: `"${authorName}" wurde hinzugefügt.`,
      });
      Toast.show({
        type: "success",
        text1: "Autor hinzugefügt",
        text2: authorName,
      });
    } catch (error) {
      const message = isUniqueConstraintError(error)
        ? `"${authorName}" existiert bereits.`
        : getErrorMessage(error);
      setManagementFeedback({ type: "error", message });
      Toast.show({
        type: "error",
        text1: "Autor konnte nicht hinzugefügt werden",
        text2: message,
      });
    } finally {
      setIsManagementSaving(false);
    }
  };

  const startEditAuthor = (author: AuthorRow) => {
    setEditingAuthorId(author.id);
    setAuthorDraftName(author.author_name);
    setManagementFeedback(null);
  };

  const cancelEditAuthor = () => {
    setEditingAuthorId(null);
    setAuthorDraftName("");
  };

  const handleSaveAuthor = async (author: AuthorRow) => {
    if (operationDisabled) return;

    const nextAuthorName = authorDraftName.trim();
    if (!nextAuthorName) {
      setManagementFeedback({
        type: "error",
        message: "Der Autorenname darf nicht leer sein.",
      });
      return;
    }

    if (nextAuthorName === author.author_name) {
      cancelEditAuthor();
      return;
    }

    const nextAuthorKey = normalizeAuthorNameForComparison(nextAuthorName);
    const isDuplicateAuthor = authors.some(
      (existingAuthor) =>
        existingAuthor.id !== author.id &&
        normalizeAuthorNameForComparison(existingAuthor.author_name) ===
          nextAuthorKey,
    );

    if (isDuplicateAuthor) {
      setManagementFeedback({
        type: "error",
        message: `"${nextAuthorName}" existiert bereits.`,
      });
      return;
    }

    setIsManagementSaving(true);
    setManagementFeedback(null);

    try {
      if (author.source === "authors") {
        const { error } = await supabase
          .from("authors")
          .update({ author_name: nextAuthorName })
          .eq("id", author.id);

        if (error) throw error;
      } else {
        await ensureAuthorsExist([nextAuthorName]);

        const { error } = await supabase
          .from("videos")
          .update({ author_name: nextAuthorName })
          .eq("author_name", author.author_name);

        if (error) throw error;
      }

      await invalidateVideoCaches();
      await loadManagementData();

      setEditingAuthorId(null);
      setAuthorDraftName("");
      setManagementFeedback({
        type: "success",
        message: `"${author.author_name}" wurde umbenannt.`,
      });
      Toast.show({
        type: "success",
        text1: "Autor gespeichert",
        text2: nextAuthorName,
      });
    } catch (error) {
      const message = isUniqueConstraintError(error)
        ? `"${nextAuthorName}" existiert bereits.`
        : getErrorMessage(error);
      setManagementFeedback({ type: "error", message });
      Toast.show({
        type: "error",
        text1: "Autor konnte nicht gespeichert werden",
        text2: message,
      });
    } finally {
      setIsManagementSaving(false);
    }
  };

  const handleDeleteAuthor = async (author: AuthorRow) => {
    if (operationDisabled) return;

    if (author.source !== "authors") {
      setManagementFeedback({
        type: "error",
        message: `"${author.author_name}" stammt aus Videos und hat keinen sichtbaren authors-Eintrag.`,
      });
      return;
    }

    const videoCount = authorVideoCounts.get(author.author_name) ?? 0;
    if (videoCount > 0) {
      setManagementFeedback({
        type: "error",
        message: `"${author.author_name}" ist noch mit ${videoCount} Video${
          videoCount === 1 ? "" : "s"
        } verknüpft.`,
      });
      return;
    }

    const confirmed = await confirmDestructiveAction(
      "Autor löschen?",
      `"${author.author_name}" wird aus der Autoren-Tabelle entfernt.`,
    );

    if (!confirmed) return;

    setIsManagementSaving(true);
    setManagementFeedback(null);

    try {
      const { error } = await supabase
        .from("authors")
        .delete()
        .eq("id", author.id);

      if (error) throw error;

      await invalidateVideoCaches();
      await loadManagementData();

      setManagementFeedback({
        type: "success",
        message: `"${author.author_name}" wurde gelöscht.`,
      });
      Toast.show({
        type: "success",
        text1: "Autor gelöscht",
        text2: author.author_name,
      });
    } catch (error) {
      const message = getErrorMessage(error);
      setManagementFeedback({ type: "error", message });
      Toast.show({
        type: "error",
        text1: "Autor konnte nicht gelöscht werden",
        text2: message,
      });
    } finally {
      setIsManagementSaving(false);
    }
  };

  const startEditVideo = (video: ManagedVideo) => {
    setEditingVideoId(video.id);
    setVideoDraft(createVideoDraft(video));
    setManagementFeedback(null);
  };

  const cancelEditVideo = () => {
    setEditingVideoId(null);
    setVideoDraft(createBlankVideoDraft());
  };

  useEffect(() => {
    if (!isAdminUnlocked || !managementLoaded || !shortcutKey) return;
    if (handledShortcutRef.current === shortcutKey) return;

    setMode("manage");

    if (requestedEditVideoId !== null) {
      const video = managedVideos.find(
        (managedVideo) => managedVideo.id === requestedEditVideoId,
      );

      if (!video) {
        setManagementFeedback({
          type: "error",
          message: `Video ${requestedEditVideoId} wurde nicht gefunden.`,
        });
        handledShortcutRef.current = shortcutKey;
        return;
      }

      setSelectedTopic(null);
      setTopicDraftName("");
      setManagementSearch(String(video.id));
      startEditVideo(video);
      handledShortcutRef.current = shortcutKey;
      return;
    }

    if (requestedTopic) {
      setEditingVideoId(null);
      setVideoDraft(createBlankVideoDraft());
      setSelectedTopic(requestedTopic);
      setTopicDraftName(requestedTopic);
      setManagementSearch("");
      handledShortcutRef.current = shortcutKey;
    }
  }, [
    isAdminUnlocked,
    managedVideos,
    managementLoaded,
    requestedEditVideoId,
    requestedTopic,
    shortcutKey,
  ]);

  const handleSaveVideo = async (videoId: number) => {
    if (operationDisabled) return;

    let preparedPayload: PreparedVideoPayload;
    try {
      preparedPayload = buildVideoPayloadFromDraft(videoDraft);
    } catch (error) {
      setManagementFeedback({
        type: "error",
        message: getErrorMessage(error, "Das Video konnte nicht vorbereitet werden."),
      });
      return;
    }
    const payload = preparedPayload.payload;

    setIsManagementSaving(true);
    setManagementFeedback(null);

    try {
      await ensureAuthorsExist([payload.author_name]);

      const { error } = await supabase
        .from("videos")
        .update(payload)
        .eq("id", videoId);

      if (error) throw error;

      await replaceVideoTopics(videoId, preparedPayload.topicNames);

      await invalidateVideoCaches();
      await loadManagementData();

      setEditingVideoId(null);
      setVideoDraft(createBlankVideoDraft());
      setManagementFeedback({
        type: "success",
        message: `"${payload.title}" wurde gespeichert.`,
      });
      Toast.show({
        type: "success",
        text1: "Video gespeichert",
        text2: payload.title,
      });
    } catch (error) {
      const message = getErrorMessage(error);
      setManagementFeedback({ type: "error", message });
      Toast.show({
        type: "error",
        text1: "Video konnte nicht gespeichert werden",
        text2: message,
      });
    } finally {
      setIsManagementSaving(false);
    }
  };

  const handleDeleteVideo = async (video: ManagedVideo) => {
    if (operationDisabled) return;

    const confirmed = await confirmDestructiveAction(
      "Video löschen?",
      `"${video.title}" wird dauerhaft aus der Videos-Tabelle entfernt.`,
    );

    if (!confirmed) return;

    setIsManagementSaving(true);
    setManagementFeedback(null);

    try {
      const { error } = await supabase
        .from("videos")
        .delete()
        .eq("id", video.id);

      if (error) throw error;

      await invalidateVideoCaches();
      await loadManagementData();

      if (editingVideoId === video.id) cancelEditVideo();

      setManagementFeedback({
        type: "success",
        message: `"${video.title}" wurde gelöscht.`,
      });
      Toast.show({
        type: "success",
        text1: "Video gelöscht",
        text2: video.title,
      });
    } catch (error) {
      const message = getErrorMessage(error);
      setManagementFeedback({ type: "error", message });
      Toast.show({
        type: "error",
        text1: "Video konnte nicht gelöscht werden",
        text2: message,
      });
    } finally {
      setIsManagementSaving(false);
    }
  };

  const handleSelectTopic = (topic: string) => {
    setSelectedTopic(topic);
    setTopicDraftName(topic);
    setManagementFeedback(null);
  };

  const handleRenameTopic = async () => {
    if (operationDisabled) return;

    const currentTopic = selectedTopic;
    const nextTopic = topicDraftName.trim();

    if (!currentTopic) {
      setManagementFeedback({
        type: "error",
        message: "Bitte zuerst ein Thema auswählen.",
      });
      return;
    }

    if (!nextTopic) {
      setManagementFeedback({
        type: "error",
        message: "Der neue Themenname darf nicht leer sein.",
      });
      return;
    }

    if (nextTopic === currentTopic) {
      setManagementFeedback({
        type: "error",
        message: "Der Themenname ist unverändert.",
      });
      return;
    }

    const currentTopicRow = topicRows.find(
      (topicRow) => topicRow.topic === currentTopic,
    );
    const affectedCount = currentTopicRow?.count ?? 0;

    setIsManagementSaving(true);
    setManagementFeedback(null);

    try {
      const topicRequest =
        currentTopicRow && currentTopicRow.id > 0
          ? supabase
              .from("topics")
              .update({ name: nextTopic })
              .eq("id", currentTopicRow.id)
          : supabase
              .from("topics")
              .update({ name: nextTopic })
              .eq("name", currentTopic);

      const { error } = await topicRequest;
      if (error) throw error;

      await invalidateVideoCaches();
      await loadManagementData();

      setSelectedTopic(nextTopic);
      setTopicDraftName(nextTopic);
      setManagementFeedback({
        type: "success",
        message: `"${currentTopic}" wurde in ${affectedCount} Video${
          affectedCount === 1 ? "" : "s"
        } umbenannt.`,
      });
      Toast.show({
        type: "success",
        text1: "Thema umbenannt",
        text2: nextTopic,
      });
    } catch (error) {
      const message = isUniqueConstraintError(error)
        ? `"${nextTopic}" existiert bereits.`
        : getErrorMessage(error);
      setManagementFeedback({ type: "error", message });
      Toast.show({
        type: "error",
        text1: "Thema konnte nicht geändert werden",
        text2: message,
      });
    } finally {
      setIsManagementSaving(false);
    }
  };

  const handleRemoveTopic = async () => {
    if (operationDisabled) return;

    const currentTopic = selectedTopic;
    if (!currentTopic) {
      setManagementFeedback({
        type: "error",
        message: "Bitte zuerst ein Thema auswählen.",
      });
      return;
    }

    const currentTopicRow = topicRows.find(
      (topicRow) => topicRow.topic === currentTopic,
    );
    const affectedCount = currentTopicRow?.count ?? 0;

    const confirmed = await confirmDestructiveAction(
      "Thema entfernen?",
      `"${currentTopic}" wird aus ${affectedCount} Video${
        affectedCount === 1 ? "" : "s"
      } entfernt. Die Videos bleiben erhalten.`,
    );

    if (!confirmed) return;

    setIsManagementSaving(true);
    setManagementFeedback(null);

    try {
      let topicId = currentTopicRow && currentTopicRow.id > 0
        ? currentTopicRow.id
        : null;

      if (!topicId) {
        const { data: topicData, error: topicError } = await supabase
          .from("topics")
          .select("id")
          .eq("name", currentTopic)
          .single();

        if (topicError) throw topicError;
        topicId = (topicData as { id: number } | null)?.id ?? null;
      }

      if (!topicId) {
        throw new Error(`"${currentTopic}" wurde nicht gefunden.`);
      }

      const { error } = await supabase
        .from("video_topics")
        .delete()
        .eq("topic_id", topicId);

      if (error) throw error;

      await invalidateVideoCaches();
      await loadManagementData();

      setSelectedTopic(null);
      setTopicDraftName("");
      setManagementFeedback({
        type: "success",
        message: `"${currentTopic}" wurde aus den Videos entfernt.`,
      });
      Toast.show({
        type: "success",
        text1: "Thema entfernt",
        text2: currentTopic,
      });
    } catch (error) {
      const message = getErrorMessage(error);
      setManagementFeedback({ type: "error", message });
      Toast.show({
        type: "error",
        text1: "Thema konnte nicht entfernt werden",
        text2: message,
      });
    } finally {
      setIsManagementSaving(false);
    }
  };

  const renderInput = (
    field: FieldDefinition<VideoFieldKey>,
    value: string,
    onChangeText: (value: string) => void,
    editable = !isSubmitting,
  ) => (
    <View key={field.key} style={styles.field}>
      <ThemedText style={styles.label}>
        {field.label}
        {field.required ? " *" : ""}
      </ThemedText>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={field.placeholder}
        placeholderTextColor={Colors.universal.grayedOut}
        keyboardType={field.keyboardType}
        autoCapitalize={field.autoCapitalize}
        autoCorrect={field.autoCorrect}
        editable={editable}
        style={[
          styles.input,
          {
            backgroundColor: inputBackground,
            borderColor,
            color: colors.text,
          },
        ]}
      />
    </View>
  );

  const renderSmallButton = (
    label: string,
    onPress: () => void,
    options?: {
      danger?: boolean;
      filled?: boolean;
      disabled?: boolean;
    },
  ) => {
    const disabled = Boolean(options?.disabled);

    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={({ pressed }) => [
          styles.smallButton,
          options?.filled
            ? styles.primarySmallButton
            : {
                borderColor,
                backgroundColor: inputBackground,
              },
          pressed && !disabled && styles.buttonPressed,
          disabled && styles.disabledButton,
        ]}
      >
        <ThemedText
          style={[
            styles.smallButtonText,
            options?.filled && styles.primarySmallButtonText,
            options?.danger && { color: Colors.universal.error },
          ]}
        >
          {label}
        </ThemedText>
      </Pressable>
    );
  };

  if (!isAdminUnlocked) {
    return (
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: colors.background }]}
        edges={["bottom"]}
      >
        <Stack.Screen options={{ headerTitle: "Video-Datenbank" }} />

        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            contentInsetAdjustmentBehavior="automatic"
          >
            <View style={styles.content}>
              <View style={styles.titleBlock}>
                <ThemedText type="title" style={styles.title}>
                  Passwort erforderlich
                </ThemedText>
                <ThemedText style={[styles.subtitle, { color: mutedTextColor }]}>
                  Bitte das Admin-Passwort eingeben.
                </ThemedText>
              </View>

              <View
                style={[
                  styles.panel,
                  {
                    backgroundColor: colors.contrast,
                    borderColor,
                  },
                ]}
              >
                <View style={styles.field}>
                  <ThemedText style={styles.label}>Passwort</ThemedText>
                  <TextInput
                    value={passwordValue}
                    onChangeText={(value) => {
                      setPasswordValue(value);
                      if (passwordFeedback) setPasswordFeedback(null);
                    }}
                    placeholder="Passwort"
                    placeholderTextColor={Colors.universal.grayedOut}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isPasswordChecking}
                    onSubmitEditing={() => void handleUnlockAdmin()}
                    style={[
                      styles.input,
                      {
                        backgroundColor: inputBackground,
                        borderColor,
                        color: colors.text,
                      },
                    ]}
                  />
                </View>

                {passwordFeedback ? (
                  <ThemedText
                    style={[styles.feedback, { color: Colors.universal.error }]}
                  >
                    {passwordFeedback}
                  </ThemedText>
                ) : null}

                <Pressable
                  onPress={() => void handleUnlockAdmin()}
                  disabled={isPasswordChecking}
                  style={({ pressed }) => [
                    styles.submitButton,
                    isPasswordChecking && styles.submitButtonDisabled,
                    pressed && !isPasswordChecking && styles.submitButtonPressed,
                  ]}
                >
                  {isPasswordChecking ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <ThemedText style={styles.submitButtonText}>
                      Entsperren
                    </ThemedText>
                  )}
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
      edges={["bottom"]}
    >
      <Stack.Screen options={{ headerTitle: "Video-Datenbank" }} />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="automatic"
        >
          <View style={styles.content}>
            <View style={styles.titleBlock}>
              <ThemedText type="title" style={styles.title}>
                Video-Datenbank
              </ThemedText>
              <ThemedText style={[styles.subtitle, { color: mutedTextColor }]}>
                Videos einfügen, Autoren verwalten und bestehende Einträge direkt
                bearbeiten.
              </ThemedText>
            </View>

            <View
              style={[
                styles.segmentedControl,
                {
                  backgroundColor: inputBackground,
                  borderColor,
                },
              ]}
            >
              {(["insert", "manage"] as ViewMode[]).map((viewMode) => {
                const active = mode === viewMode;

                return (
                  <Pressable
                    key={viewMode}
                    onPress={() => setMode(viewMode)}
                    style={({ pressed }) => [
                      styles.segmentButton,
                      active && styles.segmentButtonActive,
                      pressed && styles.buttonPressed,
                    ]}
                  >
                    <ThemedText
                      style={[
                        styles.segmentButtonText,
                        active && styles.segmentButtonTextActive,
                      ]}
                    >
                      {viewMode === "insert" ? "Einfügen" : "Verwalten"}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>

            {mode === "insert" ? (
              <>
                <View
                  style={[
                    styles.panel,
                    {
                      backgroundColor: colors.contrast,
                      borderColor,
                    },
                  ]}
                >
                  <ThemedText style={styles.panelTitle}>
                    Gemeinsame Werte
                  </ThemedText>

                  {sharedFieldDefinitions.map((field) => {
                    const isShared = sharedFields[field.key];

                    return (
                      <View
                        key={field.key}
                        style={[
                          styles.sharedField,
                          { borderBottomColor: mutedBorderColor },
                        ]}
                      >
                        <View style={styles.sharedFieldHeader}>
                          <View style={styles.sharedFieldTitleGroup}>
                            <ThemedText style={styles.label}>
                              {field.label}
                            </ThemedText>
                            <ThemedText
                              style={[
                                styles.helperText,
                                { color: mutedTextColor },
                              ]}
                            >
                              {isShared
                                ? "Gilt für alle Videos"
                                : "Wird pro Video gesetzt"}
                            </ThemedText>
                          </View>
                          <Switch
                            value={isShared}
                            onValueChange={() => toggleSharedField(field.key)}
                            disabled={isSubmitting}
                            trackColor={{
                              false: Colors.light.trackColor,
                              true: Colors.dark.trackColor,
                            }}
                            thumbColor={Colors[colorScheme].thumbColor}
                          />
                        </View>

                        {isShared ? (
                          <TextInput
                            value={sharedValues[field.key]}
                            onChangeText={(value) =>
                              updateSharedValue(field.key, value)
                            }
                            placeholder={field.placeholder}
                            placeholderTextColor={Colors.universal.grayedOut}
                            keyboardType={field.keyboardType}
                            autoCapitalize={field.autoCapitalize}
                            autoCorrect={field.autoCorrect}
                            editable={!isSubmitting}
                            style={[
                              styles.input,
                              {
                                backgroundColor: inputBackground,
                                borderColor,
                                color: colors.text,
                              },
                            ]}
                          />
                        ) : null}
                      </View>
                    );
                  })}
                </View>

                <View style={styles.videoHeaderRow}>
                  <ThemedText style={styles.panelTitle}>Videos</ThemedText>
                </View>

                {videos.map((video, index) => (
                  <View
                    key={video.id}
                    style={[
                      styles.panel,
                      styles.videoPanel,
                      {
                        backgroundColor: colors.contrast,
                        borderColor,
                      },
                    ]}
                  >
                    <View style={styles.videoPanelHeader}>
                      <ThemedText style={styles.videoTitle}>
                        Video {index + 1}
                      </ThemedText>
                      <Pressable
                        onPress={() => removeVideoRow(video.id)}
                        disabled={isSubmitting}
                        hitSlop={10}
                        style={({ pressed }) => [
                          styles.removeButton,
                          pressed && !isSubmitting && styles.buttonPressed,
                        ]}
                      >
                        <ThemedText style={styles.removeButtonText}>
                          ×
                        </ThemedText>
                      </Pressable>
                    </View>

                    {baseVideoFields.map((field) =>
                      renderInput(field, video[field.key], (value) =>
                        updateVideoField(video.id, field.key, value),
                      ),
                    )}

                    {sharedFieldDefinitions
                      .filter((field) => !sharedFields[field.key])
                      .map((field) =>
                        renderInput(field, video[field.key], (value) =>
                          updateVideoField(video.id, field.key, value),
                        ),
                      )}
                  </View>
                ))}

                <View style={styles.addVideoFooter}>
                  <Pressable
                    onPress={addVideoRow}
                    disabled={isSubmitting}
                    style={({ pressed }) => [
                      styles.iconButton,
                      {
                        borderColor,
                        backgroundColor: inputBackground,
                      },
                      pressed && !isSubmitting && styles.buttonPressed,
                      isSubmitting && styles.disabledButton,
                    ]}
                  >
                    <ThemedText style={styles.iconButtonText}>+</ThemedText>
                  </Pressable>
                </View>

                {feedback ? (
                  <ThemedText
                    style={[
                      styles.feedback,
                      feedback.type === "error"
                        ? { color: Colors.universal.error }
                        : { color: Colors.universal.primary },
                    ]}
                  >
                    {feedback.message}
                  </ThemedText>
                ) : null}

                <Pressable
                  onPress={handleSubmit}
                  disabled={isSubmitting}
                  style={({ pressed }) => [
                    styles.submitButton,
                    isSubmitting && styles.submitButtonDisabled,
                    pressed && !isSubmitting && styles.submitButtonPressed,
                  ]}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <ThemedText style={styles.submitButtonText}>
                      {videos.filter((video) => !isVideoRowEmpty(video)).length <=
                      1
                        ? "Video einfügen"
                        : "Videos einfügen"}
                    </ThemedText>
                  )}
                </Pressable>
              </>
            ) : (
              <>
                <View style={styles.managementHeaderRow}>
                  <View>
                    <ThemedText style={styles.panelTitle}>Verwalten</ThemedText>
                    <ThemedText
                      style={[styles.helperText, { color: mutedTextColor }]}
                    >
                      {managedVideos.length} Videos, {authors.length} Autoren,{" "}
                      {topicRows.length} Themen
                    </ThemedText>
                  </View>

                  {renderSmallButton(
                    isManagementLoading ? "Lädt..." : "Aktualisieren",
                    () => void loadManagementData(),
                    { disabled: isManagementLoading },
                  )}
                </View>

                {managementFeedback ? (
                  <ThemedText
                    style={[
                      styles.feedback,
                      managementFeedback.type === "error"
                        ? { color: Colors.universal.error }
                        : { color: Colors.universal.primary },
                    ]}
                  >
                    {managementFeedback.message}
                  </ThemedText>
                ) : null}

                {isManagementLoading && !managementLoaded ? (
                  <View
                    style={[
                      styles.panel,
                      styles.loadingPanel,
                      {
                        backgroundColor: colors.contrast,
                        borderColor,
                      },
                    ]}
                  >
                    <ActivityIndicator color={Colors.universal.primary} />
                    <ThemedText style={styles.helperText}>
                      Daten werden geladen...
                    </ThemedText>
                  </View>
                ) : (
                  <>
                    <View
                      style={[
                        styles.panel,
                        {
                          backgroundColor: colors.contrast,
                          borderColor,
                        },
                      ]}
                    >
                      <View style={styles.sectionHeaderRow}>
                        <ThemedText style={styles.panelTitle}>
                          Autoren
                        </ThemedText>
                        <ThemedText
                          style={[styles.helperText, { color: mutedTextColor }]}
                        >
                          {authors.length} Einträge
                        </ThemedText>
                      </View>

                      <View style={styles.inlineForm}>
                        <TextInput
                          value={newAuthorName}
                          onChangeText={(value) => {
                            setNewAuthorName(value);
                            if (managementFeedback) setManagementFeedback(null);
                          }}
                          placeholder="Neuen Autor hinzufügen"
                          placeholderTextColor={Colors.universal.grayedOut}
                          editable={!operationDisabled}
                          style={[
                            styles.input,
                            styles.inlineInput,
                            {
                              backgroundColor: inputBackground,
                              borderColor,
                              color: colors.text,
                            },
                          ]}
                        />
                        {renderSmallButton("Hinzufügen", handleAddAuthor, {
                          filled: true,
                          disabled: operationDisabled,
                        })}
                      </View>

                      <View style={styles.list}>
                        {authors.map((author) => {
                          const isEditing = editingAuthorId === author.id;
                          const videoCount =
                            authorVideoCounts.get(author.author_name) ?? 0;

                          return (
                            <View
                              key={author.id}
                              style={[
                                styles.listRow,
                                { borderBottomColor: mutedBorderColor },
                              ]}
                            >
                              {isEditing ? (
                                <View style={styles.rowEditContent}>
                                  <TextInput
                                    value={authorDraftName}
                                    onChangeText={setAuthorDraftName}
                                    placeholder="Autorenname"
                                    placeholderTextColor={
                                      Colors.universal.grayedOut
                                    }
                                    editable={!operationDisabled}
                                    style={[
                                      styles.input,
                                      {
                                        backgroundColor: inputBackground,
                                        borderColor,
                                        color: colors.text,
                                      },
                                    ]}
                                  />
                                  <View style={styles.buttonRow}>
                                    {renderSmallButton(
                                      "Speichern",
                                      () => void handleSaveAuthor(author),
                                      {
                                        filled: true,
                                        disabled: operationDisabled,
                                      },
                                    )}
                                    {renderSmallButton(
                                      "Abbrechen",
                                      cancelEditAuthor,
                                      { disabled: operationDisabled },
                                    )}
                                  </View>
                                </View>
                              ) : (
                                <>
                                  <View style={styles.rowTextContent}>
                                    <ThemedText style={styles.rowTitle}>
                                      {author.author_name}
                                    </ThemedText>
                                    <ThemedText
                                      style={[
                                        styles.helperText,
                                        { color: mutedTextColor },
                                      ]}
                                    >
                                      {author.source === "authors"
                                        ? `ID ${author.id}`
                                        : "Aus Videos"}{" "}
                                      - {videoCount} Video
                                      {videoCount === 1 ? "" : "s"}
                                    </ThemedText>
                                  </View>
                                  <View style={styles.buttonRow}>
                                    {renderSmallButton(
                                      "Bearbeiten",
                                      () => startEditAuthor(author),
                                      { disabled: operationDisabled },
                                    )}
                                    {renderSmallButton(
                                      "Löschen",
                                      () => void handleDeleteAuthor(author),
                                      {
                                        danger: true,
                                        disabled: operationDisabled,
                                      },
                                    )}
                                  </View>
                                </>
                              )}
                            </View>
                          );
                        })}

                        {authors.length === 0 ? (
                          <ThemedText
                            style={[styles.helperText, { color: mutedTextColor }]}
                          >
                            Noch keine Autoren vorhanden.
                          </ThemedText>
                        ) : null}
                      </View>
                    </View>

                    <View
                      style={[
                        styles.panel,
                        {
                          backgroundColor: colors.contrast,
                          borderColor,
                        },
                      ]}
                    >
                      <View style={styles.sectionHeaderRow}>
                        <ThemedText style={styles.panelTitle}>Themen</ThemedText>
                        <ThemedText
                          style={[styles.helperText, { color: mutedTextColor }]}
                        >
                          {topicRows.length} Einträge
                        </ThemedText>
                      </View>

                      <View style={styles.topicGrid}>
                        {topicRows.map((topicRow) => {
                          const active = selectedTopic === topicRow.topic;

                          return (
                            <Pressable
                              key={topicRow.topic}
                              onPress={() => handleSelectTopic(topicRow.topic)}
                              disabled={operationDisabled}
                              style={({ pressed }) => [
                                styles.topicPill,
                                {
                                  borderColor: active
                                    ? Colors.universal.primary
                                    : borderColor,
                                  backgroundColor: active
                                    ? "rgba(46,168,83,0.16)"
                                    : inputBackground,
                                },
                                pressed && !operationDisabled && styles.buttonPressed,
                              ]}
                            >
                              <ThemedText style={styles.topicPillText}>
                                {topicRow.topic} ({topicRow.count})
                              </ThemedText>
                            </Pressable>
                          );
                        })}

                        {topicRows.length === 0 ? (
                          <ThemedText
                            style={[styles.helperText, { color: mutedTextColor }]}
                          >
                            Noch keine Themen vorhanden.
                          </ThemedText>
                        ) : null}
                      </View>

                      <View style={styles.inlineForm}>
                        <TextInput
                          value={topicDraftName}
                          onChangeText={setTopicDraftName}
                          placeholder="Thema auswählen oder neuen Namen schreiben"
                          placeholderTextColor={Colors.universal.grayedOut}
                          editable={!operationDisabled && Boolean(selectedTopic)}
                          style={[
                            styles.input,
                            styles.inlineInput,
                            {
                              backgroundColor: inputBackground,
                              borderColor,
                              color: colors.text,
                            },
                          ]}
                        />
                        {renderSmallButton("Umbenennen", () => void handleRenameTopic(), {
                          filled: true,
                          disabled: operationDisabled || !selectedTopic,
                        })}
                        {renderSmallButton("Entfernen", () => void handleRemoveTopic(), {
                          danger: true,
                          disabled: operationDisabled || !selectedTopic,
                        })}
                      </View>
                    </View>

                    <View
                      style={[
                        styles.panel,
                        {
                          backgroundColor: colors.contrast,
                          borderColor,
                        },
                      ]}
                    >
                      <View style={styles.sectionHeaderRow}>
                        <ThemedText style={styles.panelTitle}>Videos</ThemedText>
                        <ThemedText
                          style={[styles.helperText, { color: mutedTextColor }]}
                        >
                          {filteredManagedVideos.length} von {managedVideos.length}
                        </ThemedText>
                      </View>

                      <TextInput
                        value={managementSearch}
                        onChangeText={setManagementSearch}
                        placeholder="Suchen nach Titel, Autor, Thema, Sprache oder ID"
                        placeholderTextColor={Colors.universal.grayedOut}
                        editable={!operationDisabled}
                        style={[
                          styles.input,
                          {
                            backgroundColor: inputBackground,
                            borderColor,
                            color: colors.text,
                          },
                        ]}
                      />

                      {selectedTopic ? (
                        <View style={styles.activeFilterRow}>
                          <ThemedText
                            style={[styles.helperText, { color: mutedTextColor }]}
                          >
                            Kategorie: {selectedTopic}
                          </ThemedText>
                          {renderSmallButton("Alle anzeigen", () => {
                            setSelectedTopic(null);
                            setTopicDraftName("");
                          })}
                        </View>
                      ) : null}

                      <View style={styles.list}>
                        {filteredManagedVideos.map((video) => {
                          const isEditing = editingVideoId === video.id;
                          const topics = getVideoTopicNames(video);

                          return (
                            <View
                              key={video.id}
                              style={[
                                styles.listRow,
                                styles.videoListRow,
                                { borderBottomColor: mutedBorderColor },
                              ]}
                            >
                              {isEditing ? (
                                <View style={styles.rowEditContent}>
                                  {managedVideoFieldDefinitions.map((field) =>
                                    renderInput(
                                      field,
                                      videoDraft[field.key],
                                      (value) =>
                                        updateVideoDraft(field.key, value),
                                      !operationDisabled,
                                    ),
                                  )}
                                  <View style={styles.buttonRow}>
                                    {renderSmallButton(
                                      "Speichern",
                                      () => void handleSaveVideo(video.id),
                                      {
                                        filled: true,
                                        disabled: operationDisabled,
                                      },
                                    )}
                                    {renderSmallButton(
                                      "Abbrechen",
                                      cancelEditVideo,
                                      { disabled: operationDisabled },
                                    )}
                                  </View>
                                </View>
                              ) : (
                                <>
                                  <View style={styles.rowTextContent}>
                                    <ThemedText style={styles.rowTitle}>
                                      {video.title}
                                    </ThemedText>
                                    <ThemedText
                                      style={[
                                        styles.helperText,
                                        { color: mutedTextColor },
                                      ]}
                                    >
                                      ID {video.id}
                                      {video.author_name
                                        ? ` - ${video.author_name}`
                                        : ""}
                                      {video.language_code
                                        ? ` - ${video.language_code}`
                                        : ""}
                                    </ThemedText>
                                    <ThemedText
                                      style={[
                                        styles.helperText,
                                        { color: mutedTextColor },
                                      ]}
                                      numberOfLines={2}
                                    >
                                      {topics.length > 0
                                        ? topics.join(", ")
                                        : "Kein Thema"}
                                    </ThemedText>
                                  </View>
                                  <View style={styles.buttonRow}>
                                    {renderSmallButton(
                                      "Bearbeiten",
                                      () => startEditVideo(video),
                                      { disabled: operationDisabled },
                                    )}
                                    {renderSmallButton(
                                      "Löschen",
                                      () => void handleDeleteVideo(video),
                                      {
                                        danger: true,
                                        disabled: operationDisabled,
                                      },
                                    )}
                                  </View>
                                </>
                              )}
                            </View>
                          );
                        })}

                        {filteredManagedVideos.length === 0 ? (
                          <ThemedText
                            style={[styles.helperText, { color: mutedTextColor }]}
                          >
                            Keine Videos gefunden.
                          </ThemedText>
                        ) : null}
                      </View>
                    </View>
                  </>
                )}
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
    paddingBottom: 32,
  },
  content: {
    width: "100%",
    maxWidth: 880,
    alignSelf: "center",
    gap: 16,
  },
  titleBlock: {
    gap: 6,
  },
  title: {
    fontSize: 26,
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  segmentedControl: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 8,
    padding: 4,
    flexDirection: "row",
    gap: 4,
  },
  segmentButton: {
    flex: 1,
    minHeight: 38,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  segmentButtonActive: {
    backgroundColor: Colors.universal.primary,
  },
  segmentButtonText: {
    fontSize: 14,
    fontWeight: "700",
  },
  segmentButtonTextActive: {
    color: "#fff",
  },
  panel: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    gap: 14,
  },
  panelTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700",
  },
  sectionHeaderRow: {
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  sharedField: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: 14,
    gap: 10,
  },
  sharedFieldHeader: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
  },
  sharedFieldTitleGroup: {
    flex: 1,
    gap: 3,
  },
  field: {
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
  },
  helperText: {
    fontSize: 13,
    lineHeight: 18,
  },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "web" ? 10 : 8,
    fontSize: 16,
  },
  inlineInput: {
    flex: 1,
    minWidth: 220,
  },
  videoHeaderRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  addVideoFooter: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  iconButton: {
    width: 40,
    height: 40,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  iconButtonText: {
    fontSize: 25,
    lineHeight: 28,
    fontWeight: "500",
  },
  videoPanel: {
    gap: 14,
  },
  videoPanelHeader: {
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  videoTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700",
  },
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  removeButtonText: {
    color: Colors.universal.error,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "500",
  },
  buttonPressed: {
    opacity: 0.72,
  },
  feedback: {
    fontSize: 14,
    lineHeight: 20,
  },
  submitButton: {
    minHeight: 48,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.universal.primary,
  },
  submitButtonPressed: {
    opacity: 0.84,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  managementHeaderRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  loadingPanel: {
    minHeight: 120,
    alignItems: "center",
    justifyContent: "center",
  },
  inlineForm: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  activeFilterRow: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
  },
  list: {
    gap: 0,
  },
  listRow: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  videoListRow: {
    alignItems: "flex-start",
  },
  rowTextContent: {
    flex: 1,
    gap: 4,
    minWidth: 180,
  },
  rowEditContent: {
    flex: 1,
    gap: 12,
  },
  rowTitle: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "700",
  },
  buttonRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    flexWrap: "wrap",
  },
  smallButton: {
    minHeight: 36,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  smallButtonText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  primarySmallButton: {
    borderColor: Colors.universal.primary,
    backgroundColor: Colors.universal.primary,
  },
  primarySmallButtonText: {
    color: "#fff",
  },
  disabledButton: {
    opacity: 0.55,
  },
  topicGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  topicPill: {
    minHeight: 34,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  topicPillText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
});
