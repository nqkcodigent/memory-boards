import type { SQLiteDatabase } from 'expo-sqlite';

import { bridgeNeighbors } from '@/lib/rope';

export type Board = { id: number; name: string; created_at: string };

// asset_id là tên file ảnh thu nhỏ trong thư mục app (xem services/photos.ts); ảnh gốc ở lại thư viện ảnh.
export type Memory = {
  id: number;
  board_id: number;
  asset_id: string;
  taken_at: string | null;
  place: string | null;
  caption: string | null;
  x: number;
  y: number;
  rotation: number;
  kind: 'photo' | 'video';
  // Bản gốc để xem toàn màn hình (ảnh không nén lại, video 1080p); null với ảnh ghim từ bản cũ.
  original: string | null;
  // Người trong ảnh, cách nhau bằng dấu phẩy ("Linh, Minh").
  people: string | null;
};

export type Connection = {
  id: number;
  board_id: number;
  from_id: number;
  to_id: number;
  color: string;
  kind: 'auto' | 'manual';
};

const DATABASE_VERSION = 7;

export async function migrateDbIfNeeded(db: SQLiteDatabase) {
  // foreign_keys phải bật lại mỗi lần mở kết nối, nếu không ON DELETE CASCADE không chạy.
  await db.execAsync('PRAGMA foreign_keys = ON;');
  const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let currentDbVersion = result?.user_version ?? 0;
  if (currentDbVersion >= DATABASE_VERSION) return;

  if (currentDbVersion === 0) {
    await db.execAsync(`
PRAGMA journal_mode = 'wal';
CREATE TABLE boards (
  id INTEGER PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE memories (
  id INTEGER PRIMARY KEY NOT NULL,
  board_id INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  asset_id TEXT NOT NULL,
  taken_at TEXT,
  place TEXT,
  caption TEXT,
  x REAL NOT NULL DEFAULT 0,
  y REAL NOT NULL DEFAULT 0,
  rotation REAL NOT NULL DEFAULT 0
);
CREATE INDEX memories_board ON memories(board_id);
CREATE TABLE connections (
  id INTEGER PRIMARY KEY NOT NULL,
  board_id INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  from_id INTEGER NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  to_id INTEGER NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  color TEXT NOT NULL DEFAULT '#b08a5a',
  kind TEXT NOT NULL DEFAULT 'manual' CHECK (kind IN ('auto', 'manual')),
  UNIQUE (from_id, to_id)
);
CREATE INDEX connections_board ON connections(board_id);
`);
    currentDbVersion = 1;
  }
  if (currentDbVersion === 1) {
    await db.execAsync(`
ALTER TABLE memories ADD COLUMN kind TEXT NOT NULL DEFAULT 'photo' CHECK (kind IN ('photo', 'video'));
ALTER TABLE memories ADD COLUMN original TEXT;
`);
    currentDbVersion = 2;
  }
  if (currentDbVersion === 2) {
    // Vị trí người dùng tự kéo trong các bố cục mẫu (Trái tim, Dây phơi), tách khỏi vị trí trên Bảng.
    await db.execAsync(`
CREATE TABLE layout_positions (
  memory_id INTEGER NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  layout TEXT NOT NULL,
  x REAL NOT NULL,
  y REAL NOT NULL,
  PRIMARY KEY (memory_id, layout)
);
`);
    currentDbVersion = 3;
  }
  if (currentDbVersion === 3) {
    // Ảnh cũ thuộc Bảng; các mẫu bắt đầu trống.
    await db.execAsync("ALTER TABLE memories ADD COLUMN layout TEXT NOT NULL DEFAULT 'board';");
    currentDbVersion = 4;
  }
  if (currentDbVersion === 4) {
    // Thời gian và Lưới dùng lại ảnh của Bảng: chuyển ảnh lỡ ghim riêng vào hai mẫu này về Bảng để không bị ẩn.
    await db.execAsync("UPDATE memories SET layout = 'board' WHERE layout IN ('timeline', 'grid');");
    currentDbVersion = 5;
  }
  if (currentDbVersion === 5) {
    await db.execAsync('ALTER TABLE memories ADD COLUMN people TEXT;');
    currentDbVersion = 6;
  }
  if (currentDbVersion === 6) {
    // Bỏ hai mẫu Dây phơi và Trái tim: đưa ảnh của chúng về Bảng (không mất ảnh), bỏ bảng vị trí theo mẫu.
    // Cột memories.layout giữ lại nhưng không còn dùng (SQLite cũ không DROP COLUMN được).
    await db.execAsync(`
UPDATE memories SET layout = 'board';
DROP TABLE IF EXISTS layout_positions;
`);
    currentDbVersion = 7;
  }

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}

