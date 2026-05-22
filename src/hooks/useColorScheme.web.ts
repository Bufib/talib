import { useEffect, useSyncExternalStore } from "react";
import { Colors } from "@/constants/Colors";

/**
 * react-native-web implementiert Appearance.setColorScheme aktuell nicht.
 * Darum verwaltet Web den App-Toggle selbst und faellt ohne Override auf die
 * Systempraeferenz zurueck.
 */
type ColorScheme = "light" | "dark";

const STORAGE_KEY = "isDarkMode";
const COLOR_SCHEME_EVENT = "shiacast:web-color-scheme-change";
const DARK_SCHEME_QUERY = "(prefers-color-scheme: dark)";

function getStoredScheme(): ColorScheme | null {
  if (typeof window === "undefined") return null;

  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved === "true") return "dark";
  if (saved === "false") return "light";

  return null;
}

function getSystemScheme(): ColorScheme {
  if (typeof window === "undefined") return "light";

  return window.matchMedia?.(DARK_SCHEME_QUERY).matches ? "dark" : "light";
}

function getSnapshot(): ColorScheme {
  return getStoredScheme() ?? getSystemScheme();
}

function getServerSnapshot(): ColorScheme {
  return "light";
}

function applyDocumentScheme(scheme: ColorScheme) {
  if (typeof document === "undefined") return;

  const backgroundColor = Colors[scheme].background;

  document.documentElement.style.colorScheme = scheme;
  document.documentElement.style.backgroundColor = backgroundColor;
  document.documentElement.dataset.colorScheme = scheme;

  document.body.style.backgroundColor = backgroundColor;

  const root = document.getElementById("root");
  root?.style.setProperty("background-color", backgroundColor);
}

function subscribe(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};

  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) onStoreChange();
  };

  const mediaQuery = window.matchMedia?.(DARK_SCHEME_QUERY);
  const onMediaChange = () => onStoreChange();

  window.addEventListener(COLOR_SCHEME_EVENT, onStoreChange);
  window.addEventListener("storage", onStorage);

  if (mediaQuery) {
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", onMediaChange);
    } else {
      mediaQuery.addListener(onMediaChange);
    }
  }

  return () => {
    window.removeEventListener(COLOR_SCHEME_EVENT, onStoreChange);
    window.removeEventListener("storage", onStorage);

    if (!mediaQuery) return;

    if (typeof mediaQuery.removeEventListener === "function") {
      mediaQuery.removeEventListener("change", onMediaChange);
    } else {
      mediaQuery.removeListener(onMediaChange);
    }
  };
}

export function setWebColorScheme(isDarkMode: boolean) {
  if (typeof window === "undefined") return;

  const scheme: ColorScheme = isDarkMode ? "dark" : "light";

  window.localStorage.setItem(STORAGE_KEY, `${isDarkMode}`);
  applyDocumentScheme(scheme);
  window.dispatchEvent(new Event(COLOR_SCHEME_EVENT));
}

export function useColorScheme(): "light" | "dark" {
  const scheme = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  useEffect(() => {
    applyDocumentScheme(scheme);
  }, [scheme]);

  return scheme;
}
