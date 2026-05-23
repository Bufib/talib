import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useVideoFavoriteFoldersStore } from "../../stores/videoFavoriteFoldersStore";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const FOLDER_COLORS = [
  "#E53E3E",
  "#DD6B20",
  "#D69E2E",
  "#38A169",
  "#3182CE",
  "#805AD5",
  "#D53F8C",
  "#607D8B",
];

type Props = {
  videoId: number;
};

export default function VideoFavoriteFolderModal({ videoId }: Props) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const insets = useSafeAreaInsets();

  const folders = useVideoFavoriteFoldersStore((s) => s.folders);
  const getVideoFolderIds = useVideoFavoriteFoldersStore(
    (s) => s.getVideoFolderIds,
  );
  const setVideoFolders = useVideoFavoriteFoldersStore(
    (s) => s.setVideoFolders,
  );
  const addFolder = useVideoFavoriteFoldersStore((s) => s.addFolder);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderColor, setNewFolderColor] = useState(FOLDER_COLORS[0]);

  useEffect(() => {
    setSelectedIds(getVideoFolderIds(videoId));
    setShowCreate(false);
    setNewFolderName("");
    setNewFolderColor(FOLDER_COLORS[0]);
  }, [videoId, getVideoFolderIds]);

  const closeSheet = useCallback(() => {
    router.dismiss();
  }, []);

  const handleToggleFolder = useCallback(
    (folderId: string) => {
      const next = selectedIds.includes(folderId)
        ? selectedIds.filter((id) => id !== folderId)
        : [...selectedIds, folderId];

      setSelectedIds(next);
      setVideoFolders(videoId, next);
    },
    [selectedIds, videoId, setVideoFolders],
  );

  const handleCreateFolder = useCallback(() => {
    const name = newFolderName.trim();
    if (!name) return;

    const folder = addFolder(name, newFolderColor);
    const next = [...selectedIds, folder.id];

    setSelectedIds(next);
    setVideoFolders(videoId, next);
    setNewFolderName("");
    setNewFolderColor(FOLDER_COLORS[0]);
    setShowCreate(false);
  }, [
    newFolderName,
    newFolderColor,
    selectedIds,
    addFolder,
    videoId,
    setVideoFolders,
  ]);

  const panelBg = isDark ? "#1e2a3a" : "#ffffff";
  const sectionLabelColor = isDark ? "#8899aa" : "#888";
  const borderColor = isDark ? "#2d3d50" : "#f0f2f5";
  const textColor = isDark ? "#fff" : "#111";
  const subTextColor = isDark ? "#8899aa" : "#666";
  const inputBg = isDark ? "#2a3a4e" : "#f5f7fa";

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[styles.sheetRoot, { backgroundColor: panelBg }]}
    >
      <View style={[styles.header, { borderBottomColor: borderColor }]}>
        <Text style={[styles.title, { color: textColor }]}>
          {t("favorites")}
        </Text>
        <TouchableOpacity onPress={closeSheet} style={styles.closeBtn}>
          <Ionicons name="close" size={22} color={subTextColor} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollArea}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        {folders.length === 0 && !showCreate && (
          <Text style={[styles.emptyText, { color: subTextColor }]}>
            {t("noFoldersYet")}
          </Text>
        )}

        {folders.map((folder) => {
          const isSelected = selectedIds.includes(folder.id);
          return (
            <TouchableOpacity
              key={folder.id}
              style={[styles.folderRow, { borderColor }]}
              onPress={() => handleToggleFolder(folder.id)}
              activeOpacity={0.7}
            >
              <View
                style={[styles.folderDot, { backgroundColor: folder.color }]}
              />
              <Text
                style={[styles.folderName, { color: textColor }]}
                numberOfLines={1}
              >
                {folder.name}
              </Text>
              <Ionicons
                name={isSelected ? "checkmark-circle" : "ellipse-outline"}
                size={24}
                color={isSelected ? Colors.universal.primary : subTextColor}
              />
            </TouchableOpacity>
          );
        })}

        {showCreate ? (
          <View style={[styles.createForm, { borderColor }]}>
            <TextInput
              style={[
                styles.input,
                { color: textColor, backgroundColor: inputBg },
              ]}
              placeholder={t("enterFolderName")}
              placeholderTextColor={subTextColor}
              value={newFolderName}
              onChangeText={setNewFolderName}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleCreateFolder}
              maxLength={40}
            />

            <Text style={[styles.colorLabel, { color: sectionLabelColor }]}>
              {t("pickColor")}
            </Text>

            <View style={styles.colorRow}>
              {FOLDER_COLORS.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[
                    styles.colorDot,
                    { backgroundColor: c },
                    newFolderColor === c && styles.colorDotSelected,
                  ]}
                  onPress={() => setNewFolderColor(c)}
                />
              ))}
            </View>

            <View style={styles.createActions}>
              <TouchableOpacity
                style={[
                  styles.actionBtn,
                  { borderColor: isDark ? "#3a4e63" : "#dde0e6" },
                ]}
                onPress={() => setShowCreate(false)}
              >
                <Text style={[styles.actionBtnText, { color: subTextColor }]}>
                  {t("abort")}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.actionBtn,
                  { backgroundColor: Colors.universal.primary },
                ]}
                onPress={handleCreateFolder}
              >
                <Text style={[styles.actionBtnText, { color: "#fff" }]}>
                  {t("createFolder")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={[
              styles.newFolderBtn,
              { borderColor: Colors.universal.primary + "60" },
            ]}
            onPress={() => setShowCreate(true)}
          >
            <Ionicons
              name="add-circle-outline"
              size={20}
              color={Colors.universal.primary}
            />
            <Text
              style={[
                styles.newFolderBtnText,
                { color: Colors.universal.primary },
              ]}
            >
              {t("createFolder")}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <View
        style={[
          styles.footer,
          { paddingBottom: insets.bottom + 8, borderTopColor: borderColor },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.doneBtn,
            { backgroundColor: Colors.universal.primary },
          ]}
          onPress={closeSheet}
          activeOpacity={0.8}
        >
          <Text style={styles.doneBtnText}>{t("done")}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  sheetRoot: {
    flex: 1,
    overflow: "hidden",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 15,
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },

  title: {
    fontSize: 17,
    fontWeight: "800",
  },

  closeBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },

  scrollArea: {
    flex: 1,
    minHeight: 0,
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 8,
  },

  emptyText: {
    fontSize: 14,
    textAlign: "center",
    paddingVertical: 24,
  },

  folderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },

  folderDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },

  folderName: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
  },

  createForm: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 12,
    marginTop: 4,
  },

  input: {
    height: 44,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 15,
  },

  colorLabel: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },

  colorRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  colorDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },

  colorDotSelected: {
    borderWidth: 3,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },

  createActions: {
    flexDirection: "row",
    gap: 10,
  },

  actionBtn: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    borderColor: "transparent",
  },

  actionBtnText: {
    fontSize: 14,
    fontWeight: "700",
  },

  newFolderBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 4,
  },

  newFolderBtnText: {
    fontSize: 14,
    fontWeight: "700",
  },

  footer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },

  doneBtn: {
    height: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  doneBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
  },
});
