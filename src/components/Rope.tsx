import Animated, { useAnimatedProps, type SharedValue } from 'react-native-reanimated';
import { G, Path } from 'react-native-svg';

import { ropePath } from '@/lib/rope';
import { colors } from '@/lib/theme';

export type Positions = Record<number, { x: number; y: number }>;

const AnimatedPath = Animated.createAnimatedComponent(Path);

// Dây đọc vị trí ảnh từ shared value nên chạy theo ngón tay trên UI thread, không re-render React.
// Ba lớp như demo: bóng đổ, sợi chính, vân xoắn của dây gai.
export function Rope({ positions, from, to, color }: {
  positions: SharedValue<Positions>;
  from: number;
  to: number;
  color: string;
}) {
  const path = () => {
    'worklet';
    const a = positions.value[from];
    const b = positions.value[to];
    return { d: a && b ? ropePath(a.x, a.y, b.x, b.y) : '' };
  };
  const shadow = useAnimatedProps(path);
  const main = useAnimatedProps(path);
  const twist = useAnimatedProps(path);
  return (
    <>
      <G transform="translate(1 3)">
        <AnimatedPath animatedProps={shadow} stroke="rgba(30,15,5,0.35)" strokeWidth={4} fill="none" />
      </G>
      <AnimatedPath animatedProps={main} stroke={color} strokeWidth={3.2} fill="none" strokeLinecap="round" />
      <AnimatedPath animatedProps={twist} stroke={colors.juteDark} strokeWidth={1.2} strokeDasharray="2 4" opacity={0.7} fill="none" />
    </>
  );
}
