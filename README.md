# memory-board

Bảng kỷ niệm: ghim ảnh từ Immich lên bảng bần, nối bằng dây. Ảnh gốc nằm trên Immich; app chỉ lưu vị trí, dây và chú thích trong SQLite trên máy.

## Chạy

```bash
npm install
npx expo start
```

Quét QR bằng Expo Go trên điện thoại (cùng mạng Wi‑Fi với máy tính).

Vào **Immich** (góc phải màn hình đầu) → nhập địa chỉ server và API key → **Lưu và kiểm tra**.

## Cách dùng bảng

- **＋ Ghim ảnh**: chọn ảnh mới nhất trên Immich để ghim.
- **Nhấn giữ** ảnh rồi kéo để di chuyển; dây chạy theo.
- **〰 Nối dây**: chạm hai ảnh để nối.
- Nhấn giữ một bảng ở màn hình đầu để xoá.

## Kiểm tra

```bash
npm run typecheck
npm test
```

## Cấu trúc

- `src/app/`: các màn hình (expo-router)
- `src/db/schema.ts`: bảng SQLite `boards`, `memories`, `connections` và các câu truy vấn
- `src/services/immich.ts`: gọi Immich API, API key cất trong expo-secure-store
- `src/components/`: `PhotoCard` (ảnh Polaroid kéo được), `Rope` (dây SVG)
- `src/lib/rope.ts`: tính đường cong võng của dây

## Lưu ý

- Bản build Android (không phải Expo Go) mặc định chặn `http://`. Hãy dùng HTTPS, ví dụ Tailscale Serve hoặc Cloudflare Tunnel, hoặc bật `usesCleartextTraffic` qua `expo-build-properties`.
