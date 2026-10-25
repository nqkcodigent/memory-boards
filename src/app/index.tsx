import { Link, Stack, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { createBoard, deleteBoard, listBoards, type Board } from '@/db/schema';

export default function BoardsScreen() {
  const db = useSQLiteContext();
  const [boards, setBoards] = useState<Board[]>([]);
  const [name, setName] = useState('');

  const reload = useCallback(() => {
    listBoards(db).then(setBoards);
  }, [db]);
  useFocusEffect(reload);

  async function add() {
    if (!name.trim()) return;
    await createBoard(db, name.trim());
    setName('');
    reload();
  }

  function confirmDelete(b: Board) {
    Alert.alert('Xoá bảng?', `"${b.name}" và mọi ảnh ghim trên đó sẽ bị xoá khỏi app (ảnh gốc trên Immich vẫn còn).`, [
      { text: 'Huỷ', style: 'cancel' },
      { text: 'Xoá', style: 'destructive', onPress: () => deleteBoard(db, b.id).then(reload) },
    ]);
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Link href="/settings" style={styles.link}>Immich</Link>
          ),
        }}
      />
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          placeholder="Tên bảng mới, ví dụ: Đà Lạt 2026"
          value={name}
          onChangeText={setName}
          onSubmitEditing={add}
        />
        <Pressable style={styles.button} onPress={add} accessibilityRole="button">
          <Text style={styles.buttonText}>Tạo</Text>
        </Pressable>
      </View>
      <FlatList
        data={boards}
        keyExtractor={(b) => String(b.id)}
        ListEmptyComponent={<Text style={styles.empty}>Chưa có bảng nào.</Text>}
        renderItem={({ item }) => (
          <Link href={{ pathname: '/board/[id]', params: { id: item.id } }} asChild>
            <Pressable style={styles.item} onLongPress={() => confirmDelete(item)}>
              <Text style={styles.itemTitle}>{item.name}</Text>
              <Text style={styles.itemDate}>{new Date(item.created_at + 'Z').toLocaleDateString('vi-VN')}</Text>
            </Pressable>
          </Link>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f3e9d8', padding: 16 },
  row: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  input: { flex: 1, backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 12, minHeight: 44 },
  button: { backgroundColor: '#8b5e3c', borderRadius: 8, paddingHorizontal: 16, justifyContent: 'center' },
  buttonText: { color: '#fff', fontWeight: '600' },
  item: { backgroundColor: '#fffdf8', padding: 16, borderRadius: 8, marginBottom: 8 },
  itemTitle: { fontSize: 17, color: '#3b2a1a', fontWeight: '600' },
  itemDate: { color: '#8a7560', marginTop: 4 },
  empty: { textAlign: 'center', color: '#8a7560', marginTop: 32 },
  link: { color: '#8b5e3c', fontWeight: '600', padding: 8 },
});
