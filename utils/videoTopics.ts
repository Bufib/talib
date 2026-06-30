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

export const CATEGORY_SELECT =
  "id, name, sort_order_categories, color_hex_categories";
export const SUBCATEGORY_SELECT =
  "id, name, sort_order_subcategories, color_hex_subcategories";

export type TopicSortOrders = {
  categories: ReadonlyMap<string, number>;
  subcategories: ReadonlyMap<string, number>;
  categoryColors: ReadonlyMap<string, string>;
  subcategoryColors: ReadonlyMap<string, string>;
};

export const EMPTY_TOPIC_SORT_ORDERS: TopicSortOrders = {
  categories: new Map<string, number>(),
  subcategories: new Map<string, number>(),
  categoryColors: new Map<string, string>(),
  subcategoryColors: new Map<string, string>(),
};

export type TopicInput = {
  categoryName: string | null;
  subcategoryName: string | null;
  label: string | null;
  categoryColorHex?: string | null;
  subcategoryColorHex?: string | null;
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

function normalizeSortKey(value: string) {
  return value.trim().toLocaleLowerCase("de");
}

function normalizeSortOrder(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normalizeHexColor(value: unknown) {
  if (typeof value !== "string") return null;

  const rawColor = value.trim();
  if (!rawColor) return null;

  const color = rawColor.startsWith("#") ? rawColor.slice(1) : rawColor;
  if (/^[0-9a-f]{3}$/i.test(color)) {
    const [red, green, blue] = color;
    return `#${red}${red}${green}${green}${blue}${blue}`.toUpperCase();
  }

  if (/^[0-9a-f]{6}$/i.test(color)) {
    return `#${color}`.toUpperCase();
  }

  return null;
}

export function hexToRgba(hexColor: string, opacity: number) {
  const normalizedColor = normalizeHexColor(hexColor);
  if (!normalizedColor) return hexColor;

  const red = parseInt(normalizedColor.slice(1, 3), 16);
  const green = parseInt(normalizedColor.slice(3, 5), 16);
  const blue = parseInt(normalizedColor.slice(5, 7), 16);
  const alpha = Math.max(0, Math.min(1, opacity));

  return `rgba(${red},${green},${blue},${alpha})`;
}

function maybeCategory(value: unknown): TopicCategoryType | null {
  if (!value || typeof value !== "object") return null;

  const row = value as {
    id?: unknown;
    name?: unknown;
    sort_order_categories?: unknown;
    color_hex_categories?: unknown;
  };
  const name = normalizeName(row.name);
  if (!name) return null;

  return {
    id: typeof row.id === "number" ? row.id : 0,
    name,
    sort_order_categories: normalizeSortOrder(row.sort_order_categories),
    color_hex_categories: normalizeHexColor(row.color_hex_categories),
  };
}

function maybeSubcategory(value: unknown): TopicSubcategoryType | null {
  if (!value || typeof value !== "object") return null;

  const row = value as {
    id?: unknown;
    name?: unknown;
    sort_order_subcategories?: unknown;
    color_hex_subcategories?: unknown;
  };
  const name = normalizeName(row.name);
  if (!name) return null;

  return {
    id: typeof row.id === "number" ? row.id : 0,
    name,
    sort_order_subcategories: normalizeSortOrder(
      row.sort_order_subcategories,
    ),
    color_hex_subcategories: normalizeHexColor(row.color_hex_subcategories),
  };
}

function makeCategoryTopic(
  categoryName: string,
  categoryId = 0,
  sortOrder: number | null = null,
  colorHex: string | null = null,
): TopicType {
  return {
    key: `category:${categoryName.toLocaleLowerCase("de")}`,
    id: categoryId,
    name: categoryName,
    category_id: categoryId || null,
    subcategory_id: null,
    sort_order: sortOrder,
    color_hex: colorHex,
    category: null,
  };
}

function makeSubcategoryTopic(
  categoryName: string,
  subcategoryName: string,
  categoryId = 0,
  subcategoryId = 0,
  categorySortOrder: number | null = null,
  subcategorySortOrder: number | null = null,
  categoryColorHex: string | null = null,
): TopicType {
  const category = {
    id: categoryId,
    name: categoryName,
    sort_order_categories: categorySortOrder,
    color_hex_categories: categoryColorHex,
  };

  return {
    key: `subcategory:${categoryName.toLocaleLowerCase(
      "de",
    )}:${subcategoryName.toLocaleLowerCase("de")}`,
    id: subcategoryId,
    name: subcategoryName,
    category_id: categoryId || null,
    subcategory_id: subcategoryId || null,
    sort_order: subcategorySortOrder,
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
    topics.push(
      makeCategoryTopic(
        category.name,
        category.id,
        category.sort_order_categories,
        category.color_hex_categories,
      ),
    );
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
      sort_order: subcategory.sort_order_subcategories,
      color_hex: subcategory.color_hex_subcategories,
      category: null,
    });
  }

  return dedupeTopics(topics);
}

