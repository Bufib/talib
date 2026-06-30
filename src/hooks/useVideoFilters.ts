import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "../../utils/supabase";
import {
  compareTopicLabelsByOrder,
  EMPTY_TOPIC_SORT_ORDERS,
  getVideoTopicNames,
  normalizeVideoRows,
  type TopicSortOrders,
  VIDEO_WITH_TOPICS_SELECT,
} from "../../utils/videoTopics";
import { useTopicSortOrders } from "./useTopicSortOrders";

type UseVideoFiltersArgs = {
  language: string | null;
  selectedTopic: string | null;
  selectedAuthor: string | null;
};

type FilterPair = {
  language: string | null;
  topic: string | null;
  author: string | null;
};

const EMPTY_FILTER_PAIRS: FilterPair[] = [];

// Die kombinierten Metadaten werden benoetigt, damit Thema, Autor und Sprache
// als voneinander abhaengige Facetten gefiltert werden koennen.
async function fetchFilterPairs(): Promise<FilterPair[]> {
  const { data, error } = await supabase
    .from("videos")
    .select(VIDEO_WITH_TOPICS_SELECT);

  if (error) throw error;

  return normalizeVideoRows(data).flatMap((row): FilterPair[] => {
    const topics = getVideoTopicNames(row);
    const language = row.language_code?.trim() || null;
    const author = row.author_name ?? null;

    if (topics.length === 0) return [{ language, topic: null, author }];
    return topics.map((topic) => ({ language, topic, author }));
  });
}

function uniqueSorted(values: (string | null)[]) {
  return [
    ...new Set(values.filter((value): value is string => Boolean(value))),
  ].sort();
}

function uniqueTopicsSorted(
  values: (string | null)[],
  topicSortOrders: TopicSortOrders,
) {
  return [
    ...new Set(values.filter((value): value is string => Boolean(value))),
  ].sort((a, b) =>
    compareTopicLabelsByOrder(a, b, topicSortOrders, "de"),
  );
}

export function useVideoFilters({
  language,
  selectedTopic,
  selectedAuthor,
}: UseVideoFiltersArgs) {
  const topicSortOrdersQuery = useTopicSortOrders();
  const topicSortOrders =
    topicSortOrdersQuery.topicSortOrders ?? EMPTY_TOPIC_SORT_ORDERS;
  const query = useQuery<FilterPair[]>({
    queryKey: ["video_filter_pairs"],
    queryFn: fetchFilterPairs,
    staleTime: 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const pairs = query.data ?? EMPTY_FILTER_PAIRS;

  const allTopics = useMemo(
    () => uniqueTopicsSorted(pairs.map((pair) => pair.topic), topicSortOrders),
    [pairs, topicSortOrders],
  );
  const allAuthors = useMemo(
    () => uniqueSorted(pairs.map((pair) => pair.author)),
    [pairs],
  );
  const allLanguages = useMemo(
    () => uniqueSorted(pairs.map((pair) => pair.language)),
    [pairs],
  );

  const availableTopics = useMemo(() => {
    return uniqueTopicsSorted(
      pairs
        .filter(
          (pair) =>
            (language === null || pair.language === language) &&
            (!selectedAuthor || pair.author === selectedAuthor),
        )
        .map((pair) => pair.topic),
      topicSortOrders,
    );
  }, [language, pairs, selectedAuthor, topicSortOrders]);

  const availableAuthors = useMemo(() => {
    return uniqueSorted(
      pairs
        .filter(
          (pair) =>
            (language === null || pair.language === language) &&
            (!selectedTopic || pair.topic === selectedTopic),
        )
        .map((pair) => pair.author),
    );
  }, [language, pairs, selectedTopic]);

  const availableLanguages = useMemo(() => {
    return uniqueSorted(
      pairs
        .filter(
          (pair) =>
            (!selectedTopic || pair.topic === selectedTopic) &&
            (!selectedAuthor || pair.author === selectedAuthor),
        )
        .map((pair) => pair.language),
    );
  }, [pairs, selectedAuthor, selectedTopic]);

  return {
    ...query,
    allTopics,
    allAuthors,
    allLanguages,
    availableTopics,
    availableAuthors,
    availableLanguages,
    topicSortOrders,
  };
}
