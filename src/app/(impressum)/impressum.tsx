import { ScrollView, StyleSheet } from "react-native";
import { A, H1, H2, Main, P } from "@expo/html-elements";
import { useColorScheme } from "@/hooks/useColorScheme";
import { Colors } from "@/constants/Colors";
import { useTranslation } from "react-i18next";
import { Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLanguage } from "../../../contexts/LanguageContext";

const imprintCopy = {
  de: {
    heading: "Impressum",
    contact: "Kontakt",
    phone: "Telefon",
    email: "E-Mail",
    source: "Quelle",
  },
  en: {
    heading: "Legal notice",
    contact: "Contact",
    phone: "Phone",
    email: "Email",
    source: "Source",
  },
  ar: {
    heading: "البيانات القانونية",
    contact: "التواصل",
    phone: "الهاتف",
    email: "البريد الإلكتروني",
    source: "المصدر",
  },
} as const;

export default function Impressum() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const { t } = useTranslation();
  const { lang, rtl } = useLanguage();
  const copy = imprintCopy[lang];
  const textDirectionStyle = rtl ? styles.rtlText : styles.ltrText;

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
      <Stack.Screen
        options={{
          headerTitle: t("imprint"),
        }}
      />

      <ScrollView
        style={[styles.scrollStyle, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.scrollContent}
        nestedScrollEnabled={true}
        contentInsetAdjustmentBehavior="automatic"
      >
        <Main style={styles.innerContainer}>
          <H1 style={[styles.heading, textDirectionStyle, { color: colors.text }]}>
            {copy.heading}
          </H1>
          <P style={[styles.paragraph, textDirectionStyle, { color: colors.text }]}>
            Hadi El Ali
            {"\n"}
            Mangenberger Straße, 206
            {"\n"}
            42655 Solingen
          </P>

          <H2
            style={[
              styles.subheading,
              textDirectionStyle,
              { color: colors.text },
            ]}
          >
            {copy.contact}
          </H2>

          <P style={[styles.paragraph, textDirectionStyle, { color: colors.text }]}>
            {copy.phone}: 0157 85 69 19 87
            {"\n"}
            {copy.email}: hadielali@web.de
          </P>

          <P style={[styles.paragraph, textDirectionStyle, { color: colors.text }]}>
            {copy.source}:{" "}
            <A
              href="https://www.e-recht24.de/impressum-generator.html"
              style={[styles.link, textDirectionStyle, { color: colors.tint }]}
            >
              https://www.e-recht24.de/impressum-generator.html
            </A>
          </P>
        </Main>
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
  heading: {
    fontSize: 27,
    lineHeight: 36,
    marginBottom: 20,
  },
  subheading: {
    fontSize: 22,
    lineHeight: 30,
    marginBottom: 12,
  },
  paragraph: {
    fontSize: 16,
    lineHeight: 27,
    marginBottom: 16,
  },
  link: {
    textDecorationLine: "underline",
  },
  ltrText: {
    textAlign: "left",
    writingDirection: "ltr",
  },
  rtlText: {
    textAlign: "right",
    writingDirection: "rtl",
  },
});
