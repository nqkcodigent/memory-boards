// Chạy: npm test (Node 22.18+ tự bỏ type TypeScript).
import assert from 'node:assert/strict';
import { CARD_W, ropePath } from './rope.ts';

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

console.log('rope ok');
