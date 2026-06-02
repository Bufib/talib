import { Platform, useWindowDimensions } from "react-native";

const MOBILE_WEB_MAX_WIDTH = 768;

export function useIsMobileWeb() {
  const { width } = useWindowDimensions();

  return Platform.OS === "web" && width <= MOBILE_WEB_MAX_WIDTH;
}