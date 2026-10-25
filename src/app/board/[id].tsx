import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, ImageBackground, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import {
  SensorType, useAnimatedReaction, useAnimatedSensor, useReducedMotion, useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg from 'react-native-svg';

import { Album } from '@/components/Album';
import { PhotoCard } from '@/components/PhotoCard';
import type { Details } from '@/components/DetailsSheet';
import { PhotoPreview } from '@/components/PhotoPreview';
import { Rope, type Positions } from '@/components/Rope';
import {
  addConnection, addMemory, deleteMemory, getBoard, listConnections, listMemories, moveMemory, rotateMemory,
  toggleConnection, updateCaption, updateDetails,
  type Board, type Connection, type Memory,
} from '@/db/schema';
import { tiltStep, timelineLayout, type Tilt } from '@/lib/rope';
import { colors, handFont } from '@/lib/theme';
import { deletePhotos, pickMedia } from '@/services/photos';

// shortcut: bảng cố định 2000×2000 và chỉ cuộn, chưa có pinch-zoom; thêm zoom khi bảng đông ảnh.
const BOARD_SIZE = 2000;
const FRAME = 10;
const SIDEBAR_W = 168;
const cork = require('../../../assets/cork.png');

// Ba cách xem cùng một bộ ảnh: Bảng (tự kéo thả, lưu vị trí), Thời gian (tự xếp theo ngày), Tất cả (album theo tháng).
const LAYOUTS = {
  timeline: { label: 'Thời gian', hint: 'Ảnh tự xếp theo ngày, dây nối lần lượt từng kỷ niệm.' },
  grid: { label: 'Tất cả', hint: 'Mọi ảnh và video theo tháng. Chạm ảnh để xem lớn.' },
};
type View_ = 'board' | keyof typeof LAYOUTS;
const VIEWS: View_[] = ['board', 'timeline', 'grid'];
const monthYear = (iso: string) => iso.slice(0, 7).split('-').reverse().join('.');

// Độ nghiêng máy cho hiệu ứng nổi, cập nhật 30 lần/giây trên UI thread. Tắt khi người dùng bật Giảm chuyển động.
function useTilt() {
  const reduceMotion = useReducedMotion();
  const { sensor } = useAnimatedSensor(SensorType.GRAVITY, { interval: 33 });
  const rest = useSharedValue<Tilt | null>(null);
  const tilt = useSharedValue<Tilt>({ x: 0, y: 0 });
  const ios = Platform.OS === 'ios';
  // Chỉ theo dõi cảm biến; ghi `rest` trong phần theo dõi sẽ tự kích hoạt lại chính nó mãi (treo máy, iOS đóng app).
  useAnimatedReaction(() => sensor.value, (g) => {
    // Cảm biến chưa có số liệu đầu tiên thì bỏ qua, kẻo lấy (0, 0) làm mốc rồi ảnh giật khi số liệu thật tới.
    if (reduceMotion || (g.x === 0 && g.y === 0 && g.z === 0)) return;
    // Đổi về trục màn hình (y hướng xuống): iOS báo trục y hướng lên, Android báo ngược dấu cả hai trục.
    const s = ios ? { x: g.x / 9.81, y: -g.y / 9.81 } : { x: -g.x / 9.81, y: g.y / 9.81 };
    const r = tiltStep(rest.value, s);
    rest.value = r.rest;
    // Lệch dưới 0,2px thì bỏ qua: cảm biến rung nhẹ liên tục, đỡ phải vẽ lại mọi ảnh và dây khi để máy yên.
    const t = tilt.value;
    if (Math.abs(r.tilt.x - t.x) > 0.02 || Math.abs(r.tilt.y - t.y) > 0.02) tilt.value = r.tilt;
  });
  return tilt;
}

export default function BoardScreen() {
  const db = useSQLiteContext();
  const boardId = Number(useLocalSearchParams<{ id: string }>().id);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const landscape = width > height;
  // Bề rộng phần bảng bần bên trong khung (dòng thời gian xếp ảnh theo bề rộng này).
  const frameW = landscape
    ? width - (insets.left + SIDEBAR_W) - 6 - (insets.right + 6) - FRAME * 2
    : width - 12 - FRAME * 2;

  const [board, setBoard] = useState<Board | null>(null);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const positions = useSharedValue<Positions>({});
  const tilt = useTilt();
  // Chiều cao trong khung bảng, để nền bần phủ kín khung kể cả khi chỉ có 1–2 ảnh.
  const [frameH, setFrameH] = useState(0);

  const [view, setView] = useState<View_>('board');
  const [connecting, setConnecting] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [pinning, setPinning] = useState(false);
  const [viewingId, setViewingId] = useState<number | null>(null);
  const scroll = useRef({ x: 0, y: 0 });

  const byDate = useMemo(
    () => [...memories].sort((a, b) => (a.taken_at ?? '').localeCompare(b.taken_at ?? '')),
    [memories],
  );
  const layout = useMemo(
    () => (view === 'timeline' ? timelineLayout(byDate.map((m) => m.id), frameW) : null),
    [view, byDate, frameW],
  );
  const ropes = layout
    ? layout.ropes.map(([from, to]) => ({ key: `${view}${from}-${to}`, from, to, color: colors.jute }))
    : connections.map((c) => ({ key: `c${c.id}`, from: c.from_id, to: c.to_id, color: c.kind === 'manual' ? colors.yarn : colors.jute }));

  const reload = useCallback(async () => {
    const [m, c] = await Promise.all([listMemories(db, boardId), listConnections(db, boardId)]);
    setMemories(m);
    setConnections(c);
  }, [db, boardId]);

  useEffect(() => {
    getBoard(db, boardId).then(setBoard);
    reload();
  }, [db, boardId, reload]);

  useEffect(() => {
    positions.value = layout ? layout.pos : Object.fromEntries(memories.map((m) => [m.id, { x: m.x, y: m.y }]));
  }, [layout, memories, positions]);

  const onMoved = useCallback((id: number, x: number, y: number) => {
    moveMemory(db, id, x, y);
    setMemories((ms) => ms.map((m) => (m.id === id ? { ...m, x, y } : m)));
  }, [db]);

  const onTap = useCallback(async (id: number) => {
    if (!connecting) return setViewingId(id);
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
      const photos = await pickMedia();
      const pinned = [...byDate];
      for (const [i, p] of photos.entries()) {
        const r = await addMemory(db, {
          board_id: boardId,
          asset_id: p.file,
          original: p.original,
          kind: p.kind,
          taken_at: p.takenAt,
          place: null,
          // Đặt gần chỗ đang xem, xếp lệch nhau và nghiêng ±3° cho giống ảnh ghim tay.
          x: scroll.current.x + 30 + (i % 3) * 160 + Math.random() * 30,
          y: scroll.current.y + 40 + Math.floor(i / 3) * 200 + Math.random() * 30,
          rotation: Math.random() * 6 - 3,
        });
        // Tự nối với kỷ niệm ngay trước nó theo ngày (ảnh không có ngày thì để người dùng tự nối).
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

  // Lưu khi rời ô ghi chú và khi đóng; chỉ ghi DB khi nội dung thật sự đổi.
  async function saveCaption(id: number, caption: string) {
    const m = memories.find((x) => x.id === id);
    if (!m || caption.trim() === (m.caption ?? '')) return;
    await updateCaption(db, id, caption);
    await reload();
  }

  async function saveDetails(id: number, d: Details) {
    await updateDetails(db, id, d);
    await reload();
  }

  const onRotated = useCallback((id: number, deg: number) => {
    rotateMemory(db, id, deg);
    setMemories((ms) => ms.map((m) => (m.id === id ? { ...m, rotation: deg } : m)));
  }, [db]);

  async function closePreview(id: number, caption: string) {
    await saveCaption(id, caption);
    setViewingId(null);
  }

  // Gỡ xong vẫn ở màn xem, chuyển sang kỷ niệm kế tiếp để dọn nhanh cả loạt; hết ảnh thì đóng.
  async function removePhoto(id: number) {
    const m = await deleteMemory(db, id);
    if (m) deletePhotos([m.asset_id, m.original]);
    if (memories.length <= 1) setViewingId(null);
    await reload();
  }

  const span = byDate.length && byDate[0].taken_at
    ? ` · ${monthYear(byDate[0].taken_at)} – ${monthYear(byDate[byDate.length - 1].taken_at ?? '')}`
    : '';
  const hint = view !== 'board'
    ? LAYOUTS[view].hint
    : connecting
      ? (selected ? 'Chạm ảnh thứ hai để nối. Hai ảnh đã nối thì dây được gỡ.' : 'Chạm một ảnh để bắt đầu nối dây.')
      : 'Nhấn giữ ảnh để kéo, xoay bằng hai ngón. Chạm ảnh để xem lớn, ghi chú hoặc gỡ.';
  const boardW = layout ? Math.max(layout.width, frameW) : BOARD_SIZE;
  const boardH = layout ? Math.max(layout.height, frameH) : BOARD_SIZE;

  const summary = <Text style={styles.summary}>{`${memories.length} kỷ niệm${view === 'board' ? ` · ${connections.length} sợi dây` : ''}${span}`}</Text>;
  const seg = (
    <View style={[styles.seg, landscape && styles.segColumn]} accessibilityRole="tablist">
      {VIEWS.map((v) => (
        <Pressable
          key={v}
          style={[styles.segItem, view === v && styles.segActive]}
          onPress={() => switchView(v)}
          accessibilityRole="tab"
          accessibilityState={{ selected: view === v }}
        >
          <Text style={[styles.segText, view === v && styles.segTextActive]}>{v === 'board' ? 'Bảng' : LAYOUTS[v].label}</Text>
        </Pressable>
      ))}
    </View>
  );
  const actions = (
    <>
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
    </>
  );

  return (
    <View style={[styles.screen, landscape && styles.screenRow]}>
      {/* Xoay ngang: ẩn thanh tiêu đề để bảng chiếm gần hết màn hình, thao tác dồn vào sidebar. */}
      <Stack.Screen options={{ title: board?.name ?? '', headerShown: !landscape }} />
      {landscape ? (
        <View style={[styles.sidebar, { width: insets.left + SIDEBAR_W, paddingLeft: insets.left + 12, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Quay lại danh sách bảng" style={styles.back}>
            <Text style={styles.backText}>‹ Các bảng</Text>
          </Pressable>
          <Text style={styles.sideTitle} numberOfLines={2}>{board?.name ?? ''}</Text>
          {summary}
          {seg}
          <View style={styles.sideActions}>{actions}</View>
        </View>
      ) : (
        <View style={styles.top}>
          {summary}
          {seg}
          <Text style={styles.hint}>{hint}</Text>
        </View>
      )}

      <View
        style={[styles.frame, landscape && { marginTop: insets.top + 6, marginBottom: insets.bottom + 6, marginRight: insets.right + 6 }]}
        onLayout={(e) => setFrameH(e.nativeEvent.layout.height - FRAME * 2)}
      >
        {view === 'grid' ? (
          <ImageBackground source={cork} resizeMode="repeat" style={styles.fill}>
            <Album memories={byDate} width={frameW} onTap={onTap} />
          </ImageBackground>
        ) : (
        <ScrollView onScroll={(e) => { scroll.current.y = e.nativeEvent.contentOffset.y; }} scrollEventThrottle={64}>
          <ScrollView
            horizontal
            scrollEnabled={boardW > frameW}
            onScroll={(e) => { scroll.current.x = e.nativeEvent.contentOffset.x; }}
            scrollEventThrottle={64}
          >
            <ImageBackground source={cork} resizeMode="repeat" style={{ width: boardW, height: boardH }}>
              <Svg width={boardW} height={boardH} style={StyleSheet.absoluteFill} pointerEvents="none">
                {ropes.map((r) => <Rope key={r.key} positions={positions} tilt={tilt} from={r.from} to={r.to} color={r.color} />)}
              </Svg>
              {memories.map((m) => (
                <PhotoCard
                  key={m.id}
                  memory={m}
                  positions={positions}
                  tilt={tilt}
                  selected={selected === m.id}
                  draggable={view === 'board'}
                  rotation={layout ? 0 : m.rotation}
                  onRotated={view === 'board' ? onRotated : undefined}
                  onTap={onTap}
                  onMoved={onMoved}
                />
              ))}
            </ImageBackground>
          </ScrollView>
        </ScrollView>
        )}
      </View>

      {!landscape && <View style={styles.toolbar}>{actions}</View>}

      <PhotoPreview items={byDate} startId={viewingId} onSave={saveCaption} onClose={closePreview} onRemove={removePhoto} onSaveDetails={saveDetails} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.wall },
  fill: { flex: 1 },
  screenRow: { flexDirection: 'row' },
  sidebar: { paddingRight: 4, gap: 10 },
  back: { minHeight: 36, justifyContent: 'center' },
  backText: { color: colors.chalk, fontWeight: '600' },
  sideTitle: { color: colors.chalk, fontFamily: handFont, fontSize: 24, lineHeight: 26 },
  sideActions: { marginTop: 'auto', gap: 8 },
  segColumn: { alignSelf: 'stretch' },
  top: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10, gap: 8 },
  summary: { color: colors.chalkDim, fontSize: 13 },
  hint: { color: colors.chalkDim, fontSize: 13 },
  seg: { flexDirection: 'row', flexWrap: 'wrap', alignSelf: 'flex-start', backgroundColor: colors.wall2, borderRadius: 18, padding: 3 },
  segItem: { paddingHorizontal: 12, minHeight: 34, justifyContent: 'center', borderRadius: 999 },
  segActive: { backgroundColor: colors.chalk },
  segText: { color: colors.chalkDim, fontWeight: '500' },
  segTextActive: { color: colors.ink },
  frame: { flex: 1, marginHorizontal: 6, borderWidth: FRAME, borderColor: colors.frame, borderRadius: 6, backgroundColor: colors.cork, overflow: 'hidden' },
  toolbar: { position: 'absolute', bottom: 28, left: 16, right: 16, flexDirection: 'row', gap: 8, justifyContent: 'center' },
  tool: { backgroundColor: colors.wall2, borderRadius: 22, paddingHorizontal: 18, minHeight: 44, justifyContent: 'center', elevation: 3 },
  toolPrimary: { backgroundColor: colors.accent },
  toolActive: { backgroundColor: colors.yarn },
  toolText: { color: colors.chalk, fontWeight: '600' },
  toolTextDark: { color: colors.ink, fontWeight: '600' },
});
