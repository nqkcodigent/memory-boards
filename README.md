# memory-board

Bảng kỷ niệm: ghim ảnh lên bảng bần, nối bằng dây. Ảnh và video chọn từ thư viện của điện thoại; app giữ ảnh vuông 512px cho bảng và bản gốc (ảnh không nén lại, video 1080p) để xem toàn màn hình, cùng vị trí, dây và chú thích trong SQLite trên máy. Không cần server, chạy offline.

## Chạy

```bash
npm install
npx expo start
```

Mở bằng Expo Go trên điện thoại (cùng Wi‑Fi với máy tính). Trên iPhone, Expo Go và Expo CLI phải đăng nhập cùng một tài khoản Expo.

## Cách dùng bảng

- **＋ Ghim ảnh**: chọn tối đa 20 ảnh hoặc video một lần. Ảnh có ngày chụp sẽ tự nối dây với kỷ niệm ngay trước nó.
- **Nhấn giữ** ảnh rồi kéo để di chuyển; dây chạy theo.
- **Chạm** ảnh để ghi chú.
- **Nối dây**: chạm hai ảnh để nối; chạm lại hai ảnh đã nối để gỡ.
- **Cách xem**: Bảng (tự kéo thả, xoay ảnh bằng hai ngón), Thời gian (tự xếp theo ngày), Tất cả (album theo tháng).
- **Chiều sâu**: nghiêng máy thì ảnh và dây nổi lên, tách khỏi bóng nằm yên trên mặt bần; dây võng theo trọng lực và đung đưa khi kéo ảnh. Tắt khi bật Giảm chuyển động.
- Nhấn giữ một bảng ở màn hình đầu để xoá (ảnh gốc trong thư viện không bị xoá).

## Kiểm tra

```bash
npm run typecheck
npm test
```

## Cấu trúc

- `src/app/`: các màn hình (expo-router)
- `src/db/schema.ts`: bảng SQLite `boards`, `memories`, `connections` và các câu truy vấn
- `src/services/photos.ts`: chọn ảnh, thu nhỏ, lưu và xoá file ảnh trong máy
- `src/components/`: `PhotoCard` (ảnh Polaroid kéo được), `Rope` (dây SVG)
- `src/lib/`: đường cong dây, bố cục dòng thời gian, đọc ngày EXIF, bảng màu
- `demo/board.html`: bản demo giao diện chạy trên trình duyệt
- `server/`: hướng dẫn dựng Immich trên Oracle Cloud (chưa dùng, giữ lại nếu sau này muốn có server)

## Lưu ý

- Dữ liệu chỉ nằm trên điện thoại. Đổi máy hoặc xoá app thì mất bảng (ảnh gốc vẫn còn trong thư viện).
# memory-boards
