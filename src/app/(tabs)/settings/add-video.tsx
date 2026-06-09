import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useQueryClient } from "@tanstack/react-query";
import { Stack } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
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

import { supabase } from "../../../../utils/supabase";
import { getYoutubeVideoId, parseYoutubeTime } from "../../../../utils/youtube";

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

type Feedback = {
  type: "error" | "success";
  message: string;
};

type VideoInsertPayload = {
  title: string;
  youtube_url: string;
  language_code: string | null;
  video_topic: string | null;
  author_name: string | null;
  start_time: number | null;
  end_time: number | null;
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

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return "Die Videos konnten nicht eingefügt werden.";
}

function getDuplicateKey(title: string, authorName: string | null) {
  return `${authorName ?? "NO_AUTHOR"}::${title.toLocaleLowerCase("de")}`;
}

export default function AddVideo() {
  const colorScheme = useColorScheme();
  const queryClient = useQueryClient();
  const [sharedValues, setSharedValues] =
    useState<SharedValues>(initialSharedValues);
  const [sharedFields, setSharedFields] =
    useState<SharedFieldState>(initialSharedFields);
  const [videos, setVideos] = useState<VideoRow[]>(() => [createVideoRow()]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const colors = Colors[colorScheme];
  const borderColor =
    colorScheme === "dark" ? "rgba(255,255,255,0.16)" : "rgba(17,24,28,0.14)";
  const mutedBorderColor =
    colorScheme === "dark" ? "rgba(255,255,255,0.1)" : "rgba(17,24,28,0.08)";
  const inputBackground =
    colorScheme === "dark" ? "rgba(255,255,255,0.07)" : "#fff";
  const mutedTextColor =
    colorScheme === "dark" ? "rgba(236,237,238,0.68)" : "rgba(17,24,28,0.62)";

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
      const title = video.title.trim();
      const youtubeUrl = video.youtubeUrl.trim();
      const authorName = optionalText(getResolvedValue(video, "authorName"));
      const languageCode =
        optionalText(getResolvedValue(video, "languageCode"))?.toLowerCase() ??
        null;
      const videoTopic = optionalText(getResolvedValue(video, "videoTopic"));

      if (!title || !youtubeUrl) {
        throw new Error(`${rowLabel}: Titel und YouTube URL sind Pflicht.`);
      }

      if (!getYoutubeVideoId(youtubeUrl)) {
        throw new Error(`${rowLabel}: Bitte eine gültige YouTube URL eintragen.`);
      }

      const startTime = parseOptionalTime(
        getResolvedValue(video, "startTime"),
        `${rowLabel} Startzeit`,
      );
      const endTime = parseOptionalTime(
        getResolvedValue(video, "endTime"),
        `${rowLabel} Endzeit`,
      );

      if (startTime !== null && endTime !== null && endTime <= startTime) {
        throw new Error(`${rowLabel}: Die Endzeit muss größer sein als die Startzeit.`);
      }

      const duplicateKey = getDuplicateKey(title, authorName);
      if (seenVideos.has(duplicateKey)) {
        throw new Error(`${rowLabel}: Dieser Titel ist für denselben Autor doppelt.`);
      }
      seenVideos.add(duplicateKey);

      return {
        title,
        authorName,
        payload: {
          title,
          youtube_url: youtubeUrl,
          language_code: languageCode,
          video_topic: videoTopic,
          author_name: authorName,
          start_time: startTime,
          end_time: endTime,
        },
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

      const { data: duplicateRows, error: duplicateError } =
        await duplicateRequest;

      if (duplicateError) throw duplicateError;

      if ((duplicateRows ?? []).length > 0) {
        throw new Error(
          `"${video.title}" existiert bereits für denselben Autor.`,
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
      setFeedback({ type: "error", message: getErrorMessage(error) });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      await assertNoExistingDuplicates(preparedVideos);

      const { data: insertedVideos, error: insertError } = await supabase
        .from("videos")
        .insert(preparedVideos.map((video) => video.payload))
        .select("id");

      if (insertError) throw insertError;

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["videos"] }),
        queryClient.invalidateQueries({ queryKey: ["video_filter_pairs"] }),
        queryClient.invalidateQueries({ queryKey: ["video_languages"] }),
      ]);

      const insertedCount = insertedVideos?.length ?? preparedVideos.length;
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
      const message = getErrorMessage(error);
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

  const renderInput = (
    field: FieldDefinition<VideoFieldKey>,
    value: string,
    onChangeText: (value: string) => void,
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
    </View>
  );

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
      edges={["bottom"]}
    >
      <Stack.Screen options={{ headerTitle: "Videos einfügen" }} />

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
                Videos einfügen
              </ThemedText>
              <ThemedText style={[styles.subtitle, { color: mutedTextColor }]}>
                Nutze die Switches, um festzulegen, welche Werte für alle Videos
                gleich bleiben.
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
              <ThemedText style={styles.panelTitle}>Gemeinsame Werte</ThemedText>

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
                        <ThemedText style={styles.label}>{field.label}</ThemedText>
                        <ThemedText
                          style={[styles.helperText, { color: mutedTextColor }]}
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
                ]}
              >
                <ThemedText style={styles.iconButtonText}>+</ThemedText>
              </Pressable>
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
                    <ThemedText style={styles.removeButtonText}>×</ThemedText>
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
                  {videos.filter((video) => !isVideoRowEmpty(video)).length <= 1
                    ? "Video einfügen"
                    : "Videos einfügen"}
                </ThemedText>
              )}
            </Pressable>
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
    maxWidth: 720,
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
  videoHeaderRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
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
});
