import assert from 'node:assert/strict';
import { exifDate, formatViDate, parseViDate } from './exif.ts';

assert.equal(exifDate({ DateTimeOriginal: '2025:02:14 19:30:05' }), '2025-02-14T19:30:05');
assert.equal(exifDate({ DateTime: '2026:03:08 07:00:00' }), '2026-03-08T07:00:00');
// Ảnh chụp màn hình hoặc ảnh tải về thường không có EXIF.
assert.equal(exifDate({}), null);
assert.equal(exifDate(null), null);
assert.equal(exifDate({ DateTimeOriginal: 'garbage' }), null);

console.log('exif ok');

assert.equal(parseViDate('14.02.2025'), '2025-02-14T12:00:00');
assert.equal(parseViDate(' 1/2/2026 '), '2026-02-01T12:00:00');
assert.equal(parseViDate('8-3-2026', '2026-03-01T07:15:30'), '2026-03-08T07:15:30');
assert.equal(parseViDate('31.02.2025'), null, 'ngày không tồn tại');
assert.equal(parseViDate('2025-02-14'), null, 'sai thứ tự ngày/tháng/năm');
assert.equal(parseViDate(''), null);
assert.equal(formatViDate('2025-02-14T19:30:05'), '14.02.2025');
console.log('vi date ok');
