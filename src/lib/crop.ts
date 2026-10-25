// Ảnh trên thẻ Polaroid hiển thị vuông 124pt (372px ở màn @3x); 512px để còn dư khi hệ thống thu nhỏ.
export const PHOTO_PX = 512;

// Vùng vuông lớn nhất ở giữa ảnh.
export function squareCrop(width: number, height: number) {
  const side = Math.min(width, height);
  return {
    originX: Math.floor((width - side) / 2),
    originY: Math.floor((height - side) / 2),
    width: side,
    height: side,
  };
}
