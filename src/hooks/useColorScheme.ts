import { useColorScheme as useRNColorScheme } from "react-native";

/**
 * Wrapper um den nativen Hook: gibt garantiert nur "light" | "dark" zurück.
 * `null` / `unspecified` werden auf "light" gemappt.
 */
export function useColorScheme(): "light" | "dark" {
  const scheme = useRNColorScheme();
  return scheme === "dark" ? "dark" : "light";
}

export function setWebColorScheme(_isDarkMode: boolean) {}
