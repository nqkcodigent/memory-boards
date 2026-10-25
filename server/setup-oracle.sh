#!/usr/bin/env bash
# Cài Immich + Tailscale trên máy Ubuntu ARM (Oracle Always Free). Chạy trên máy chủ: bash setup-oracle.sh
# Chạy lại an toàn: không ghi đè .env (mật khẩu DB) và không cài lại thứ đã có.
set -euo pipefail
DIR="$HOME/immich"

if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sudo sh
fi

mkdir -p "$DIR"
cd "$DIR"
if [ ! -f .env ]; then
  # Lấy cấu hình từ bản phát hành chính thức để luôn khớp phiên bản Immich hiện tại.
  curl -fsSLo docker-compose.yml https://github.com/immich-app/immich/releases/latest/download/docker-compose.yml
  curl -fsSLo .env https://github.com/immich-app/immich/releases/latest/download/example.env
  if ! grep -q '^DB_PASSWORD=' .env; then
    echo "example.env không còn dòng DB_PASSWORD; đọc lại hướng dẫn cài đặt trên immich.app." >&2
    rm .env
    exit 1
  fi
  # Chỉ chữ và số: Immich khuyên tránh ký tự đặc biệt trong mật khẩu DB.
  sed -i "s/^DB_PASSWORD=.*/DB_PASSWORD=$(openssl rand -hex 16)/" .env
  sed -i 's|^# *TZ=.*|TZ=Asia/Ho_Chi_Minh|' .env
fi
sudo docker compose up -d

if ! command -v tailscale >/dev/null; then
  curl -fsSL https://tailscale.com/install.sh | sh
fi
# Lần đầu sẽ in một link: mở link và đăng nhập cùng tài khoản Tailscale với điện thoại.
sudo tailscale up
# HTTPS trong mạng Tailscale, không mở cổng nào ra internet.
sudo tailscale serve --bg 2283

echo
echo "Xong. Nhập địa chỉ https://... dưới đây vào app (Kết nối Immich):"
sudo tailscale serve status
