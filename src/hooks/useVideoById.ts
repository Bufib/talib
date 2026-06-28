import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { VideoType } from "@/constants/Types";
import { supabase } from "../../utils/supabase";
import {
  normalizeVideoRow,
  VIDEO_WITH_TOPICS_SELECT,
} from "../../utils/videoTopics";

function findCachedVideoById(
  id: number | null | undefined,
  cacheValues: unknown[],
) {
  if (id == null) return undefined;

  for (const value of cacheValues) {
    if (
      value &&
      typeof value === "object" &&
      (value as Partial<VideoType>).id === id
    ) {
      return value as VideoType;
    }

    if (Array.isArray(value)) {
      const match = value.find((video): video is VideoType => {
        return Boolean(
          video &&
            typeof video === "object" &&
            (video as Partial<VideoType>).id === id,
        );
      });
      if (match) return match;
    }

    const pages = (value as { pages?: { items?: VideoType[] }[] } | undefined)
      ?.pages;
    if (!pages) continue;

    for (const page of pages) {
      const match = page.items?.find((video) => video.id === id);
      if (match) return match;
    }
  }

  return undefined;
}

export function useVideoById(id: number | null | undefined) {
  const queryClient = useQueryClient();

  return useQuery<VideoType, Error>({
    queryKey: ["videos", "by-id", id],
    enabled: id != null,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("videos")
        .select(VIDEO_WITH_TOPICS_SELECT)
        .eq("id", id)
        .single();

      if (error) throw error;

      return normalizeVideoRow(data);
    },
    placeholderData: () => {
      const cachedVideoQueries = queryClient
        .getQueriesData({ queryKey: ["videos"] })
        .map(([, value]) => value);

      return findCachedVideoById(id, cachedVideoQueries);
    },
    retry: 3,
    staleTime: 12 * 60 * 60 * 1000,
    gcTime: 7 * 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
}
