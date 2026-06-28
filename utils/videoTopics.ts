import type { TopicType, VideoType } from "@/constants/Types";

export const VIDEO_WITH_TOPICS_SELECT = `
  id,
  title,
  youtube_url,
  created_at,
  language_code,
  author_name,
  start_time,
  end_time,
  video_topics (
    topic_id,
    topics (
      id,
      name,
      parent_topic_id
    )
  )
`;

export function parseTopics(raw: unknown): string[] {
  if (!raw) return [];

  if (Array.isArray(raw)) {
    return raw
      .flatMap((topic) => String(topic).split(","))
      .map((topic) => topic.trim())
      .filter(Boolean);
  }

  if (typeof raw !== "string") {
    return [];
  }

  const trimmed = raw.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .flatMap((topic) => String(topic).split(","))
          .map((topic) => topic.trim())
          .filter(Boolean);
      }
    } catch {
      // Invalid JSON — treat as plain string
    }
  }

  return trimmed
    .split(",")
    .map((topic) => topic.trim())
    .filter(Boolean);
}

function maybeTopic(value: unknown): TopicType | null {
  if (!value || typeof value !== "object") return null;

  const topic = value as {
    id?: unknown;
    name?: unknown;
    parent_topic_id?: unknown;
  };

  if (typeof topic.name !== "string") return null;

  return {
    id: typeof topic.id === "number" ? topic.id : 0,
    name: topic.name.trim(),
    parent_topic_id:
      typeof topic.parent_topic_id === "number" ? topic.parent_topic_id : null,
  };
}

function topicFromVideoTopicRelation(value: unknown): TopicType | null {
  if (!value || typeof value !== "object") return null;

  const relation = value as {
    topics?: unknown;
  };

  if (Array.isArray(relation.topics)) {
    return maybeTopic(relation.topics[0]);
  }

  return maybeTopic(relation.topics);
}

function dedupeTopics(topics: TopicType[]) {
  const seen = new Set<string>();
  const uniqueTopics: TopicType[] = [];

  for (const topic of topics) {
    const name = topic.name.trim();
    if (!name) continue;

    const key = topic.id > 0 ? `id:${topic.id}` : `name:${name}`;
    if (seen.has(key)) continue;

    seen.add(key);
    uniqueTopics.push({ ...topic, name });
  }

  return uniqueTopics;
}

export function normalizeVideoRow(row: unknown): VideoType {
  const video = (row ?? {}) as Record<string, unknown>;
  const relationTopics = Array.isArray(video.video_topics)
    ? dedupeTopics(
        video.video_topics
          .map(topicFromVideoTopicRelation)
          .filter((topic): topic is TopicType => Boolean(topic)),
      )
    : [];
  const legacyTopicNames = parseTopics(video.video_topic);
  const topicNames =
    relationTopics.length > 0
      ? relationTopics.map((topic) => topic.name)
      : legacyTopicNames;

  return {
    ...(video as unknown as VideoType),
    video_topic: topicNames.length > 0 ? topicNames.join(", ") : null,
    topics: relationTopics,
  };
}

export function normalizeVideoRows(rows: unknown[] | null | undefined) {
  return (rows ?? []).map(normalizeVideoRow);
}

export function getVideoTopicNames(video: {
  video_topic?: unknown;
  topics?: TopicType[] | null;
}) {
  const relationTopics = Array.isArray(video.topics)
    ? video.topics
        .map((topic) => topic.name.trim())
        .filter((topic) => topic.length > 0)
    : [];

  return relationTopics.length > 0
    ? relationTopics
    : parseTopics(video.video_topic);
}

export function getVideoTopics(video: {
  video_topic?: unknown;
  topics?: TopicType[] | null;
}) {
  if (Array.isArray(video.topics) && video.topics.length > 0) {
    return video.topics;
  }

  return parseTopics(video.video_topic).map((name) => ({
    id: 0,
    name,
    parent_topic_id: null,
  }));
}

export function matchesTopic(videoOrRawTopic: unknown, topic: string): boolean {
  if (
    videoOrRawTopic &&
    typeof videoOrRawTopic === "object" &&
    ("topics" in videoOrRawTopic || "video_topic" in videoOrRawTopic)
  ) {
    return getVideoTopicNames(
      videoOrRawTopic as {
        video_topic?: unknown;
        topics?: TopicType[] | null;
      },
    ).includes(topic);
  }

  return parseTopics(videoOrRawTopic).includes(topic);
}
