import Animated, { useAnimatedProps, type SharedValue } from 'react-native-reanimated';
import { Path } from 'react-native-svg';

import { ropePath } from '@/lib/rope';

export type Positions = Record<number, { x: number; y: number }>;

const AnimatedPath = Animated.createAnimatedComponent(Path);

// Dây đọc vị trí ảnh từ shared value nên chạy theo ngón tay trên UI thread, không re-render React.
export function Rope({ positions, from, to, color }: {
  positions: SharedValue<Positions>;
  from: number;
  to: number;
  color: string;
}) {
  const animatedProps = useAnimatedProps(() => {
    const a = positions.value[from];
    const b = positions.value[to];
    return { d: a && b ? ropePath(a.x, a.y, b.x, b.y) : '' };
  });
  return <AnimatedPath animatedProps={animatedProps} stroke={color} strokeWidth={3} fill="none" strokeLinecap="round" />;
}
