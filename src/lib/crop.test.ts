import assert from 'node:assert/strict';
import { squareCrop } from './crop.ts';

// Ảnh ngang 4032x3024: cắt giữa theo chiều ngang.
assert.deepEqual(squareCrop(4032, 3024), { originX: 504, originY: 0, width: 3024, height: 3024 });
// Ảnh dọc 1080x1920: cắt giữa theo chiều dọc.
assert.deepEqual(squareCrop(1080, 1920), { originX: 0, originY: 420, width: 1080, height: 1080 });
// Ảnh vuông và cạnh lẻ: không vượt khỏi ảnh.
assert.deepEqual(squareCrop(500, 500), { originX: 0, originY: 0, width: 500, height: 500 });
const odd = squareCrop(1001, 600);
assert.ok(odd.originX + odd.width <= 1001);

console.log('crop ok');
