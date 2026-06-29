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
  category,
  subcategory
`;

export const CATEGORY_SELECT = "id, name";
export const SUBCATEGORY_SELECT = "id, name";

export type TopicInput = {
  categoryName: string | null;
  subcategoryName: string | null;
  label: string | null;
};

export function parseTopics(raw: unknown): string[] {
  if (!raw) return [];

  if (Array.isArray(raw)) {
    return raw
      .flatMap((topic) => String(topic).split(","))
      .map((topic) => topic.trim())
      .filter(Boolean);
  }

  if (typeof raw !== "string") return [];

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

function normalizeName(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function maybeCategory(value: unknown): TopicCategoryType | null {
  if (!value || typeof value !== "object") return null;

  const row = value as { id?: unknown; name?: unknown };
  const name = normalizeName(row.name);
  if (!name) return null;

  return {
    id: typeof row.id === "number" ? row.id : 0,
    name,
  };
}

function maybeSubcategory(value: unknown): TopicSubcategoryType | null {
  if (!value || typeof value !== "object") return null;

  const row = value as { id?: unknown; name?: unknown };
  const name = normalizeName(row.name);
  if (!name) return null;

  return {
    id: typeof row.id === "number" ? row.id : 0,
    name,
  };
}

function makeCategoryTopic(categoryName: string, categoryId = 0): TopicType {
  return {
    key: `category:${categoryName.toLocaleLowerCase("de")}`,
    id: categoryId,
    name: categoryName,
    category_id: categoryId || null,
    subcategory_id: null,
    category: null,
  };
}

function makeSubcategoryTopic(
  categoryName: string,
  subcategoryName: string,
  categoryId = 0,
  subcategoryId = 0,
): TopicType {
  const category = {
    id: categoryId,
    name: categoryName,
  };

  return {
    key: `subcategory:${categoryName.toLocaleLowerCase(
      "de",
    )}:${subcategoryName.toLocaleLowerCase("de")}`,
    id: subcategoryId,
    name: subcategoryName,
    category_id: categoryId || null,
    subcategory_id: subcategoryId || null,
    category,
  };
}

function topicFromVideoCategory(
  category: unknown,
  subcategory: unknown,
): TopicType | null {
  const categoryName = normalizeName(category);
  const subcategoryName = normalizeName(subcategory);

  if (!categoryName && !subcategoryName) return null;
  if (!categoryName) return makeCategoryTopic(subcategoryName);
  if (!subcategoryName) return makeCategoryTopic(categoryName);

  return makeSubcategoryTopic(categoryName, subcategoryName);
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

export function normalizeTopicRows(
  categories: unknown[] | null | undefined,
  subcategories: unknown[] | null | undefined = [],
) {
  const topics: TopicType[] = [];

  for (const row of categories ?? []) {
    const category = maybeCategory(row);
    if (!category) continue;
    topics.push(makeCategoryTopic(category.name, category.id));
  }

  for (const row of subcategories ?? []) {
    const subcategory = maybeSubcategory(row);
    if (!subcategory) continue;
    topics.push({
      key: `subcategory:${subcategory.name.toLocaleLowerCase("de")}`,
      id: subcategory.id,
      name: subcategory.name,
      category_id: null,
      subcategory_id: subcategory.id,
      category: null,
    });
  }

  return dedupeTopics(topics);
}

export function normalizeVideoRow(row: unknown): VideoType {
  const video = (row ?? {}) as Record<string, unknown>;
  const topic = topicFromVideoCategory(video.category, video.subcategory);

  return {
    ...(video as unknown as VideoType),
    category: normalizeName(video.category) || null,
    subcategory: normalizeName(video.subcategory) || null,
    topics: topic ? [topic] : [],
  };
}

export function normalizeVideoRows(rows: unknown[] | null | undefined) {
  return (rows ?? []).map(normalizeVideoRow);
}

export function getVideoTopicNames(video: {
  topics?: TopicType[] | null;
  category?: unknown;
  subcategory?: unknown;
}) {
  const relationTopics = Array.isArray(video.topics)
    ? video.topics
        .map(getTopicDisplayName)
        .filter((topic) => topic.length > 0)
    : [];

  if (relationTopics.length > 0) return relationTopics;

  const topic = topicFromVideoCategory(video.category, video.subcategory);
  return topic ? [getTopicDisplayName(topic)] : [];
}

export function getVideoTopics(video: {
  topics?: TopicType[] | null;
  category?: unknown;
  subcategory?: unknown;
}) {
  if (Array.isArray(video.topics) && video.topics.length > 0) {
    return video.topics;
  }

  const topic = topicFromVideoCategory(video.category, video.subcategory);
  return topic ? [topic] : [];
}

export function getTopicDisplayName(topic: {
  name: string;
  category?: { name: string } | null;
}) {
  const name = topic.name.trim();
  const categoryName = topic.category?.name.trim();

  return categoryName ? `${categoryName} > ${name}` : name;
}

export function buildTopicInput(
  categoryName: string | null,
  subcategoryName: string | null,
): TopicInput {
  const category = categoryName?.trim() || null;
  const subcategory = subcategoryName?.trim() || null;
  const label = category
    ? subcategory
      ? `${category} > ${subcategory}`
      : category
    : subcategory;

  return {
    categoryName: category,
    subcategoryName: subcategory,
    label,
  };
}

export function parseTopicInput(rawTopic: string): TopicInput | null {
  const parts = rawTopic
    .split(/\s*(?:>|›|->)\s*/u)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) return null;
  if (parts.length === 1) return buildTopicInput(parts[0], null);

  return buildTopicInput(
    parts.slice(0, parts.length - 1).join(" > "),
    parts[parts.length - 1],
  );
}

export function parseTopicInputs(raw: unknown): TopicInput[] {
  const seen = new Set<string>();
  const inputs: TopicInput[] = [];

  for (const topic of parseTopics(raw)) {
    const parsed = parseTopicInput(topic);
    if (!parsed?.label) continue;

    const key = parsed.label.toLocaleLowerCase("de");
    if (seen.has(key)) continue;

    seen.add(key);
    inputs.push(parsed);
  }

  const categoriesWithSubcategories = new Set(
    inputs
      .filter((input) => input.categoryName && input.subcategoryName)
      .map((input) => input.categoryName?.toLocaleLowerCase("de")),
  );

  return inputs.filter((input) => {
    if (input.subcategoryName) return true;
    if (!input.categoryName) return false;
    return !categoriesWithSubcategories.has(
      input.categoryName.toLocaleLowerCase("de"),
    );
  });
}

export function matchesTopic(videoOrRawTopic: unknown, topic: string): boolean {
  if (
    videoOrRawTopic &&
    typeof videoOrRawTopic === "object" &&
    ("topics" in videoOrRawTopic ||
      "category" in videoOrRawTopic ||
      "subcategory" in videoOrRawTopic)
  ) {
    return getVideoTopicNames(
      videoOrRawTopic as {
        topics?: TopicType[] | null;
        category?: unknown;
        subcategory?: unknown;
      },
    ).includes(topic);
  }

  return parseTopics(videoOrRawTopic).includes(topic);
}
