import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { Memory } from '@/db/schema';
import { formatViDate, parseViDate } from '@/lib/exif';
import { colors, handFont } from '@/lib/theme';

export type Details = Pick<Memory, 'taken_at' | 'place' | 'people'>;

// Sửa ngày, địa điểm và người trong ảnh. Ngày gõ dạng 14.02.2025; để trống là "chưa rõ ngày".
export function DetailsSheet({ memory, onClose, onSave }: {
  memory: Memory | null;
  onClose: () => void;
  onSave: (id: number, d: Details) => void;
}) {
  const [date, setDate] = useState('');
  const [place, setPlace] = useState('');
  const [people, setPeople] = useState('');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setDate(memory?.taken_at ? formatViDate(memory.taken_at) : '');
    setPlace(memory?.place ?? '');
    setPeople(memory?.people ?? '');
    setError(null);
  }, [memory]);

  function save() {
    if (!memory) return;
    const taken = date.trim() ? parseViDate(date, memory.taken_at) : null;
    if (date.trim() && !taken) return setError('Ngày chưa đúng. Gõ theo dạng ngày.tháng.năm, ví dụ 14.02.2025.');
    // Chuẩn hoá danh sách người: bỏ khoảng trắng thừa và tên trùng.
    const names = [...new Set(people.split(',').map((p) => p.trim()).filter(Boolean))].join(', ');
    onSave(memory.id, { taken_at: taken, place, people: names });
    onClose();
  }

  return (
    <Modal visible={memory !== null} transparent animationType="fade" onRequestClose={onClose} supportedOrientations={['portrait', 'landscape']}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Thông tin kỷ niệm</Text>
          <Text style={styles.label}>Ngày</Text>
          <TextInput style={styles.input} value={date} onChangeText={setDate} placeholder="14.02.2025" keyboardType="numbers-and-punctuation" />
          <Text style={styles.label}>Địa điểm</Text>
          <TextInput style={styles.input} value={place} onChangeText={setPlace} placeholder="Đà Lạt" maxLength={60} />
          <Text style={styles.label}>Người trong ảnh</Text>
          <TextInput style={styles.input} value={people} onChangeText={setPeople} placeholder="Linh, Minh" maxLength={120} autoCapitalize="words" />
          <Text style={styles.help}>Cách nhau bằng dấu phẩy.</Text>
          {error && <Text style={styles.error}>{error}</Text>}
          <View style={styles.actions}>
            <Pressable onPress={onClose} style={styles.btn} accessibilityRole="button"><Text style={styles.cancel}>Huỷ</Text></Pressable>
            <Pressable onPress={save} style={[styles.btn, styles.saveBtn]} accessibilityRole="button"><Text style={styles.saveText}>Lưu</Text></Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
  sheet: { backgroundColor: colors.paper, borderRadius: 10, padding: 16, gap: 4, maxWidth: 480, width: '100%', alignSelf: 'center' },
  title: { fontFamily: handFont, fontSize: 26, color: colors.ink, marginBottom: 4 },
  label: { color: colors.inkDim, fontSize: 13, marginTop: 8 },
  input: { fontSize: 17, color: colors.ink, borderBottomWidth: 1, borderColor: colors.inkDim, minHeight: 44 },
  help: { color: colors.inkDim, fontSize: 12 },
  error: { color: colors.yarn, marginTop: 8 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 16 },
  btn: { minHeight: 44, paddingHorizontal: 18, justifyContent: 'center', borderRadius: 22 },
  cancel: { color: colors.ink, fontWeight: '600' },
  saveBtn: { backgroundColor: colors.accent },
  saveText: { color: colors.ink, fontWeight: '600' },
});
