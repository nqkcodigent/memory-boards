export type Tilt = { x: number; y: number };

// Ảnh nổi cao nhất DEPTH px khi nghiêng hết cỡ; dây ở giữa thấp hơn (gần mặt bần), bóng nằm trên mặt bần.
export const DEPTH = 10;

// Một bước lọc cảm biến trọng lực (g theo trục màn hình, đơn vị g). Mốc "cầm máy bình thường" trôi chậm theo tay
// (~3 giây), nên cầm thẳng hay ngả đều về 0; độ nghiêng là phần lệch khỏi mốc, −1..1 (~30° là hết cỡ).
// Chạy trên UI thread nên không gọi hàm thường nào (hàm không phải worklet sẽ làm app văng).
export function tiltStep(rest: Tilt | null, g: Tilt): { rest: Tilt; tilt: Tilt } {
  'worklet';
  const r = rest ?? g;
  const next = { x: r.x + (g.x - r.x) * 0.01, y: r.y + (g.y - r.y) * 0.01 };
  return {
    rest: next,
    tilt: { x: Math.max(-1, Math.min(1, (g.x - next.x) * 2)), y: Math.max(-1, Math.min(1, (g.y - next.y) * 2)) },
  };
}

export const CARD_W = 140;
export const CARD_H = 178;
const PIN_Y = 10;

// Hai đầu dây ở đinh ghim và điểm võng giữa (Bézier bậc 2), võng xuống theo độ dài dây.
// Chạy trên UI thread (worklet), và trong Node khi test.
export function ropeEnds(ax: number, ay: number, bx: number, by: number) {
  'worklet';
  const x1 = ax + CARD_W / 2;
  const y1 = ay + PIN_Y;
  const x2 = bx + CARD_W / 2;
  const y2 = by + PIN_Y;
  const sag = Math.min(90, 12 + Math.hypot(x2 - x1, y2 - y1) * 0.2);
  return { x1, y1, x2, y2, cx: (x1 + x2) / 2, cy: (y1 + y2) / 2 + sag };
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
