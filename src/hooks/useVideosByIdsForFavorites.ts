import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { VideoType } from "@/constants/Types";
import { supabase } from "../../utils/supabase";
import {
  normalizeVideoRows,
  VIDEO_WITH_TOPICS_SELECT,
} from "../../utils/videoTopics";

type UseVideosByIdsArgs = {
  ids: number[];
  language?: string | null;
};

export function useVideosByIdsForFavorites({
  ids,
  language = null,
}: UseVideosByIdsArgs) {
  const idsKey = useMemo(() => [...ids].sort((a, b) => a - b).join(","), [ids]);

  return useQuery<VideoType[], Error>({
    queryKey: ["videos", "by-ids", language, idsKey],
    enabled: ids.length > 0,
    queryFn: async () => {
      let request = supabase
        .from("videos")
        .select(VIDEO_WITH_TOPICS_SELECT)
        .in("id", ids)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false });

      if (language !== null) {
        request = request.eq("language_code", language);
      }

      const { data, error } = await request;

      if (error) {
        throw error;
      }

      return normalizeVideoRows(data) as VideoType[];
    },
    retry: 3,
    staleTime: 12 * 60 * 60 * 1000,
    gcTime: 7 * 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
}
