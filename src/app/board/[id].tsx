import { Image } from 'expo-image';
import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';
import Svg from 'react-native-svg';

import { PhotoCard } from '@/components/PhotoCard';
import { Rope, type Positions } from '@/components/Rope';
import {
  addConnection, addMemory, getBoard, listConnections, listMemories, moveMemory,
  type Board, type Connection, type Memory,
} from '@/db/schema';
import { loadConfig, recentAssets, thumbnailSource, type ImmichAsset, type ImmichConfig } from '@/services/immich';

// shortcut: bảng cố định 2000×2000 và chỉ cuộn, chưa có pinch-zoom; thêm zoom ở tuần 3 theo plan.
const BOARD_SIZE = 2000;

export default function BoardScreen() {
  const db = useSQLiteContext();
  const boardId = Number(useLocalSearchParams<{ id: string }>().id);

  const [board, setBoard] = useState<Board | null>(null);
  const [config, setConfig] = useState<ImmichConfig | null | undefined>(undefined);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const positions = useSharedValue<Positions>({});

  const [connecting, setConnecting] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const scroll = useRef({ x: 0, y: 0 });

  const reload = useCallback(async () => {
    const [m, c] = await Promise.all([listMemories(db, boardId), listConnections(db, boardId)]);
    positions.value = Object.fromEntries(m.map((x) => [x.id, { x: x.x, y: x.y }]));
    setMemories(m);
    setConnections(c);
  }, [db, boardId, positions]);

  useEffect(() => {
    getBoard(db, boardId).then(setBoard);
    loadConfig().then(setConfig);
    reload();
  }, [db, boardId, reload]);

  const onMoved = useCallback((id: number, x: number, y: number) => {
    moveMemory(db, id, x, y);
  }, [db]);

  const onTap = useCallback(async (id: number) => {
    if (!connecting) return;
    if (selected === null) return setSelected(id);
    if (selected !== id) {
      await addConnection(db, boardId, selected, id);
      await reload();
    }
    setSelected(null);
  }, [connecting, selected, db, boardId, reload]);

  async function pin(asset: ImmichAsset) {
    setPickerOpen(false);
    await addMemory(db, {
      board_id: boardId,
      asset_id: asset.id,
      taken_at: asset.localDateTime,
      place: asset.exifInfo?.city ?? null,
      // Đặt gần chỗ đang xem, lệch ngẫu nhiên và nghiêng ±3° cho giống ảnh ghim tay.
      x: scroll.current.x + 40 + Math.random() * 120,
      y: scroll.current.y + 60 + Math.random() * 120,
      rotation: Math.random() * 6 - 3,
    });
    await reload();
  }

  if (config === undefined) return <ActivityIndicator style={{ flex: 1 }} />;
  if (config === null) {
    return (
      <View style={styles.center}>
        <Text style={styles.hint}>Chưa kết nối Immich.</Text>
        <Link href="/settings" style={styles.link}>Mở cài đặt</Link>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: board?.name ?? '' }} />
      <ScrollView onScroll={(e) => { scroll.current.y = e.nativeEvent.contentOffset.y; }} scrollEventThrottle={64}>
        <ScrollView
          horizontal
          onScroll={(e) => { scroll.current.x = e.nativeEvent.contentOffset.x; }}
          scrollEventThrottle={64}
        >
          <View style={styles.board}>
            <Svg width={BOARD_SIZE} height={BOARD_SIZE} style={StyleSheet.absoluteFill} pointerEvents="none">
              {connections.map((c) => (
                <Rope key={c.id} positions={positions} from={c.from_id} to={c.to_id} color={c.color} />
              ))}
            </Svg>
            {memories.map((m) => (
              <PhotoCard
                key={m.id}
                memory={m}
                config={config}
                positions={positions}
                selected={selected === m.id}
                onTap={onTap}
                onMoved={onMoved}
              />
            ))}
          </View>
        </ScrollView>
      </ScrollView>

      <View style={styles.toolbar}>
        <Pressable style={styles.tool} onPress={() => setPickerOpen(true)} accessibilityRole="button">
          <Text style={styles.toolText}>＋ Ghim ảnh</Text>
        </Pressable>
        <Pressable
          style={[styles.tool, connecting && styles.toolActive]}
          onPress={() => { setConnecting(!connecting); setSelected(null); }}
          accessibilityRole="button"
          accessibilityState={{ selected: connecting }}
        >
          <Text style={styles.toolText}>{connecting ? 'Chạm 2 ảnh để nối' : '〰 Nối dây'}</Text>
        </Pressable>
      </View>

      <AssetPicker config={config} visible={pickerOpen} onClose={() => setPickerOpen(false)} onPick={pin} />
    </View>
  );
}

function AssetPicker({ config, visible, onClose, onPick }: {
  config: ImmichConfig;
  visible: boolean;
  onClose: () => void;
  onPick: (a: ImmichAsset) => void;
}) {
  const [assets, setAssets] = useState<ImmichAsset[]>([]);
  const [page, setPage] = useState<number | null>(1);
  const [error, setError] = useState<string | null>(null);
  const loading = useRef(false);

  const loadMore = useCallback(async () => {
    if (page === null || loading.current) return;
    loading.current = true;
    try {
      const r = await recentAssets(config, page);
      setAssets((prev) => [...prev, ...r.items]);
      setPage(r.nextPage ? Number(r.nextPage) : null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      loading.current = false;
    }
  }, [config, page]);

  useEffect(() => {
    if (visible && assets.length === 0) loadMore();
  }, [visible, assets.length, loadMore]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.pickerHeader}>
        <Text style={styles.pickerTitle}>Chọn ảnh từ Immich</Text>
        <Pressable onPress={onClose} accessibilityRole="button"><Text style={styles.link}>Đóng</Text></Pressable>
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
      <FlatList
        data={assets}
        numColumns={3}
        keyExtractor={(a) => a.id}
        onEndReached={loadMore}
        renderItem={({ item }) => (
          <Pressable style={styles.thumbWrap} onPress={() => onPick(item)} accessibilityLabel={item.originalFileName}>
            <Image source={thumbnailSource(config, item.id)} style={styles.thumb} contentFit="cover" />
            {item.type === 'VIDEO' && <Text style={styles.video}>▶</Text>}
          </Pressable>
        )}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#c8a678' },
  board: { width: BOARD_SIZE, height: BOARD_SIZE, backgroundColor: '#c8a678' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f3e9d8' },
  hint: { color: '#5a4632', fontSize: 16 },
  link: { color: '#8b5e3c', fontWeight: '600', padding: 12 },
  toolbar: { position: 'absolute', bottom: 24, left: 16, right: 16, flexDirection: 'row', gap: 8, justifyContent: 'center' },
  tool: { backgroundColor: '#fffdf8', borderRadius: 22, paddingHorizontal: 16, minHeight: 44, justifyContent: 'center', elevation: 3 },
  toolActive: { backgroundColor: '#f6d7a7' },
  toolText: { color: '#3b2a1a', fontWeight: '600' },
  pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 48 },
  pickerTitle: { fontSize: 18, fontWeight: '600', color: '#3b2a1a' },
  error: { color: '#c0392b', padding: 16 },
  thumbWrap: { flex: 1 / 3, aspectRatio: 1, padding: 1 },
  thumb: { flex: 1, backgroundColor: '#e8e0d0' },
  video: { position: 'absolute', right: 6, bottom: 4, color: '#fff', fontSize: 16 },
});
