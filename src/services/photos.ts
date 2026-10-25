import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import * as VideoThumbnails from 'expo-video-thumbnails';

import { PHOTO_PX, squareCrop } from '@/lib/crop';
import { exifDate } from '@/lib/exif';

// Mỗi kỷ niệm có hai file: ảnh vuông 512px cho thẻ trên bảng, và bản gốc để xem toàn màn hình.
// Ảnh gốc giữ nguyên định dạng của máy (HEIC trên iPhone), không nén lại nên không mất nét.
const dir = new Directory(Paths.document, 'photos');

export type PickedMedia = { file: string; original: string; kind: 'photo' | 'video'; takenAt: string | null };

// Ảnh ghim từ bản cũ có bản xem lớn 1600px tên "-full.jpg".
const legacyPreview = (file: string) => file.replace(/\.jpg$/, '-full.jpg');

// DB chỉ lưu tên file: trên iOS đường dẫn thư mục app có thể đổi sau mỗi lần cập nhật.
export const photoUri = (file: string) => new File(dir, file).uri;

export function previewUri(file: string, original: string | null) {
  for (const name of [original, legacyPreview(file)]) {
    if (name && new File(dir, name).exists) return new File(dir, name).uri;
  }
  return photoUri(file);
}

export async function pickMedia(): Promise<PickedMedia[]> {
  const r = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images', 'videos'],
    allowsMultipleSelection: true,
    selectionLimit: 20,
    exif: true,
    quality: 1,
    // iOS: lấy đúng file trong Ảnh (HEIC) thay vì chuyển sang JPEG.
    preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current,
    // iOS: video 4K được chuyển về 1080p, nét trên điện thoại mà nhẹ hơn khoảng 4 lần.
    videoExportPreset: ImagePicker.VideoExportPreset.H264_1920x1080,
  });
  if (r.canceled) return [];

  dir.create({ idempotent: true, intermediates: true });
  const out: PickedMedia[] = [];
  for (const a of r.assets) {
    const kind = a.type === 'video' ? 'video' : 'photo';
    const source = kind === 'video' ? (await VideoThumbnails.getThumbnailAsync(a.uri, { time: 500, quality: 1 })).uri : a.uri;
    // Lấy kích thước sau khi xoay theo EXIF, không tin width/height của picker (ảnh dọc có thể bị đảo).
    const full = await ImageManipulator.manipulate(source).renderAsync();
    const side = Math.min(full.width, full.height, PHOTO_PX);
    const thumb = await ImageManipulator.manipulate(full)
      .crop(squareCrop(full.width, full.height))
      .resize({ width: side, height: side })
      .renderAsync();
    const saved = await thumb.saveAsync({ compress: 0.9, format: SaveFormat.JPEG });

    const base = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const ext = (a.uri.split('.').pop() ?? (kind === 'video' ? 'mp4' : 'jpg')).toLowerCase();
    const file = `${base}.jpg`;
    const original = `${base}-orig.${ext}`;
    new File(saved.uri).move(new File(dir, file));
    // File picker đưa ra nằm trong cache của app, chuyển hẳn sang thư mục lâu dài.
    new File(a.uri).move(new File(dir, original));
    out.push({ file, original, kind, takenAt: kind === 'photo' ? exifDate(a.exif) : null });
  }
  return out;
}

export function deletePhotos(files: (string | null)[]) {
  for (const f of files.flatMap((f) => (f ? [f, legacyPreview(f)] : []))) {
    const file = new File(dir, f);
    if (file.exists) file.delete();
  }
}
