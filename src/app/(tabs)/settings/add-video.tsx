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
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import { useLanguage } from "../../../../contexts/LanguageContext";
import { supabase } from "../../../../utils/supabase";
import {
  getYoutubeVideoId,
  parseYoutubeTime,
} from "../../../../utils/youtube";

type FormState = {
  title: string;
  youtubeUrl: string;
  languageCode: string;
  videoTopic: string;
  authorName: string;
  startTime: string;
  endTime: string;
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

const initialFormState: FormState = {
  title: "",
  youtubeUrl: "",
  languageCode: "",
  videoTopic: "",
  authorName: "",
  startTime: "",
  endTime: "",
};

const fields: {
  key: keyof FormState;
  label: string;
  placeholder: string;
  required?: boolean;
  keyboardType?: TextInputProps["keyboardType"];
  autoCapitalize?: TextInputProps["autoCapitalize"];
  autoCorrect?: boolean;
  multiline?: boolean;
}[] = [
  {
    key: "title",
    label: "Title",
    placeholder: "Video title",
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
  {
    key: "authorName",
    label: "Author",
    placeholder: "Existing author_name",
  },
  {
    key: "languageCode",
    label: "Language code",
    placeholder: "de, en, ar",
    autoCapitalize: "none",
    autoCorrect: false,
  },
  {
    key: "videoTopic",
    label: "Topic",
    placeholder: "Topic name",
  },
  {
    key: "startTime",
    label: "Start time",
    placeholder: "Seconds or 01:23",
  },
  {
    key: "endTime",
    label: "End time",
    placeholder: "Seconds or 12:34",
  },
];

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseOptionalTime(value: string, label: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const seconds = parseYoutubeTime(trimmed);
  if (seconds === undefined) {
    throw new Error(`${label} must be seconds or a time like 01:23.`);
  }

  return seconds;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return "Could not insert the video.";
}

export default function AddVideo() {
  const colorScheme = useColorScheme();
  const queryClient = useQueryClient();
  const { rtl } = useLanguage();
  const [form, setForm] = useState<FormState>(initialFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const colors = Colors[colorScheme];
  const borderColor =
    colorScheme === "dark" ? "rgba(255,255,255,0.16)" : "rgba(17,24,28,0.14)";
  const inputBackground =
    colorScheme === "dark" ? "rgba(255,255,255,0.07)" : "#fff";

  const updateField = (key: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (feedback) setFeedback(null);
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;

    const title = form.title.trim();
    const youtubeUrl = form.youtubeUrl.trim();
    const authorName = optionalText(form.authorName);
    const languageCode = optionalText(form.languageCode)?.toLowerCase() ?? null;
    const videoTopic = optionalText(form.videoTopic);

    if (!title || !youtubeUrl) {
      setFeedback({
        type: "error",
        message: "Title and YouTube URL are required.",
      });
      return;
    }

    if (!getYoutubeVideoId(youtubeUrl)) {
      setFeedback({
        type: "error",
        message: "Please enter a valid YouTube URL or video ID.",
      });
      return;
    }

    let startTime: number | null;
    let endTime: number | null;
    try {
      startTime = parseOptionalTime(form.startTime, "Start time");
      endTime = parseOptionalTime(form.endTime, "End time");
    } catch (error) {
      setFeedback({ type: "error", message: getErrorMessage(error) });
      return;
    }

    if (startTime !== null && endTime !== null && endTime <= startTime) {
      setFeedback({
        type: "error",
        message: "End time must be greater than start time.",
      });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      let duplicateRequest = supabase
        .from("videos")
        .select("id")
        .eq("title", title)
        .limit(1);

      duplicateRequest = authorName
        ? duplicateRequest.eq("author_name", authorName)
        : duplicateRequest.is("author_name", null);

      const { data: duplicateRows, error: duplicateError } =
        await duplicateRequest;

      if (duplicateError) throw duplicateError;

      if ((duplicateRows ?? []).length > 0) {
        setFeedback({
          type: "error",
          message: "This title already exists for the same author.",
        });
        return;
      }

      const payload: VideoInsertPayload = {
        title,
        youtube_url: youtubeUrl,
        language_code: languageCode,
        video_topic: videoTopic,
        author_name: authorName,
        start_time: startTime,
        end_time: endTime,
      };

      const { data: insertedVideo, error: insertError } = await supabase
        .from("videos")
        .insert(payload)
        .select("id")
        .single();

      if (insertError) throw insertError;

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["videos"] }),
        queryClient.invalidateQueries({ queryKey: ["video_filter_pairs"] }),
        queryClient.invalidateQueries({ queryKey: ["video_languages"] }),
      ]);

      const message = `Inserted video #${insertedVideo.id}.`;
      setForm(initialFormState);
      setFeedback({ type: "success", message });
      Toast.show({
        type: "success",
        text1: "Video inserted",
        text2: message,
      });
    } catch (error) {
      const message = getErrorMessage(error);
      setFeedback({ type: "error", message });
      Toast.show({
        type: "error",
        text1: "Insert failed",
        text2: message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
      edges={["bottom"]}
    >
      <Stack.Screen options={{ headerTitle: "Insert video" }} />

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
            <ThemedText
              type="title"
              style={[
                styles.title,
                rtl && {
                  textAlign: "right",
                  writingDirection: "rtl",
                },
              ]}
            >
              Insert video
            </ThemedText>

            <View
              style={[
                styles.form,
                {
                  backgroundColor: colors.contrast,
                  borderColor,
                },
              ]}
            >
              {fields.map((field) => (
                <View key={field.key} style={styles.field}>
                  <ThemedText
                    style={[
                      styles.label,
                      rtl && {
                        textAlign: "right",
                        writingDirection: "rtl",
                      },
                    ]}
                  >
                    {field.label}
                    {field.required ? " *" : ""}
                  </ThemedText>
                  <TextInput
                    value={form[field.key]}
                    onChangeText={(value) => updateField(field.key, value)}
                    placeholder={field.placeholder}
                    placeholderTextColor={Colors.universal.grayedOut}
                    keyboardType={field.keyboardType}
                    autoCapitalize={field.autoCapitalize}
                    autoCorrect={field.autoCorrect}
                    multiline={field.multiline}
                    editable={!isSubmitting}
                    style={[
                      styles.input,
                      {
                        backgroundColor: inputBackground,
                        borderColor,
                        color: colors.text,
                      },
                      rtl && {
                        textAlign: "right",
                        writingDirection: "rtl",
                      },
                    ]}
                  />
                </View>
              ))}

              {feedback ? (
                <ThemedText
                  style={[
                    styles.feedback,
                    feedback.type === "error"
                      ? { color: Colors.universal.error }
                      : { color: Colors.universal.primary },
                    rtl && { textAlign: "right", writingDirection: "rtl" },
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
                    Insert video
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
    maxWidth: 640,
    alignSelf: "center",
    gap: 16,
  },
  title: {
    fontSize: 26,
    lineHeight: 32,
  },
  form: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    gap: 14,
  },
  field: {
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
  },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "web" ? 10 : 8,
    fontSize: 16,
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
    marginTop: 2,
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
