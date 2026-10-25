export type Tilt = { x: number; y: number };

// Ảnh nổi cao nhất DEPTH px khi nghiêng hết cỡ; dây ở giữa thấp hơn (gần mặt bần), bóng nằm trên mặt bần.
export const DEPTH = 10;

const clamp1 = (v: number) => Math.max(-1, Math.min(1, v));

// Một bước lọc cảm biến trọng lực (g theo trục màn hình, đơn vị g). Mốc "cầm máy bình thường" trôi chậm theo tay
// (~3 giây), nên cầm thẳng hay ngả đều về 0; độ nghiêng là phần lệch khỏi mốc, −1..1 (~30° là hết cỡ).
export function tiltStep(rest: Tilt | null, g: Tilt): { rest: Tilt; tilt: Tilt } {
  'worklet';
  const r = rest ?? g;
  const next = { x: r.x + (g.x - r.x) * 0.01, y: r.y + (g.y - r.y) * 0.01 };
  return { rest: next, tilt: { x: clamp1((g.x - next.x) * 2), y: clamp1((g.y - next.y) * 2) } };
}

export const CARD_W = 140;
export const CARD_H = 178;
const PIN_Y = 10;

// Hai đầu dây (ở đinh ghim, nổi theo ảnh) và điểm võng giữa (Bézier bậc 2), võng theo độ dài dây
// và lệch theo hướng trọng lực khi nghiêng máy sang ngang. Chạy trên UI thread (worklet), và trong Node khi test.
export function ropeEnds(ax: number, ay: number, bx: number, by: number, tilt: Tilt = { x: 0, y: 0 }) {
  'worklet';
  const ox = tilt.x * DEPTH;
  const oy = tilt.y * DEPTH;
  const x1 = ax + CARD_W / 2 + ox;
  const y1 = ay + PIN_Y + oy;
  const x2 = bx + CARD_W / 2 + ox;
  const y2 = by + PIN_Y + oy;
  const sag = Math.min(90, 12 + Math.hypot(x2 - x1, y2 - y1) * 0.2);
  const dx = tilt.x * 0.8;
  const len = Math.hypot(dx, 1);
  // Giữa dây gần mặt bần hơn nên nổi ít hơn hai đầu.
  const cx = (x1 + x2) / 2 + (sag * dx) / len - ox * 0.6;
  const cy = (y1 + y2) / 2 + sag / len - oy * 0.6;
  return { x1, y1, x2, y2, cx, cy };
}

export function ropePath(ax: number, ay: number, bx: number, by: number): string {
  'worklet';
  const r = ropeEnds(ax, ay, bx, by);
  return `M ${r.x1} ${r.y1} Q ${r.cx} ${r.cy} ${r.x2} ${r.y2}`;
}

// Gỡ một ảnh nằm giữa chuỗi dây tự động A–X–B: trả về [A, B] để nối lại, khỏi đứt chuỗi.
export function bridgeNeighbors(autoRopes: { from_id: number; to_id: number }[], removedId: number): [number, number] | null {
  const n = autoRopes.map((r) => (r.from_id === removedId ? r.to_id : r.from_id)).filter((id) => id !== removedId);
  return n.length === 2 ? [n[0], n[1]] : null;
}

// Bố cục tự động: nhận id đã sắp theo ngày và bề rộng khung, trả về vị trí ảnh, kích thước mặt bảng
// và các cặp ảnh nối dây.
export type Layout = {
  pos: Record<number, { x: number; y: number }>;
  width: number;
  height: number;
  ropes: [number, number][];
};

const chain = (ids: number[]): [number, number][] => ids.slice(1).map((id, i) => [ids[i], id]);

// Dòng thời gian: so le hai bên giữa màn hình; màn hẹp thì một cột.
export function timelineLayout(ids: number[], width: number): Layout {
  const c = width / 2;
  const twoCols = width >= 360;
  const pos: Layout['pos'] = {};
  ids.forEach((id, i) => {
    pos[id] = twoCols
      ? { x: i % 2 ? c + 14 : c - CARD_W - 14, y: 30 + i * 130 }
      : { x: c - CARD_W / 2, y: 30 + i * 210 };
  });
  const lastY = ids.length ? pos[ids[ids.length - 1]].y : 0;
  return { pos, width, height: lastY + CARD_H + 120, ropes: chain(ids) };
}
