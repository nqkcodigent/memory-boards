import { PatrickHand_400Regular, useFonts } from '@expo-google-fonts/patrick-hand';
import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { migrateDbIfNeeded } from '@/db/schema';
import { colors, handFont } from '@/lib/theme';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ PatrickHand_400Regular });
  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      <SQLiteProvider databaseName="memory-board.db" onInit={migrateDbIfNeeded}>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.wall },
            headerTintColor: colors.chalk,
            headerTitleStyle: { fontFamily: handFont, fontSize: 24 },
            headerShadowVisible: false,
            contentStyle: { backgroundColor: colors.wall },
          }}
        >
          <Stack.Screen name="index" options={{ title: 'Bảng Kỷ Niệm' }} />
          <Stack.Screen name="settings" options={{ title: 'Kết nối Immich' }} />
          <Stack.Screen name="board/[id]" options={{ title: '' }} />
        </Stack>
      </SQLiteProvider>
    </GestureHandlerRootView>
  );
}
