import { Image } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  GestureDetector, useExclusiveGestures, usePanGesture, useRotationGesture, useSimultaneousGestures, useTapGesture,
} from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import type { Memory } from '@/db/schema';
import { CARD_H, CARD_W, DEPTH, type Tilt } from '@/lib/rope';
import { colors, handFont } from '@/lib/theme';
import { photoUri } from '@/services/photos';
import type { Positions } from './Rope';

type Props = {
  memory: Memory;
  positions: SharedValue<Positions>;
  tilt: SharedValue<Tilt>;
  selected: boolean;
  draggable: boolean;
  rotation: number;
  onTap: (id: number) => void;
  onMoved: (id: number, x: number, y: number) => void;
  // Có thì cho xoay ảnh bằng hai ngón (chỉ trên Bảng).
  onRotated?: (id: number, deg: number) => void;
};

const fmtDate = (iso: string) => iso.slice(0, 10).split('-').reverse().join('.');

export function PhotoCard({ memory, positions, tilt, selected, draggable, rotation, onTap, onMoved, onRotated }: Props) {
  const id = memory.id;
  const angle = useSharedValue(rotation);
  useEffect(() => { angle.value = rotation; }, [rotation, angle]);

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
  const rotate = useRotationGesture({
    enabled: onRotated !== undefined,
    onUpdate: (e) => { angle.value += (e.rotationChange * 180) / Math.PI; },
    onDeactivate: () => { if (onRotated) scheduleOnRN(onRotated, id, angle.value); },
  });
  // Kéo và xoay cùng lúc được; chạm chỉ khi không kéo/xoay.
  const gesture = useExclusiveGestures(useSimultaneousGestures(pan, rotate), tap);

  // Ảnh nổi DEPTH px theo hướng nghiêng. Bóng giữ cố định: đổi bóng iOS mỗi khung hình rất tốn.
  const style = useAnimatedStyle(() => {
    const p = positions.value[id] ?? { x: memory.x, y: memory.y };
    const t = tilt.value;
    return { transform: [{ translateX: p.x + t.x * DEPTH }, { translateY: p.y + t.y * DEPTH }, { rotate: `${angle.value}deg` }] };
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
        <Image source={photoUri(memory.asset_id)} style={styles.photo} contentFit="cover" />
        {memory.kind === 'video' && <Text style={styles.play}>▶</Text>}
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
    shadowOpacity: 0.3,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 4 },
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
  play: {
    position: 'absolute', top: 8 + (CARD_W - 16) / 2 - 18, left: CARD_W / 2 - 18, width: 36, height: 36, borderRadius: 18,
    overflow: 'hidden', textAlign: 'center', lineHeight: 36, fontSize: 16, color: '#fff', backgroundColor: 'rgba(0,0,0,0.45)',
  },
  date: { marginTop: 3, fontSize: 13, fontFamily: handFont, color: colors.inkDim, textAlign: 'center' },
  caption: { fontSize: 17, fontFamily: handFont, color: colors.ink, textAlign: 'center' },
  placeholder: { color: colors.inkDim, opacity: 0.6 },
});
