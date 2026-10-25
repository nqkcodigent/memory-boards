// EXIF ghi ngày dạng "2025:02:14 19:30:05" (giờ địa phương, không múi giờ). Đổi sang "2025-02-14T19:30:05".
export function exifDate(exif: Record<string, unknown> | null | undefined): string | null {
  const raw = exif?.DateTimeOriginal ?? exif?.DateTime;
  if (typeof raw !== 'string') return null;
  const m = raw.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}` : null;
}

// Ngày người dùng gõ dạng "14.02.2025" (hoặc 14/02/2025, 14-2-2025) → "2025-02-14T12:00:00".
// Giữ giờ của ngày cũ nếu có, để sửa ngày không làm lệch thứ tự các ảnh chụp cùng ngày.
export function parseViDate(text: string, keepTimeFrom?: string | null): string | null {
  const m = text.trim().match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (!m) return null;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const check = new Date(Date.UTC(y, mo - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null;
  const time = keepTimeFrom?.slice(10, 19).match(/^T\d{2}:\d{2}:\d{2}$/) ? keepTimeFrom.slice(10, 19) : 'T12:00:00';
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}${time}`;
}

export const formatViDate = (iso: string) => iso.slice(0, 10).split('-').reverse().join('.');
