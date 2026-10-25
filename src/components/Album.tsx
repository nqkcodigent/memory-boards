import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { Memory } from '@/db/schema';
import { colors, handFont } from '@/lib/theme';
import { photoUri } from '@/services/photos';

const GAP = 3;
const PAD = 8;

// Gom theo tháng chụp (memories đã sắp theo ngày); ảnh không có ngày dồn vào cuối.
export function groupByMonth(memories: Pick<Memory, 'taken_at'>[]) {
  const groups = new Map<string, number[]>();
  memories.forEach((m, i) => {
    const key = m.taken_at ? m.taken_at.slice(5, 7) + '.' + m.taken_at.slice(0, 4) : 'Chưa rõ ngày';
    groups.set(key, [...(groups.get(key) ?? []), i]);
  });
  return [...groups].sort(([a], [b]) => (a === 'Chưa rõ ngày' ? 1 : b === 'Chưa rõ ngày' ? -1 : 0));
}

// Lưới: album ảnh vuông kín bề rộng khung, nhiều cột hơn khi xoay ngang, chia mục theo tháng.
export function Album({ memories, width, onTap }: { memories: Memory[]; width: number; onTap: (id: number) => void }) {
  const cols = Math.max(3, Math.floor(width / 130));
  const size = Math.floor((width - PAD * 2 - GAP * (cols - 1)) / cols);
  return (
    <ScrollView contentContainerStyle={styles.content}>
      {groupByMonth(memories).map(([month, idx]) => (
        <View key={month} style={styles.section}>
          <Text style={styles.month}>{month}</Text>
          <View style={styles.grid}>
            {idx.map((i) => {
              const m = memories[i];
              return (
                <Pressable
                  key={m.id}
                  onPress={() => onTap(m.id)}
                  accessibilityRole="button"
                  accessibilityLabel={m.caption ?? (m.kind === 'video' ? 'Video kỷ niệm' : 'Ảnh kỷ niệm')}
                >
                  <Image source={photoUri(m.asset_id)} style={{ width: size, height: size }} contentFit="cover" />
                  {m.kind === 'video' && <Text style={styles.play}>▶</Text>}
                  {m.caption && <Text style={[styles.caption, { width: size }]} numberOfLines={1}>{m.caption}</Text>}
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: PAD, paddingBottom: 120, gap: 14 },
  section: { gap: 6 },
  month: { fontFamily: handFont, fontSize: 22, color: colors.ink },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  play: {
    position: 'absolute', right: 6, top: 6, color: '#fff', fontSize: 14,
    textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 3,
  },
  caption: {
    position: 'absolute', left: 0, bottom: 0, paddingHorizontal: 6, paddingVertical: 2,
    fontFamily: handFont, fontSize: 14, color: '#fff', backgroundColor: 'rgba(0,0,0,0.4)',
  },
});
