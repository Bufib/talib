import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { VideoType } from "@/constants/Types";
import { supabase } from "../../utils/supabase";
import {
  matchesTopic,
  normalizeVideoRows,
  VIDEO_WITH_TOPICS_SELECT,
} from "../../utils/videoTopics";

type UseVideoListArgs = {
  language: string | null;
  selectedTopic?: string | null;
  selectedAuthor?: string | null;
  searchQuery?: string;
};

export function useVideoList({
  language,
  selectedTopic = null,
  selectedAuthor = null,
  searchQuery = "",
}: UseVideoListArgs) {
  const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase();

  const query = useQuery<VideoType[], Error>({
    queryKey: ["videos", "grid"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("videos")
        .select(VIDEO_WITH_TOPICS_SELECT)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false });

      if (error) throw error;

      return normalizeVideoRows(data) as VideoType[];
    },
    retry: 3,
    staleTime: 12 * 60 * 60 * 1000,
    gcTime: 7 * 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });

  const videos = useMemo(() => {
    return (query.data ?? []).filter(
      (video) =>
        (language === null || video.language_code === language) &&
        (!selectedAuthor || video.author_name === selectedAuthor) &&
        (!selectedTopic || matchesTopic(video, selectedTopic)) &&
        (!normalizedSearchQuery ||
          video.title.toLocaleLowerCase().includes(normalizedSearchQuery)),
    );
  }, [
    language,
    normalizedSearchQuery,
    query.data,
    selectedAuthor,
    selectedTopic,
  ]);

  return {
    ...query,
    videos,
  };
}
