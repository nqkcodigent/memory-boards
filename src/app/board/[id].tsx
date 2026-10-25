import { Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, ImageBackground, Modal, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';
import Svg from 'react-native-svg';

import { PhotoCard } from '@/components/PhotoCard';
import { Rope, type Positions } from '@/components/Rope';
import {
  addConnection, addMemory, getBoard, listConnections, listMemories, moveMemory, toggleConnection, updateCaption,
  type Board, type Connection, type Memory,
} from '@/db/schema';
import { timelineLayout } from '@/lib/rope';
import { colors, handFont } from '@/lib/theme';
import { pickPhotos } from '@/services/photos';

// shortcut: bảng cố định 2000×2000 và chỉ cuộn, chưa có pinch-zoom; thêm zoom khi bảng đông ảnh.
const BOARD_SIZE = 2000;
const FRAME = 10;
const cork = require('../../../assets/cork.png');

type View_ = 'board' | 'timeline';
const monthYear = (iso: string) => iso.slice(0, 7).split('-').reverse().join('.');

export default function BoardScreen() {
  const db = useSQLiteContext();
  const boardId = Number(useLocalSearchParams<{ id: string }>().id);
  const { width } = useWindowDimensions();

  const [board, setBoard] = useState<Board | null>(null);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const positions = useSharedValue<Positions>({});

  const [view, setView] = useState<View_>('board');
  const [connecting, setConnecting] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [pinning, setPinning] = useState(false);
  const [editing, setEditing] = useState<Memory | null>(null);
  const scroll = useRef({ x: 0, y: 0 });

  const byDate = useMemo(
    () => [...memories].sort((a, b) => (a.taken_at ?? '').localeCompare(b.taken_at ?? '')),
    [memories],
  );
  const timeline = useMemo(() => timelineLayout(byDate.map((m) => m.id), width - FRAME * 2), [byDate, width]);
  const ropes = view === 'board'
    ? connections.map((c) => ({ key: `c${c.id}`, from: c.from_id, to: c.to_id, color: c.color }))
    : byDate.slice(1).map((m, i) => ({ key: `t${m.id}`, from: byDate[i].id, to: m.id, color: colors.jute }));

  const reload = useCallback(async () => {
    const [m, c] = await Promise.all([listMemories(db, boardId), listConnections(db, boardId)]);
    setMemories(m);
    setConnections(c);
  }, [db, boardId]);

  useEffect(() => {
    getBoard(db, boardId).then(setBoard);
    reload();
  }, [db, boardId, reload]);

  // Bảng dùng vị trí đã lưu; dòng thời gian dùng vị trí tính theo ngày (không lưu).
  useEffect(() => {
    positions.value = view === 'board'
      ? Object.fromEntries(memories.map((m) => [m.id, { x: m.x, y: m.y }]))
      : timeline.pos;
  }, [view, memories, timeline, positions]);

  const onMoved = useCallback((id: number, x: number, y: number) => {
    moveMemory(db, id, x, y);
    setMemories((ms) => ms.map((m) => (m.id === id ? { ...m, x, y } : m)));
  }, [db]);

  const onTap = useCallback(async (id: number) => {
    if (!connecting) return setEditing(memories.find((m) => m.id === id) ?? null);
    if (selected === null) return setSelected(id);
    if (selected !== id) {
      await toggleConnection(db, boardId, selected, id);
      await reload();
    }
    setSelected(null);
  }, [connecting, selected, memories, db, boardId, reload]);

  function switchView(v: View_) {
    setView(v);
    setConnecting(false);
    setSelected(null);
  }

  async function pin() {
    setPinning(true);
    try {
      const photos = await pickPhotos();
      if (photos.length) switchView('board');
      const pinned = [...byDate];
      for (const [i, p] of photos.entries()) {
        const r = await addMemory(db, {
          board_id: boardId,
          asset_id: p.file,
          taken_at: p.takenAt,
          place: null,
          // Đặt gần chỗ đang xem, xếp lệch nhau và nghiêng ±3° cho giống ảnh ghim tay.
          x: scroll.current.x + 30 + (i % 3) * 160 + Math.random() * 30,
          y: scroll.current.y + 40 + Math.floor(i / 3) * 200 + Math.random() * 30,
          rotation: Math.random() * 6 - 3,
        });
        // Như demo: tự nối với kỷ niệm ngay trước nó theo ngày (ảnh không có ngày thì để người dùng tự nối).
        const prev = p.takenAt ? pinned.filter((m) => m.taken_at && m.taken_at < p.takenAt!).pop() : undefined;
        if (prev) await addConnection(db, boardId, prev.id, r.lastInsertRowId, 'auto');
        pinned.push({ id: r.lastInsertRowId, taken_at: p.takenAt } as Memory);
        pinned.sort((a, b) => (a.taken_at ?? '').localeCompare(b.taken_at ?? ''));
      }
      await reload();
    } finally {
      setPinning(false);
    }
  }

  async function saveCaption(text: string) {
    if (!editing) return;
    await updateCaption(db, editing.id, text);
    setEditing(null);
    await reload();
  }

  const span = byDate.length && byDate[0].taken_at
    ? ` · ${monthYear(byDate[0].taken_at)} – ${monthYear(byDate[byDate.length - 1].taken_at ?? '')}`
    : '';
  const hint = view === 'timeline'
    ? 'Ảnh tự xếp theo ngày, dây nối lần lượt từng kỷ niệm.'
    : connecting
      ? (selected ? 'Chạm ảnh thứ hai để nối. Hai ảnh đã nối thì dây được gỡ.' : 'Chạm một ảnh để bắt đầu nối dây.')
      : 'Nhấn giữ ảnh để kéo. Chạm ảnh để ghi chú.';
  const boardW = view === 'board' ? BOARD_SIZE : width - FRAME * 2;
  const boardH = view === 'board' ? BOARD_SIZE : timeline.height;

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: board?.name ?? '' }} />
      <View style={styles.top}>
        <Text style={styles.summary}>{`${memories.length} kỷ niệm · ${connections.length} sợi dây${span}`}</Text>
        <View style={styles.seg} accessibilityRole="tablist">
          {(['board', 'timeline'] as const).map((v) => (
            <Pressable
              key={v}
              style={[styles.segItem, view === v && styles.segActive]}
              onPress={() => switchView(v)}
              accessibilityRole="tab"
              accessibilityState={{ selected: view === v }}
            >
              <Text style={[styles.segText, view === v && styles.segTextActive]}>{v === 'board' ? 'Bảng' : 'Dòng thời gian'}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.hint}>{hint}</Text>
      </View>

      <View style={styles.frame}>
        <ScrollView onScroll={(e) => { scroll.current.y = e.nativeEvent.contentOffset.y; }} scrollEventThrottle={64}>
          <ScrollView
            horizontal
            scrollEnabled={view === 'board'}
            onScroll={(e) => { scroll.current.x = e.nativeEvent.contentOffset.x; }}
            scrollEventThrottle={64}
          >
            <ImageBackground source={cork} resizeMode="repeat" style={{ width: boardW, height: boardH }}>
              <Svg width={boardW} height={boardH} style={StyleSheet.absoluteFill} pointerEvents="none">
                {ropes.map((r) => <Rope key={r.key} positions={positions} from={r.from} to={r.to} color={r.color} />)}
              </Svg>
              {memories.map((m) => (
                <PhotoCard
                  key={m.id}
                  memory={m}
                  positions={positions}
                  selected={selected === m.id}
                  draggable={view === 'board'}
                  onTap={onTap}
                  onMoved={onMoved}
                />
              ))}
            </ImageBackground>
          </ScrollView>
        </ScrollView>
      </View>

      <View style={styles.toolbar}>
        <Pressable style={[styles.tool, styles.toolPrimary]} onPress={pin} disabled={pinning} accessibilityRole="button">
          {pinning ? <ActivityIndicator color={colors.ink} /> : <Text style={styles.toolTextDark}>＋ Ghim ảnh</Text>}
        </Pressable>
        {view === 'board' && (
          <Pressable
            style={[styles.tool, connecting && styles.toolActive]}
            onPress={() => { setConnecting(!connecting); setSelected(null); }}
            accessibilityRole="button"
            accessibilityState={{ selected: connecting }}
          >
            <Text style={styles.toolText}>{connecting ? 'Xong' : 'Nối dây'}</Text>
          </Pressable>
        )}
      </View>

      <CaptionEditor memory={editing} onClose={() => setEditing(null)} onSave={saveCaption} />
    </View>
  );
}

