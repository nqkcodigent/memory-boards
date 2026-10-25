import Animated, {
  useAnimatedProps, useAnimatedReaction, useSharedValue, withSpring, type SharedValue,
} from 'react-native-reanimated';
import { Path } from 'react-native-svg';

import { DEPTH, ropeEnds, type Tilt } from '@/lib/rope';
import { colors } from '@/lib/theme';

export type Positions = Record<number, { x: number; y: number }>;

const AnimatedPath = Animated.createAnimatedComponent(Path);
// Giảm chấn thấp: điểm võng trễ theo ảnh rồi đung đưa vài nhịp mới đứng yên.
const SWING = { damping: 7, stiffness: 90, mass: 1 };

// Dây đọc vị trí ảnh từ shared value nên chạy theo ngón tay trên UI thread, không re-render React.
// Ba lớp như demo: bóng đổ trên mặt bần, sợi chính, vân xoắn của dây gai.
export function Rope({ positions, tilt, from, to, color }: {
  positions: SharedValue<Positions>;
  tilt: SharedValue<Tilt>;
  from: number;
  to: number;
  color: string;
}) {
  // shortcut: dây vật lý là một điểm võng gắn lò xo thay vì chuỗi điểm; đủ cho dây ngắn, cần chuỗi khi dây dài quấn quanh ảnh.
  const cx = useSharedValue(0);
  const cy = useSharedValue(0);
  useAnimatedReaction(
    () => {
      const a = positions.value[from];
      const b = positions.value[to];
      return a && b ? ropeEnds(a.x, a.y, b.x, b.y, tilt.value) : null;
    },
    (t, prev) => {
      if (!t) return;
      if (!prev) {
        cx.value = t.cx;
        cy.value = t.cy;
      } else if (t.cx !== prev.cx || t.cy !== prev.cy) {
        cx.value = withSpring(t.cx, SWING);
        cy.value = withSpring(t.cy, SWING);
      }
    },
  );

  const path = (dx: number, dy: number) => {
    'worklet';
    const a = positions.value[from];
    const b = positions.value[to];
    if (!a || !b) return { d: '' };
    const r = ropeEnds(a.x, a.y, b.x, b.y, tilt.value);
    return { d: `M ${r.x1 + dx} ${r.y1 + dy} Q ${cx.value + dx} ${cy.value + dy} ${r.x2 + dx} ${r.y2 + dy}` };
  };
  // Bóng nằm trên mặt bần nên không nổi theo dây: lệch ngược hướng nghiêng.
  const shadow = useAnimatedProps(() => path(1 - tilt.value.x * DEPTH * 0.6, 4 - tilt.value.y * DEPTH * 0.6));
  const main = useAnimatedProps(() => path(0, 0));
  const twist = useAnimatedProps(() => path(0, 0));
  return (
    <>
      <AnimatedPath animatedProps={shadow} stroke="rgba(30,15,5,0.22)" strokeWidth={5} fill="none" strokeLinecap="round" />
      <AnimatedPath animatedProps={main} stroke={color} strokeWidth={3.2} fill="none" strokeLinecap="round" />
      <AnimatedPath animatedProps={twist} stroke={colors.juteDark} strokeWidth={1.2} strokeDasharray="2 4" opacity={0.7} fill="none" />
    </>
  );
}
