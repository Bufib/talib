import React from "react";
import { Stack } from "expo-router";
const _layout = () => {
  return (
    <Stack screenOptions={{ headerBackButtonMenuEnabled: false }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen
        name="about"
        options={{
          presentation: "formSheet",
          animation: "default",
        }}
      />

      <Stack.Screen
        name="impressum"
        options={{
          presentation: "formSheet",
          animation: "default",
        }}
      />
      <Stack.Screen
        name="add-video"
        options={{
          animation: "default",
        }}
      />
    </Stack>
  );
};

export default _layout;
