import type { SQLiteDatabase } from 'expo-sqlite';

export type Board = { id: number; name: string; created_at: string };

// Ảnh gốc nằm trên Immich; app chỉ lưu asset_id và vị trí trên bảng.
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
};

export type Connection = {
  id: number;
  board_id: number;
  from_id: number;
  to_id: number;
  color: string;
  kind: 'auto' | 'manual';
};

const DATABASE_VERSION = 1;

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
  // if (currentDbVersion === 1) { ...migration tiếp theo... }

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
  m: Pick<Memory, 'board_id' | 'asset_id' | 'taken_at' | 'place' | 'x' | 'y' | 'rotation'>,
) =>
  db.runAsync(
    'INSERT INTO memories (board_id, asset_id, taken_at, place, x, y, rotation) VALUES (?, ?, ?, ?, ?, ?, ?)',
    m.board_id, m.asset_id, m.taken_at, m.place, m.x, m.y, m.rotation,
  );

export const moveMemory = (db: SQLiteDatabase, id: number, x: number, y: number) =>
  db.runAsync('UPDATE memories SET x = ?, y = ? WHERE id = ?', x, y, id);

export const listConnections = (db: SQLiteDatabase, boardId: number) =>
  db.getAllAsync<Connection>('SELECT * FROM connections WHERE board_id = ?', boardId);

// Dây không có hướng: sắp id nhỏ trước để A→B và B→A trùng UNIQUE, OR IGNORE bỏ qua bản trùng.
export const addConnection = (db: SQLiteDatabase, boardId: number, a: number, b: number) =>
  db.runAsync(
    'INSERT OR IGNORE INTO connections (board_id, from_id, to_id) VALUES (?, ?, ?)',
    boardId, Math.min(a, b), Math.max(a, b),
  );