function CaptionEditor({ memory, onClose, onSave }: {
  memory: Memory | null;
  onClose: () => void;
  onSave: (text: string) => void;
}) {
  const [text, setText] = useState('');
  useEffect(() => setText(memory?.caption ?? ''), [memory]);
  return (
    <Modal visible={memory !== null} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Ghi chú kỷ niệm</Text>
          <TextInput
            style={styles.captionInput}
            value={text}
            onChangeText={setText}
            placeholder="Ví dụ: Săn mây Đà Lạt"
            maxLength={40}
            autoFocus
            onSubmitEditing={() => onSave(text)}
          />
          <View style={styles.sheetActions}>
            <Pressable onPress={onClose} accessibilityRole="button"><Text style={styles.link}>Huỷ</Text></Pressable>
            <Pressable style={[styles.tool, styles.toolPrimary]} onPress={() => onSave(text)} accessibilityRole="button">
              <Text style={styles.toolTextDark}>Lưu</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.wall },
  top: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10, gap: 8 },
  summary: { color: colors.chalkDim, fontSize: 13 },
  hint: { color: colors.chalkDim, fontSize: 13 },
  link: { color: colors.jute, fontWeight: '600', padding: 12 },
  seg: { flexDirection: 'row', alignSelf: 'flex-start', backgroundColor: colors.wall2, borderRadius: 999, padding: 3 },
  segItem: { paddingHorizontal: 14, minHeight: 34, justifyContent: 'center', borderRadius: 999 },
  segActive: { backgroundColor: colors.chalk },
  segText: { color: colors.chalkDim, fontWeight: '500' },
  segTextActive: { color: colors.ink },
  frame: { flex: 1, marginHorizontal: 6, borderWidth: FRAME, borderColor: colors.frame, borderRadius: 6, backgroundColor: colors.cork, overflow: 'hidden' },
  toolbar: { position: 'absolute', bottom: 28, left: 16, right: 16, flexDirection: 'row', gap: 8, justifyContent: 'center' },
  tool: { backgroundColor: colors.wall2, borderRadius: 22, paddingHorizontal: 18, minHeight: 44, justifyContent: 'center', elevation: 3 },
  toolPrimary: { backgroundColor: colors.jute },
  toolActive: { backgroundColor: colors.yarn },
  toolText: { color: colors.chalk, fontWeight: '600' },
  toolTextDark: { color: colors.ink, fontWeight: '600' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  sheet: { backgroundColor: colors.paper, borderRadius: 8, padding: 16, gap: 12 },
  sheetTitle: { fontFamily: handFont, fontSize: 24, color: colors.ink },
  captionInput: { fontFamily: handFont, fontSize: 20, color: colors.ink, borderBottomWidth: 1, borderColor: colors.inkDim, minHeight: 44 },
  sheetActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 8 },
});
