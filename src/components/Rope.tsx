import Animated, {
  useAnimatedProps, useAnimatedReaction, useDerivedValue, useSharedValue, withSpring, type SharedValue,
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
  // Lò xo chỉ khởi động khi hai ảnh của chính dây này dời chỗ, không phải mỗi lần cảm biến báo số.
  useAnimatedReaction(
    () => {
      const a = positions.value[from];
      const b = positions.value[to];
      return a && b ? ropeEnds(a.x, a.y, b.x, b.y) : null;
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

  // Tính đường dây một lần cho cả ba lớp: hai đầu nổi theo ảnh, giữa dây nổi ít hơn, bóng nằm yên trên mặt bần.
  const d = useDerivedValue(() => {
    const a = positions.value[from];
    const b = positions.value[to];
    if (!a || !b) return { main: '', shadow: '' };
    const r = ropeEnds(a.x, a.y, b.x, b.y);
    const ox = tilt.value.x * DEPTH;
    const oy = tilt.value.y * DEPTH;
    return {
      main: `M ${r.x1 + ox} ${r.y1 + oy} Q ${cx.value + ox * 0.4} ${cy.value + oy * 0.4} ${r.x2 + ox} ${r.y2 + oy}`,
      shadow: `M ${r.x1 + 1} ${r.y1 + 4} Q ${cx.value + 1} ${cy.value + 4} ${r.x2 + 1} ${r.y2 + 4}`,
    };
  });
  const shadow = useAnimatedProps(() => ({ d: d.value.shadow }));
  const main = useAnimatedProps(() => ({ d: d.value.main }));
  const twist = useAnimatedProps(() => ({ d: d.value.main }));
  return (
    <>
      <AnimatedPath animatedProps={shadow} stroke="rgba(30,15,5,0.22)" strokeWidth={5} fill="none" strokeLinecap="round" />
      <AnimatedPath animatedProps={main} stroke={color} strokeWidth={3.2} fill="none" strokeLinecap="round" />
      <AnimatedPath animatedProps={twist} stroke={colors.juteDark} strokeWidth={1.2} strokeDasharray="2 4" opacity={0.7} fill="none" />
    </>
  );
}
