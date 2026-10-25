# Chạy Immich trên Oracle Cloud Always Free

Máy chủ chạy 24/7 nên tắt laptop app vẫn dùng được. Điện thoại kết nối qua Tailscale (HTTPS, không mở cổng ra internet).

## 1. Đăng ký Oracle Cloud

1. Vào https://www.oracle.com/cloud/free/ → **Start for free**.
2. Chọn **Home Region** gần Việt Nam (Singapore hoặc Tokyo). **Không đổi được về sau**, và tài nguyên miễn phí chỉ có ở region này.
3. Nhập thẻ để xác minh. Gói Always Free không trừ tiền.

## 2. Tạo máy chủ

**Compute → Instances → Create instance**:

- **Image**: Canonical Ubuntu 24.04 (bản aarch64).
- **Shape**: Ampere → `VM.Standard.A1.Flex`, chọn số OCPU và RAM lớn nhất mà trang còn ghi *Always Free-eligible*.
  - Nếu báo *Out of capacity*: thử lại sau vài giờ, hoặc đổi Availability Domain.
- **Networking**: để mặc định (VCN mới, có public IP).
- **SSH keys**: chọn **Generate a key pair** và tải **private key** về, ví dụ `C:\Users\nguye\.ssh\oracle.key`.
- **Boot volume**: tích **Specify a custom boot volume size**, nhập **190 GB**. Tổng mức miễn phí là 200 GB, chừa 10 GB dư.

Bấm **Create**, đợi trạng thái **Running**, rồi chép **Public IP address**.

## 3. Cài Immich

Trên laptop, mở PowerShell ở thư mục dự án:

```bash
scp -i C:\Users\nguye\.ssh\oracle.key server/setup-oracle.sh ubuntu@<PUBLIC_IP>:~
ssh -i C:\Users\nguye\.ssh\oracle.key ubuntu@<PUBLIC_IP>
```

Trong máy chủ:

```bash
bash setup-oracle.sh
```

Script sẽ dừng ở bước Tailscale và in một link: mở link, đăng nhập Tailscale (tạo tài khoản miễn phí nếu chưa có). Nếu nó hỏi bật **HTTPS certificates**, mở link đó và bật.

## 4. Điện thoại

1. Cài **Tailscale** (App Store / Google Play), đăng nhập **cùng tài khoản**, bật kết nối.
2. Mở Safari tới địa chỉ `https://….ts.net` script vừa in → tạo tài khoản admin Immich.
3. Cài app **Immich** để tự sao lưu ảnh lên server (Backup → bật).
4. Trên web Immich: **Account Settings → API Keys → New API Key** → chép key.
5. Trong Bảng Kỷ Niệm: **Immich** → nhập địa chỉ `https://….ts.net` và key → **Lưu và kiểm tra**.

## Lưu ý

- **Oracle thu hồi máy nhàn rỗi**: nếu suốt 7 ngày CPU, mạng và RAM đều rất thấp, máy Always Free có thể bị thu hồi. Để tránh: **Billing → Upgrade to Pay As You Go**. Vẫn miễn phí nếu chỉ dùng tài nguyên Always Free.
- **Sao lưu**: Oracle có thể khoá tài khoản miễn phí bất kỳ lúc nào. Vẫn nên sao lưu ảnh ra nơi khác (ví dụ Cloudflare R2, khoảng 1,35 USD/tháng cho 100 GB).
- **Cập nhật Immich**: `cd ~/immich && sudo docker compose pull && sudo docker compose up -d`. Đọc release note trước khi nâng cấp.
