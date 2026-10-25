import { Link, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { createBoard, deleteBoard, listBoards, listMemories, type Board } from '@/db/schema';
import { colors, handFont } from '@/lib/theme';
import { deletePhotos } from '@/services/photos';

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

  async function remove(b: Board) {
    const files = (await listMemories(db, b.id)).map((m) => m.asset_id);
    await deleteBoard(db, b.id);
    deletePhotos(files);
    reload();
  }

  function confirmDelete(b: Board) {
    Alert.alert('Xoá bảng?', `"${b.name}" và mọi ảnh ghim trên đó sẽ bị xoá khỏi app (ảnh gốc trong thư viện ảnh vẫn còn).`, [
      { text: 'Huỷ', style: 'cancel' },
      { text: 'Xoá', style: 'destructive', onPress: () => remove(b) },
    ]);
  }

  return (
    <View style={styles.screen}>
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
  screen: { flex: 1, backgroundColor: colors.wall, padding: 16 },
  row: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  input: { flex: 1, backgroundColor: colors.paper, color: colors.ink, borderRadius: 8, paddingHorizontal: 12, minHeight: 44 },
  button: { backgroundColor: colors.jute, borderRadius: 8, paddingHorizontal: 16, justifyContent: 'center' },
  buttonText: { color: colors.ink, fontWeight: '600' },
  item: { backgroundColor: colors.paper, padding: 16, borderRadius: 8, marginBottom: 8 },
  itemTitle: { fontSize: 22, fontFamily: handFont, color: colors.ink },
  itemDate: { color: colors.inkDim, marginTop: 4 },
  empty: { textAlign: 'center', color: colors.chalkDim, marginTop: 32 },
});
