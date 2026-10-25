import assert from 'node:assert/strict';

import { tiltStep } from './rope.ts';

// Lần đầu: mốc là tư thế hiện tại, chưa nghiêng.
let s = tiltStep(null, { x: 0, y: 0.7 });
assert.deepEqual(s.tilt, { x: 0, y: 0 });

// Nghiêng mạnh sang phải: kẹp ở 1.
s = tiltStep(s.rest, { x: 0.9, y: 0.7 });
assert.equal(s.tilt.x, 1);

// Giữ nguyên tư thế mới một lúc: mốc trôi theo, độ nghiêng về gần 0.
for (let i = 0; i < 600; i++) s = tiltStep(s.rest, { x: 0.9, y: 0.7 });
assert.ok(Math.abs(s.tilt.x) < 0.01);
console.log('tilt ok');
