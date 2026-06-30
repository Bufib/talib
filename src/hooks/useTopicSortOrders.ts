import { useQuery } from "@tanstack/react-query";

import { supabase } from "../../utils/supabase";
import {
  CATEGORY_SELECT,
  createTopicSortOrders,
  EMPTY_TOPIC_SORT_ORDERS,
  SUBCATEGORY_SELECT,
} from "../../utils/videoTopics";

export function useTopicSortOrders() {
  const query = useQuery({
    queryKey: ["topic_sort_orders"],
    queryFn: async () => {
      const [categoriesResult, subcategoriesResult] = await Promise.all([
        supabase.from("topic_categories").select(CATEGORY_SELECT),
        supabase.from("topic_subcategories").select(SUBCATEGORY_SELECT),
      ]);

      if (categoriesResult.error) throw categoriesResult.error;
      if (subcategoriesResult.error) throw subcategoriesResult.error;

      return createTopicSortOrders(
        categoriesResult.data,
        subcategoriesResult.data,
      );
    },
    staleTime: 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return {
    ...query,
    topicSortOrders: query.data ?? EMPTY_TOPIC_SORT_ORDERS,
  };
}
