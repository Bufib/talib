import { Linking, StyleSheet, Text, TouchableOpacity } from "react-native";
import React from "react";
import { useTranslation } from "react-i18next";
import { useIsMobileWeb } from "@/hooks/useIsMobileWeb";

const FeedbackButton = () => {
  const sendEmail = () => {
    const email = "hadielali@web.de";
    const subject = "Feedback";

    const url = `mailto:${email}?subject=${encodeURIComponent(subject)}`;

    Linking.openURL(url);
  };
  const { t } = useTranslation();
  const isMobileWeb = useIsMobileWeb();
  return (
    <TouchableOpacity
      style={[styles.button, isMobileWeb ? { width: "95%", alignSelf: "center" } : { width: 180 }]}
      onPress={sendEmail}
      activeOpacity={0.7}
    >
      <Text style={styles.label}>{t("feedback")}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: "#2ea853",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  label: {
    color: "#FFFFFF",
    fontSize: 16,
    textAlign: "center",
  },
});

export default FeedbackButton;
