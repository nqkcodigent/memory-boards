import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { GestureDetector, useTapGesture, usePanGesture, useExclusiveGestures } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import type { Memory } from '@/db/schema';
import { CARD_H, CARD_W } from '@/lib/rope';
import { colors, handFont } from '@/lib/theme';
import { thumbnailSource, type ImmichConfig } from '@/services/immich';
import type { Positions } from './Rope';

type Props = {
  memory: Memory;
  config: ImmichConfig;
  positions: SharedValue<Positions>;
  selected: boolean;
  draggable: boolean;
  onTap: (id: number) => void;
  onMoved: (id: number, x: number, y: number) => void;
};

const fmtDate = (iso: string) => iso.slice(0, 10).split('-').reverse().join('.');

export function PhotoCard({ memory, config, positions, selected, draggable, onTap, onMoved }: Props) {
  const id = memory.id;
  const rotation = draggable ? memory.rotation : 0;

  // Nhấn giữ rồi mới kéo, để vuốt bình thường vẫn cuộn được bảng.
  const pan = usePanGesture({
    enabled: draggable,
    activateAfterLongPress: 250,
    onUpdate: (e) => {
      positions.modify((p) => {
        'worklet';
        const cur = p[id];
        if (cur) p[id] = { x: cur.x + e.changeX, y: cur.y + e.changeY };
        return p;
      }, true);
    },
    onDeactivate: () => {
      const cur = positions.value[id];
      if (cur) scheduleOnRN(onMoved, id, cur.x, cur.y);
    },
  });
  const tap = useTapGesture({ onDeactivate: (e) => { if (!e.canceled) scheduleOnRN(onTap, id); } });
  const gesture = useExclusiveGestures(pan, tap);

  const style = useAnimatedStyle(() => {
    const p = positions.value[id] ?? { x: memory.x, y: memory.y };
    return { transform: [{ translateX: p.x }, { translateY: p.y }, { rotate: `${rotation}deg` }] };
  });

  const meta = [memory.taken_at && fmtDate(memory.taken_at), memory.place].filter(Boolean).join(' · ');
  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[styles.card, selected && styles.selected, style]}
        accessible
        accessibilityRole="button"
        accessibilityLabel={[memory.caption, meta].filter(Boolean).join(', ') || 'Ảnh kỷ niệm'}
      >
        <View style={styles.pin} />
        <Image source={thumbnailSource(config, memory.asset_id)} style={styles.photo} contentFit="cover" />
        <Text style={styles.date} numberOfLines={1}>{meta}</Text>
        <Text style={[styles.caption, !memory.caption && styles.placeholder]} numberOfLines={1}>
          {memory.caption || 'Chạm để ghi chú'}
        </Text>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    width: CARD_W,
    height: CARD_H,
    backgroundColor: colors.paper,
    padding: 8,
    paddingBottom: 0,
    borderRadius: 2,
    shadowColor: '#28190a',
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  selected: { borderWidth: 3, borderColor: colors.yarn },
  pin: {
    position: 'absolute',
    top: 3,
    left: CARD_W / 2 - 7,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.pin,
    borderWidth: 2,
    borderColor: '#e0675a',
    zIndex: 1,
  },
  photo: { width: CARD_W - 16, height: CARD_W - 16, backgroundColor: '#e8e0d0' },
  date: { marginTop: 3, fontSize: 13, fontFamily: handFont, color: colors.inkDim, textAlign: 'center' },
  caption: { fontSize: 17, fontFamily: handFont, color: colors.ink, textAlign: 'center' },
  placeholder: { color: colors.inkDim, opacity: 0.6 },
});
