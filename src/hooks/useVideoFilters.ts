import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "../../utils/supabase";
import { parseTopics } from "../../utils/videoTopics";

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
    .select("language_code, video_topic, author_name");

  if (error) throw error;

  type Row = {
    language_code: string | null;
    video_topic: unknown;
    author_name: string | null;
  };

  return ((data ?? []) as unknown as Row[]).flatMap((row): FilterPair[] => {
    const topics = parseTopics(row.video_topic);
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

export function useVideoFilters({
  language,
  selectedTopic,
  selectedAuthor,
}: UseVideoFiltersArgs) {
  const query = useQuery<FilterPair[]>({
    queryKey: ["video_filter_pairs"],
    queryFn: fetchFilterPairs,
    staleTime: 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const pairs = query.data ?? EMPTY_FILTER_PAIRS;

  const allTopics = useMemo(
    () => uniqueSorted(pairs.map((pair) => pair.topic)),
    [pairs],
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
    return uniqueSorted(
      pairs
        .filter(
          (pair) =>
            (language === null || pair.language === language) &&
            (!selectedAuthor || pair.author === selectedAuthor),
        )
        .map((pair) => pair.topic),
    );
  }, [language, pairs, selectedAuthor]);

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
  };
}
