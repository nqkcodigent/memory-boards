// Chạy: npm test (Node 22.18+ tự bỏ type TypeScript).
import assert from 'node:assert/strict';
import { bridgeNeighbors, CARD_W, ropePath, timelineLayout } from './rope.ts';

const nums = (p: string) => p.split(' ').filter((t) => !Number.isNaN(Number(t))).map(Number);

// Hai ảnh ngang hàng: dây bắt đầu và kết thúc ở đinh ghim, điểm điều khiển võng xuống dưới.
const [x1, y1, cx, cy, x2, y2] = nums(ropePath(0, 0, 300, 0));
assert.equal(x1, CARD_W / 2);
assert.equal(x2, 300 + CARD_W / 2);
assert.equal(y1, y2);
assert.equal(cx, (x1 + x2) / 2);
assert.ok(cy > y1, 'dây phải võng xuống');

// Dây rất dài: độ võng bị giới hạn, không rơi khỏi bảng.
const [, ly1, , lcy] = nums(ropePath(0, 0, 5000, 0));
assert.equal(lcy - ly1, 90);

// Dòng thời gian: màn rộng so le hai bên, không ảnh nào tràn ra ngoài.
const wide = timelineLayout([1, 2, 3], 400);
assert.ok(wide.pos[1].x < 200 && wide.pos[2].x > 200, 'so le trái/phải');
assert.ok(wide.pos[1].y < wide.pos[2].y && wide.pos[2].y < wide.pos[3].y, 'đi xuống theo ngày');
for (const p of Object.values(wide.pos)) assert.ok(p.x >= 0 && p.x + CARD_W <= 400);
const narrow = timelineLayout([1, 2], 320);
assert.equal(narrow.pos[1].x, narrow.pos[2].x, 'màn hẹp: một cột');
assert.equal(timelineLayout([], 400).height > 0, true);

// Gỡ ảnh: giữa chuỗi thì nối hai đầu, ở đầu/cuối chuỗi hoặc đứng riêng thì không nối gì.
assert.deepEqual(bridgeNeighbors([{ from_id: 1, to_id: 2 }, { from_id: 2, to_id: 3 }], 2), [1, 3]);
assert.equal(bridgeNeighbors([{ from_id: 1, to_id: 2 }], 1), null);
assert.equal(bridgeNeighbors([], 5), null);
assert.equal(bridgeNeighbors([{ from_id: 1, to_id: 4 }, { from_id: 2, to_id: 4 }, { from_id: 3, to_id: 4 }], 4), null);

console.log('rope ok');
