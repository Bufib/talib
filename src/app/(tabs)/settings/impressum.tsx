import {
  ScrollView,
  View,
  StyleSheet
} from "react-native";
import { ThemedView } from "@/components/ThemedView";
import { useColorScheme } from "@/hooks/useColorScheme";
import React from "react";
import Markdown from "react-native-markdown-display";
import { Colors } from "@/constants/Colors";
import { useTranslation } from "react-i18next";
import { Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Impressum() {
  const impressum = `
 # **Impressum** 

 **Angaben gemäß § 5 TMG:**
 Hadi El Ali
 Mangenberger Straße 206
 42655 Solingen
 
 Telefon: 015785691987
 email: hadielali@web.de
 `;

  const quelle = `Quelle: `;
  const link = `[http://www.e-recht24.de](http://www.e-recht24.de)`;
  const colorScheme = useColorScheme();
  const { t } = useTranslation();

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
      <ScrollView
        style={[
          styles.scrollStyle,
          { backgroundColor: Colors[colorScheme].background },
        ]}
        contentContainerStyle={styles.scrollContent}
        nestedScrollEnabled={true}
        contentInsetAdjustmentBehavior="automatic"
      >
        <Stack.Screen
          options={{
            headerTitle: t("impressum"),
          }}
        />

        <View style={styles.innerContainer}>
          <Markdown
            style={{
              body: {
                textAlign: "justify",
                fontSize: 16,
                lineHeight: 40,
                color: Colors[colorScheme].text,
              },
              heading1: {
                fontSize: 27,
                lineHeight: 40,
                color: Colors[colorScheme].text,
              },
            }}
          >
            {impressum}
          </Markdown>
          <ThemedView style={{ flexDirection: "row", gap: 5 }}>
            <Markdown
              style={{
                body: {
                  textAlign: "justify",
                  fontSize: 16,
                  lineHeight: 40,
                  color: Colors[colorScheme].text,
                },
                heading1: {
                  fontSize: 27,
                  lineHeight: 40,
                  color: Colors[colorScheme].text,
                },
              }}
            >
              {quelle}
            </Markdown>
            <Markdown
              style={{
                body: {
                  textAlign: "justify",
                  fontSize: 18,
                  lineHeight: 40,
                  color: "#93C024",
                },
                heading1: {
                  fontSize: 27,
                  lineHeight: 40,
                  color: Colors[colorScheme].text,
                },
              }}
            >
              {link}
            </Markdown>
          </ThemedView>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  scrollStyle: {
    flex: 1,
    paddingHorizontal: 15,
    paddingTop: 15,
    paddingBottom: 40,
  },
  scrollContent: {
    flexGrow: 1,
  },
  innerContainer: {
    paddingBottom: 100,
  },
});
