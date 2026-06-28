import type {
  TopicCategoryType,
  TopicSubcategoryType,
  TopicType,
  VideoType,
} from "@/constants/Types";

export const VIDEO_WITH_TOPICS_SELECT = `
  id,
  title,
  youtube_url,
  created_at,
  language_code,
  author_name,
  start_time,
  end_time,
  video_category_assignments (
    id,
    category_id,
    subcategory_id,
    topic_categories (
      id,
      name
    ),
    topic_subcategories (
      id,
      category_id,
      name
    )
  )
`;

export const TOPIC_WITH_PARENT_SELECT = `
  id,
  name,
  topic_subcategories (
    id,
    category_id,
    name
  )
`;

export type TopicInput = {
  name: string;
  parentName: string | null;
  label: string;
};

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
      // Invalid JSON - treat as plain string.
    }
  }

  return trimmed
    .split(",")
    .map((topic) => topic.trim())
    .filter(Boolean);
}

function firstRelationValue(value: unknown) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function relationArray(value: unknown) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function maybeCategory(value: unknown): TopicCategoryType | null {
  if (!value || typeof value !== "object") return null;

  const category = value as {
    id?: unknown;
    name?: unknown;
  };

  if (typeof category.name !== "string") return null;

  return {
    id: typeof category.id === "number" ? category.id : 0,
    name: category.name.trim(),
  };
}

function maybeSubcategory(value: unknown): TopicSubcategoryType | null {
  if (!value || typeof value !== "object") return null;

  const subcategory = value as {
    id?: unknown;
    category_id?: unknown;
    name?: unknown;
  };

  if (typeof subcategory.name !== "string") return null;

  return {
    id: typeof subcategory.id === "number" ? subcategory.id : 0,
    category_id:
      typeof subcategory.category_id === "number" ? subcategory.category_id : 0,
    name: subcategory.name.trim(),
  };
}

function makeCategoryTopic(category: TopicCategoryType): TopicType {
  return {
    key: `category:${category.id || category.name.toLocaleLowerCase("de")}`,
    id: category.id,
    name: category.name,
    category_id: category.id,
    subcategory_id: null,
    category: null,
  };
}

function makeSubcategoryTopic(
  category: TopicCategoryType,
  subcategory: TopicSubcategoryType,
): TopicType {
  return {
    key: `subcategory:${category.id || category.name.toLocaleLowerCase("de")}:${
      subcategory.id || subcategory.name.toLocaleLowerCase("de")
    }`,
    id: subcategory.id,
    name: subcategory.name,
    category_id: category.id || subcategory.category_id,
    subcategory_id: subcategory.id || null,
    category,
  };
}

export function normalizeTopicRow(row: unknown): TopicType | null {
  const category = maybeCategory(row);
  return category ? makeCategoryTopic(category) : null;
}

export function normalizeTopicRows(rows: unknown[] | null | undefined) {
  const topics: TopicType[] = [];

  for (const row of rows ?? []) {
    const category = maybeCategory(row);
    if (!category) continue;

    topics.push(makeCategoryTopic(category));

    const rawSubcategories =
      row && typeof row === "object"
        ? (row as { topic_subcategories?: unknown }).topic_subcategories
        : null;

    for (const subcategoryRow of relationArray(rawSubcategories)) {
      const subcategory = maybeSubcategory(subcategoryRow);
      if (!subcategory) continue;
      topics.push(makeSubcategoryTopic(category, subcategory));
    }
  }

  return dedupeTopics(topics);
}

function topicFromVideoCategoryAssignment(value: unknown): TopicType | null {
  if (!value || typeof value !== "object") return null;

  const relation = value as {
    topic_categories?: unknown;
    topic_subcategories?: unknown;
  };
  const category = maybeCategory(firstRelationValue(relation.topic_categories));
  if (!category) return null;

  const subcategory = maybeSubcategory(
    firstRelationValue(relation.topic_subcategories),
  );

  return subcategory
    ? makeSubcategoryTopic(category, subcategory)
    : makeCategoryTopic(category);
}

function dedupeTopics(topics: TopicType[]) {
  const seen = new Set<string>();
  const uniqueTopics: TopicType[] = [];

  for (const topic of topics) {
    const name = topic.name.trim();
    if (!name) continue;

    const key = topic.key || getTopicDisplayName(topic).toLocaleLowerCase("de");
    if (seen.has(key)) continue;

    seen.add(key);
    uniqueTopics.push({ ...topic, name });
  }

  return uniqueTopics;
}

export function normalizeVideoRow(row: unknown): VideoType {
  const video = (row ?? {}) as Record<string, unknown>;
  const relationTopics = Array.isArray(video.video_category_assignments)
    ? dedupeTopics(
        video.video_category_assignments
          .map(topicFromVideoCategoryAssignment)
          .filter((topic): topic is TopicType => Boolean(topic)),
      )
    : [];

  return {
    ...(video as unknown as VideoType),
    topics: relationTopics,
  };
}

export function normalizeVideoRows(rows: unknown[] | null | undefined) {
  return (rows ?? []).map(normalizeVideoRow);
}

export function getVideoTopicNames(video: {
  topics?: TopicType[] | null;
}) {
  return Array.isArray(video.topics)
    ? video.topics
        .map(getTopicDisplayName)
        .filter((topic) => topic.length > 0)
    : [];
}

export function getVideoTopics(video: {
  topics?: TopicType[] | null;
}) {
  return Array.isArray(video.topics) ? video.topics : [];
}

export function getTopicDisplayName(topic: {
  name: string;
  category?: { name: string } | null;
}) {
  const name = topic.name.trim();
  const categoryName = topic.category?.name.trim();

  return categoryName ? `${categoryName} > ${name}` : name;
}

export function parseTopicInput(rawTopic: string): TopicInput | null {
  const parts = rawTopic
    .split(/\s*(?:>|›|->)\s*/u)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) return null;

  const name = parts[parts.length - 1];
  const parentName =
    parts.length > 1 ? parts.slice(0, parts.length - 1).join(" > ") : null;
  const label = parentName ? `${parentName} > ${name}` : name;

  return { name, parentName, label };
}

export function parseTopicInputs(raw: unknown): TopicInput[] {
  const seen = new Set<string>();
  const inputs: TopicInput[] = [];

  for (const topic of parseTopics(raw)) {
    const parsed = parseTopicInput(topic);
    if (!parsed) continue;

    const key = parsed.label.toLocaleLowerCase("de");
    if (seen.has(key)) continue;

    seen.add(key);
    inputs.push(parsed);
  }

  const parentNamesWithChildren = new Set(
    inputs
      .map((input) => input.parentName)
      .filter((parentName): parentName is string => Boolean(parentName))
      .map((parentName) => parentName.toLocaleLowerCase("de")),
  );

  return inputs.filter((input) => {
    if (input.parentName) return true;
    return !parentNamesWithChildren.has(input.name.toLocaleLowerCase("de"));
  });
}

export function matchesTopic(videoOrRawTopic: unknown, topic: string): boolean {
  if (
    videoOrRawTopic &&
    typeof videoOrRawTopic === "object" &&
    "topics" in videoOrRawTopic
  ) {
    return getVideoTopicNames(
      videoOrRawTopic as {
        topics?: TopicType[] | null;
      },
    ).includes(topic);
  }

  return parseTopics(videoOrRawTopic).includes(topic);
}
