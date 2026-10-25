export const CARD_W = 140;
export const CARD_H = 178;
const PIN_Y = 10;

// Đường cong Bézier bậc 2 giữa hai đinh ghim, võng xuống theo độ dài dây.
// Chạy trên UI thread (worklet) khi kéo ảnh, và cả trong Node khi test.
export function ropePath(ax: number, ay: number, bx: number, by: number): string {
  'worklet';
  const x1 = ax + CARD_W / 2;
  const y1 = ay + PIN_Y;
  const x2 = bx + CARD_W / 2;
  const y2 = by + PIN_Y;
  const dist = Math.hypot(x2 - x1, y2 - y1);
  const sag = Math.min(90, 12 + dist * 0.2);
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2 + sag;
  return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
}

// Dòng thời gian: xếp ảnh (đã sắp theo ngày) so le hai bên giữa màn hình; màn hẹp thì một cột.
export function timelineLayout(ids: number[], width: number) {
  const c = width / 2;
  const twoCols = width >= 360;
  const pos: Record<number, { x: number; y: number }> = {};
  ids.forEach((id, i) => {
    pos[id] = twoCols
      ? { x: i % 2 ? c + 14 : c - CARD_W - 14, y: 30 + i * 130 }
      : { x: c - CARD_W / 2, y: 30 + i * 210 };
  });
  const lastY = ids.length ? pos[ids[ids.length - 1]].y : 0;
  return { pos, height: lastY + CARD_H + 120 };
}
