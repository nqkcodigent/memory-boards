import assert from 'node:assert/strict';
import { exifDate } from './exif.ts';

assert.equal(exifDate({ DateTimeOriginal: '2025:02:14 19:30:05' }), '2025-02-14T19:30:05');
assert.equal(exifDate({ DateTime: '2026:03:08 07:00:00' }), '2026-03-08T07:00:00');
// Ảnh chụp màn hình hoặc ảnh tải về thường không có EXIF.
assert.equal(exifDate({}), null);
assert.equal(exifDate(null), null);
assert.equal(exifDate({ DateTimeOriginal: 'garbage' }), null);

console.log('exif ok');
