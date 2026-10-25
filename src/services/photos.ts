import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { exifDate } from '@/lib/exif';

// Ảnh gốc ở lại thư viện ảnh của máy; app chỉ giữ một bản thu nhỏ để ghim lên bảng.
const dir = new Directory(Paths.document, 'photos');
const MAX_SIDE = 600;

export type PickedPhoto = { file: string; takenAt: string | null };

// DB chỉ lưu tên file: trên iOS đường dẫn thư mục app có thể đổi sau mỗi lần cập nhật.
export const photoUri = (file: string) => new File(dir, file).uri;

export async function pickPhotos(): Promise<PickedPhoto[]> {
  const r = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: 20,
    exif: true,
    quality: 1,
  });
  if (r.canceled) return [];

  dir.create({ idempotent: true, intermediates: true });
  const out: PickedPhoto[] = [];
  for (const a of r.assets) {
    const side = a.width >= a.height ? { width: Math.min(a.width, MAX_SIDE) } : { height: Math.min(a.height, MAX_SIDE) };
    const img = await ImageManipulator.manipulate(a.uri).resize(side).renderAsync();
    const saved = await img.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    new File(saved.uri).move(new File(dir, name));
    out.push({ file: name, takenAt: exifDate(a.exif) });
  }
  return out;
}

export function deletePhotos(files: string[]) {
  for (const f of files) {
    const file = new File(dir, f);
    if (file.exists) file.delete();
  }
}
