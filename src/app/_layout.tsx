import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { migrateDbIfNeeded } from '@/db/schema';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SQLiteProvider databaseName="memory-board.db" onInit={migrateDbIfNeeded}>
        <Stack screenOptions={{ headerStyle: { backgroundColor: '#f3e9d8' }, headerTintColor: '#5a4632' }}>
          <Stack.Screen name="index" options={{ title: 'Bảng kỷ niệm' }} />
          <Stack.Screen name="settings" options={{ title: 'Kết nối Immich' }} />
          <Stack.Screen name="board/[id]" options={{ title: '' }} />
        </Stack>
      </SQLiteProvider>
    </GestureHandlerRootView>
  );
}