export function createTopicSortOrders(
  categories: unknown[] | null | undefined,
  subcategories: unknown[] | null | undefined = [],
): TopicSortOrders {
  const categorySortOrders = new Map<string, number>();
  const subcategorySortOrders = new Map<string, number>();
  const categoryColors = new Map<string, string>();
  const subcategoryColors = new Map<string, string>();

  for (const row of categories ?? []) {
    const category = maybeCategory(row);
    if (!category) continue;

    const categoryKey = normalizeSortKey(category.name);
    if (category.sort_order_categories !== null) {
      categorySortOrders.set(categoryKey, category.sort_order_categories);
    }
    if (category.color_hex_categories) {
      categoryColors.set(categoryKey, category.color_hex_categories);
    }
  }

  for (const row of subcategories ?? []) {
    const subcategory = maybeSubcategory(row);
    if (!subcategory) continue;

    const subcategoryKey = normalizeSortKey(subcategory.name);
    if (subcategory.sort_order_subcategories !== null) {
      subcategorySortOrders.set(
        subcategoryKey,
        subcategory.sort_order_subcategories,
      );
    }
    if (subcategory.color_hex_subcategories) {
      subcategoryColors.set(
        subcategoryKey,
        subcategory.color_hex_subcategories,
      );
    }
  }

  return {
    categories: categorySortOrders,
    subcategories: subcategorySortOrders,
    categoryColors,
    subcategoryColors,
  };
}

export function getTopicSortOrder(
  sortOrders: ReadonlyMap<string, number>,
  name: string | null | undefined,
) {
  const normalizedName = name?.trim();
  if (!normalizedName) return null;

  return sortOrders.get(normalizeSortKey(normalizedName)) ?? null;
}

export function getTopicColor(
  colors: ReadonlyMap<string, string>,
  name: string | null | undefined,
  fallbackColor: string,
) {
  const normalizedName = name?.trim();
  if (!normalizedName) return fallbackColor;

  return colors.get(normalizeSortKey(normalizedName)) ?? fallbackColor;
}

export function compareBySortOrderThenName(
  first: { name: string; sortOrder: number | null },
  second: { name: string; sortOrder: number | null },
  locale: string,
) {
  if (first.sortOrder !== null || second.sortOrder !== null) {
    if (first.sortOrder === null) return 1;
    if (second.sortOrder === null) return -1;
    if (first.sortOrder !== second.sortOrder) {
      return first.sortOrder - second.sortOrder;
    }
  }

  return first.name.localeCompare(second.name, locale, {
    sensitivity: "base",
  });
}

export function compareTopicNamesByOrder(
  firstName: string,
  secondName: string,
  sortOrders: ReadonlyMap<string, number>,
  locale: string,
) {
  return compareBySortOrderThenName(
    {
      name: firstName,
      sortOrder: getTopicSortOrder(sortOrders, firstName),
    },
    {
      name: secondName,
      sortOrder: getTopicSortOrder(sortOrders, secondName),
    },
    locale,
  );
}

export function compareTopicLabelsByOrder(
  firstLabel: string,
  secondLabel: string,
  topicSortOrders: TopicSortOrders,
  locale: string,
) {
  const firstParts = firstLabel
    .split(">")
    .map((part) => part.trim())
    .filter(Boolean);
  const secondParts = secondLabel
    .split(">")
    .map((part) => part.trim())
    .filter(Boolean);
  const firstCategory = firstParts.length > 1 ? firstParts[0] : firstLabel;
  const secondCategory = secondParts.length > 1 ? secondParts[0] : secondLabel;
  const categoryComparison = compareTopicNamesByOrder(
    firstCategory,
    secondCategory,
    topicSortOrders.categories,
    locale,
  );

  if (categoryComparison !== 0) return categoryComparison;

  if (firstParts.length <= 1 || secondParts.length <= 1) {
    return firstLabel.localeCompare(secondLabel, locale, {
      sensitivity: "base",
    });
  }

  return compareTopicNamesByOrder(
    firstParts[firstParts.length - 1],
    secondParts[secondParts.length - 1],
    topicSortOrders.subcategories,
    locale,
  );
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
