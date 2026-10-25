import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { GestureDetector, useTapGesture, usePanGesture, useExclusiveGestures } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import type { Memory } from '@/db/schema';
import { CARD_H, CARD_W } from '@/lib/rope';
import { thumbnailSource, type ImmichConfig } from '@/services/immich';
import type { Positions } from './Rope';

type Props = {
  memory: Memory;
  config: ImmichConfig;
  positions: SharedValue<Positions>;
  selected: boolean;
  onTap: (id: number) => void;
  onMoved: (id: number, x: number, y: number) => void;
};

export function PhotoCard({ memory, config, positions, selected, onTap, onMoved }: Props) {
  const id = memory.id;

  // Nhấn giữ rồi mới kéo, để vuốt bình thường vẫn cuộn được bảng.
  const pan = usePanGesture({
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
    return { transform: [{ translateX: p.x }, { translateY: p.y }, { rotate: `${memory.rotation}deg` }] };
  });

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.card, selected && styles.selected, style]}>
        <View style={styles.pin} />
        <Image source={thumbnailSource(config, memory.asset_id)} style={styles.photo} contentFit="cover" />
        <Text style={styles.date} numberOfLines={1}>
          {memory.taken_at ? new Date(memory.taken_at).toLocaleDateString('vi-VN') : ''}
          {memory.place ? ` · ${memory.place}` : ''}
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
    backgroundColor: '#fffdf8',
    padding: 8,
    paddingBottom: 0,
    borderRadius: 2,
    shadowColor: '#3b2a1a',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  selected: { borderWidth: 2, borderColor: '#d9534f' },
  pin: {
    position: 'absolute',
    top: 4,
    left: CARD_W / 2 - 6,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#c0392b',
    zIndex: 1,
  },
  photo: { width: CARD_W - 16, height: CARD_W - 16, backgroundColor: '#e8e0d0' },
  date: { marginTop: 4, fontSize: 12, color: '#5a4632', textAlign: 'center' },
});
