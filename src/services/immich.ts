import * as SecureStore from 'expo-secure-store';

export type ImmichConfig = { url: string; apiKey: string };

export type ImmichAsset = {
  id: string;
  type: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'OTHER';
  originalFileName: string;
  localDateTime: string;
  exifInfo?: { city?: string | null };
};

const URL_KEY = 'immich_url';
const API_KEY = 'immich_api_key';

export async function loadConfig(): Promise<ImmichConfig | null> {
  const [url, apiKey] = await Promise.all([
    SecureStore.getItemAsync(URL_KEY),
    SecureStore.getItemAsync(API_KEY),
  ]);
  return url && apiKey ? { url, apiKey } : null;
}

export async function saveConfig({ url, apiKey }: ImmichConfig) {
  await SecureStore.setItemAsync(URL_KEY, url.trim().replace(/\/+$/, ''));
  await SecureStore.setItemAsync(API_KEY, apiKey.trim());
}

async function request<T>(c: ImmichConfig, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${c.url}/api${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'x-api-key': c.apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Immich ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

// Gọi endpoint cần đăng nhập để kiểm tra cả địa chỉ lẫn API key.
export const checkConnection = (c: ImmichConfig) =>
  request<{ id: string; name: string }>(c, '/users/me');

// shortcut: dùng page/order (Immich đánh dấu deprecated từ v3.2 nhưng vẫn chạy trên mọi bản v1–v3);
// chuyển sang cursor/filter/orderBy khi bỏ hỗ trợ server cũ.
export async function recentAssets(c: ImmichConfig, page = 1, size = 60) {
  const r = await request<{ assets: { items: ImmichAsset[]; nextPage: string | null } }>(
    c,
    '/search/metadata',
    { page, size, order: 'desc', withExif: true },
  );
  return r.assets;
}

// expo-image gửi kèm header, nên ảnh không cần public.
export const thumbnailSource = (c: ImmichConfig, assetId: string, size: 'thumbnail' | 'preview' = 'thumbnail') => ({
  uri: `${c.url}/api/assets/${assetId}/thumbnail?size=${size}`,
  headers: { 'x-api-key': c.apiKey },
  cacheKey: `${assetId}-${size}`,
});
