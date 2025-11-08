import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import "../global.css";
export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ title: "Home" }} />
      <StatusBar style="auto" />
    </Stack>
  );
}
