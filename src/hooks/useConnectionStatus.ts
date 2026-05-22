import { useState, useEffect } from "react";
import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";

const OFFLINE_CONFIRMATION_DELAY_MS = 1500;

export type ConnectionStatus = "unknown" | "online" | "offline";

function getConnectionStatus(networkState: NetInfoState): ConnectionStatus {
  if (
    networkState.isConnected === false ||
    networkState.isInternetReachable === false
  ) {
    return "offline";
  }

  if (networkState.isConnected === true) {
    return "online";
  }

  return "unknown";
}

export const useConnectionStatus = (): ConnectionStatus => {
  const [status, setStatus] = useState<ConnectionStatus>("unknown");

  useEffect(() => {
    let mounted = true;
    let offlineTimeout: ReturnType<typeof setTimeout> | null = null;

    const clearOfflineTimeout = () => {
      if (!offlineTimeout) return;

      clearTimeout(offlineTimeout);
      offlineTimeout = null;
    };

    const applyNetworkState = (networkState: NetInfoState) => {
      if (!mounted) return;

      const nextStatus = getConnectionStatus(networkState);

      if (nextStatus === "online") {
        clearOfflineTimeout();
        setStatus("online");
        return;
      }

      if (nextStatus === "unknown") {
        clearOfflineTimeout();
        setStatus((currentStatus) =>
          currentStatus === "unknown" ? "unknown" : currentStatus,
        );
        return;
      }

      if (offlineTimeout) return;

      offlineTimeout = setTimeout(() => {
        if (!mounted) return;

        setStatus("offline");
        offlineTimeout = null;
      }, OFFLINE_CONFIRMATION_DELAY_MS);
    };

    const checkConnection = async () => {
      try {
        const networkState = await NetInfo.fetch();
        applyNetworkState(networkState);
      } catch (error) {
        if (__DEV__) {
          console.warn("Error checking connection:", error);
        }
      }
    };

    checkConnection();

    const unsubscribe = NetInfo.addEventListener(applyNetworkState);

    return () => {
      mounted = false;
      clearOfflineTimeout();
      unsubscribe();
    };
  }, []);

  return status;
};
