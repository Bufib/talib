import { create } from "zustand";

type VideoFilterState = {
  defaultLanguage: string | null;
  selectedTopic: string | null;
  selectedAuthor: string | null;
  selectedLanguage: string | null;
  setDefaultLanguage: (language: string) => void;
  setSelectedTopic: (topic: string | null) => void;
  setSelectedAuthor: (author: string | null) => void;
  setSelectedLanguage: (language: string | null) => void;
  resetFilters: (defaultLanguage?: string) => void;
};

export const useVideoFilterStore = create<VideoFilterState>((set) => ({
  defaultLanguage: null,
  selectedTopic: null,
  selectedAuthor: null,
  selectedLanguage: null,

  setDefaultLanguage: (language) => {
    set((state) => ({
      defaultLanguage: language,
      selectedLanguage:
        state.defaultLanguage === null ||
        state.selectedLanguage === state.defaultLanguage
          ? language
          : state.selectedLanguage,
    }));
  },

  setSelectedTopic: (topic) => set({ selectedTopic: topic }),

  setSelectedAuthor: (author) => set({ selectedAuthor: author }),

  setSelectedLanguage: (language) => set({ selectedLanguage: language }),

  resetFilters: (defaultLanguage) =>
    set((state) => ({
      defaultLanguage: defaultLanguage ?? state.defaultLanguage,
      selectedTopic: null,
      selectedAuthor: null,
      selectedLanguage: defaultLanguage ?? state.defaultLanguage,
    })),
}));
