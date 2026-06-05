import React from "react";
import { Stack } from "expo-router";
const _layout = () => {
  return (
    <Stack screenOptions={{ headerBackButtonMenuEnabled: false }}>
      <Stack.Screen
        name="datenschutz"
        options={{
          presentation: "formSheet",
          animation: "default",
        }}
      />
    </Stack>
  );
};

export default _layout;