export const listBoards = (db: SQLiteDatabase) =>
  db.getAllAsync<Board>('SELECT * FROM boards ORDER BY created_at DESC');

export const getBoard = (db: SQLiteDatabase, id: number) =>
  db.getFirstAsync<Board>('SELECT * FROM boards WHERE id = ?', id);

export const createBoard = (db: SQLiteDatabase, name: string) =>
  db.runAsync('INSERT INTO boards (name) VALUES (?)', name);

export const deleteBoard = (db: SQLiteDatabase, id: number) =>
  db.runAsync('DELETE FROM boards WHERE id = ?', id);

export const listMemories = (db: SQLiteDatabase, boardId: number) =>
  db.getAllAsync<Memory>('SELECT * FROM memories WHERE board_id = ? ORDER BY taken_at', boardId);

export const addMemory = (
  db: SQLiteDatabase,
  m: Pick<Memory, 'board_id' | 'asset_id' | 'taken_at' | 'place' | 'x' | 'y' | 'rotation' | 'kind' | 'original'>,
) =>
  db.runAsync(
    'INSERT INTO memories (board_id, asset_id, taken_at, place, x, y, rotation, kind, original) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    m.board_id, m.asset_id, m.taken_at, m.place, m.x, m.y, m.rotation, m.kind, m.original,
  );

export const moveMemory = (db: SQLiteDatabase, id: number, x: number, y: number) =>
  db.runAsync('UPDATE memories SET x = ?, y = ? WHERE id = ?', x, y, id);

export const rotateMemory = (db: SQLiteDatabase, id: number, deg: number) =>
  db.runAsync('UPDATE memories SET rotation = ? WHERE id = ?', deg, id);

// Ngày (ISO, giờ địa phương), địa điểm, người trong ảnh; chuỗi rỗng lưu thành null.
export const updateDetails = (
  db: SQLiteDatabase,
  id: number,
  d: Pick<Memory, 'taken_at' | 'place' | 'people'>,
) =>
  db.runAsync(
    'UPDATE memories SET taken_at = ?, place = ?, people = ? WHERE id = ?',
    d.taken_at, d.place?.trim() || null, d.people?.trim() || null, id,
  );

// Gỡ ảnh khỏi bảng (dây của nó tự xoá theo ON DELETE CASCADE). Trả về bản ghi để xoá các file của nó.
export async function deleteMemory(db: SQLiteDatabase, id: number): Promise<Memory | null> {
  const m = await db.getFirstAsync<Memory>('SELECT * FROM memories WHERE id = ?', id);
  if (!m) return null;
  await db.withTransactionAsync(async () => {
    const autos = await db.getAllAsync<Connection>(
      "SELECT * FROM connections WHERE kind = 'auto' AND (from_id = ? OR to_id = ?)", id, id,
    );
    await db.runAsync('DELETE FROM memories WHERE id = ?', id);
    const pair = bridgeNeighbors(autos, id);
    if (pair) await addConnection(db, m.board_id, pair[0], pair[1], 'auto');
  });
  return m;
}

export const updateCaption = (db: SQLiteDatabase, id: number, caption: string) =>
  db.runAsync('UPDATE memories SET caption = ? WHERE id = ?', caption.trim() || null, id);

export const listConnections = (db: SQLiteDatabase, boardId: number) =>
  db.getAllAsync<Connection>('SELECT * FROM connections WHERE board_id = ?', boardId);

// Dây không có hướng: sắp id nhỏ trước để A→B và B→A trùng UNIQUE, OR IGNORE bỏ qua bản trùng.
export const addConnection = (db: SQLiteDatabase, boardId: number, a: number, b: number, kind: Connection['kind'] = 'manual') =>
  db.runAsync(
    'INSERT OR IGNORE INTO connections (board_id, from_id, to_id, color, kind) VALUES (?, ?, ?, ?, ?)',
    boardId, Math.min(a, b), Math.max(a, b), kind === 'manual' ? '#b6403a' : '#d2ad72', kind,
  );

// Chạm hai ảnh đã nối thì gỡ dây, chưa nối thì nối.
export async function toggleConnection(db: SQLiteDatabase, boardId: number, a: number, b: number) {
  const r = await db.runAsync('DELETE FROM connections WHERE from_id = ? AND to_id = ?', Math.min(a, b), Math.max(a, b));
  if (r.changes === 0) await addConnection(db, boardId, a, b);
}
