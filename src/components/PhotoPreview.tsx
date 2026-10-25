import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';
import {
  FlatList, Keyboard, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View,
} from 'react-native';
import Animated, { useAnimatedKeyboard, useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DetailsSheet, type Details } from './DetailsSheet';

import type { Memory } from '@/db/schema';
import { formatViDate } from '@/lib/exif';
import { colors, handFont } from '@/lib/theme';
import { photoUri, previewUri } from '@/services/photos';

type Props = {
  items: Memory[];
  startId: number | null;
  onSave: (id: number, caption: string) => void;
  onClose: (id: number, caption: string) => void;
  onRemove: (id: number) => void;
  onSaveDetails: (id: number, d: Details) => void;
};

const PANEL_W = 300;
// Thanh ghi chú khi để dọc: cao cố định, ảnh/video nằm phía trên nên thanh không nhảy khi vuốt qua mục khác.
const BAR_H = 170;

// Xem toàn màn hình, vuốt ngang qua lại giữa các ảnh/video (theo thứ tự ngày). Ảnh và video dùng chung
// một khung full màn hình. Dọc: ghi chú ở thanh dưới, tự nâng theo bàn phím.
// Ngang: ghi chú ở panel bên phải với ô nhập ở trên cùng để bàn phím không che.
export function PhotoPreview({ items, startId, onSave, onClose, onRemove, onSaveDetails }: Props) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const landscape = width > height;
  const [index, setIndex] = useState(0);
  const [caption, setCaption] = useState('');
  const [editing, setEditing] = useState(false);

  // Mỗi lần mở: nhảy tới ảnh được chạm. Đặt ngay trong lúc render (không đợi effect) để FlatList
  // mount lần đầu đã có initialScrollIndex đúng.
  const [openedFor, setOpenedFor] = useState<number | null>(null);
  if (startId !== openedFor) {
    setOpenedFor(startId);
    if (startId !== null) setIndex(Math.max(0, items.findIndex((m) => m.id === startId)));
  }
  // Gỡ ảnh cuối danh sách thì lùi về ảnh trước đó.
  const current = Math.min(index, items.length - 1);
  const memory = startId !== null && current >= 0 ? items[current] : null;
  useEffect(() => setCaption(memory?.caption ?? ''), [memory?.id, memory?.caption]);
  const close = () => { if (memory) onClose(memory.id, caption); };

  // Thanh dưới nằm tuyệt đối nên KeyboardAvoidingView không đẩy được; tự nâng theo chiều cao bàn phím.
  const keyboard = useAnimatedKeyboard();
  const barStyle = useAnimatedStyle(() => {
    const open = keyboard.height.value > 0;
    return { bottom: keyboard.height.value, height: BAR_H + (open ? 0 : insets.bottom), paddingBottom: open ? 12 : insets.bottom + 12 };
  });

  const mediaW = landscape ? width - PANEL_W - insets.right : width;
  const mediaH = landscape ? height : height - BAR_H - insets.bottom;
  const meta = memory
    ? [memory.taken_at ? formatViDate(memory.taken_at) : 'Chưa rõ ngày', memory.place, `${current + 1}/${items.length}`].filter(Boolean).join(' · ')
    : '';
  // Chạm dòng thông tin để sửa ngày, địa điểm, người trong ảnh.
  const info = (
    <Pressable onPress={() => setDetailsOpen(true)} accessibilityRole="button" accessibilityLabel="Sửa ngày, địa điểm và người trong ảnh" hitSlop={8}>
      <Text style={styles.date} numberOfLines={1}>{meta} ✎</Text>
      {memory?.people && <Text style={styles.people} numberOfLines={1}>♥ {memory.people}</Text>}
    </Pressable>
  );
  const input = (
    <TextInput
      style={[styles.caption, landscape && styles.captionPanel]}
      value={caption}
      onChangeText={setCaption}
      onFocus={() => setEditing(true)}
      onBlur={() => { setEditing(false); if (memory) onSave(memory.id, caption); }}
      placeholder="Thêm ghi chú cho kỷ niệm này…"
      placeholderTextColor={colors.chalkDim}
      multiline
      maxLength={300}
      scrollEnabled
      accessibilityLabel="Ghi chú kỷ niệm"
    />
  );
  // Ô nhiều dòng thì Enter là xuống dòng, nên cần nút Xong để cất bàn phím (và lưu khi rời ô).
  const action = editing ? (
    <Pressable onPress={Keyboard.dismiss} style={[styles.pill, styles.done]} accessibilityRole="button">
      <Text style={styles.doneText}>Xong</Text>
    </Pressable>
  ) : (
    // Ảnh gốc vẫn ở thư viện ảnh nên gỡ nhầm thì ghim lại được; không hỏi xác nhận để dọn nhanh cả loạt.
    <Pressable onPress={() => memory && onRemove(memory.id)} style={[styles.pill, styles.remove]} accessibilityRole="button" accessibilityLabel="Gỡ khỏi bảng">
      <Text style={styles.removeText}>Gỡ</Text>
    </Pressable>
  );

  return (
    <Modal
      visible={memory !== null}
      animationType="fade"
      onRequestClose={close}
      supportedOrientations={['portrait', 'landscape']}
      statusBarTranslucent
    >
      <View style={[styles.screen, landscape && styles.row]}>
        {memory && (
          <>
            <FlatList
              // Đổi chiều màn hình thì dựng lại danh sách để trang mới vẫn đứng đúng ảnh đang xem.
              key={mediaW}
              data={items}
              keyExtractor={(m) => String(m.id)}
              horizontal
              pagingEnabled
              scrollEnabled={!editing}
              showsHorizontalScrollIndicator={false}
              initialScrollIndex={current}
              style={{ width: mediaW, height: mediaH, flexGrow: 0 }}
              getItemLayout={(_, i) => ({ length: mediaW, offset: mediaW * i, index: i })}
              windowSize={3}
              onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / mediaW))}
              renderItem={({ item, index: i }) => (
                <View style={{ width: mediaW, height: mediaH }}>
                  {item.kind === 'video' && i === current ? (
                    <Video uri={previewUri(item.asset_id, item.original)} width={mediaW} height={mediaH} />
                  ) : item.kind === 'video' ? (
                    // Chỉ trang đang xem mới tạo trình phát; trang bên cạnh hiện ảnh bìa.
                    <Image source={photoUri(item.asset_id)} style={{ width: mediaW, height: mediaH }} contentFit="contain" />
                  ) : (
                    /* shortcut: phóng to bằng hai ngón dùng zoom có sẵn của ScrollView, chỉ chạy trên iOS; Android cần gesture riêng. */
                    <ScrollView
                      maximumZoomScale={4}
                      minimumZoomScale={1}
                      centerContent
                      showsHorizontalScrollIndicator={false}
                      showsVerticalScrollIndicator={false}
                      contentContainerStyle={{ width: mediaW, height: mediaH }}
                    >
                      <Image
                        source={previewUri(item.asset_id, item.original)}
                        style={{ width: mediaW, height: mediaH }}
                        contentFit="contain"
                        accessibilityLabel={item.caption ?? 'Ảnh kỷ niệm'}
                      />
                    </ScrollView>
                  )}
                </View>
              )}
            />

            {landscape ? (
              <View style={[styles.panel, { width: PANEL_W + insets.right, paddingRight: insets.right + 16, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
                <View style={styles.panelHead}>
                  <View style={styles.info}>{info}</View>
                  <Pressable onPress={close} style={styles.closeInline} accessibilityRole="button" accessibilityLabel="Đóng">
                    <Text style={styles.closeText}>✕</Text>
                  </Pressable>
                </View>
                {input}
                <View style={styles.panelFoot}>{action}</View>
              </View>
            ) : (
              <>
                <Pressable
                  onPress={close}
                  style={[styles.close, { top: insets.top + 8, right: insets.right + 12 }]}
                  accessibilityRole="button"
                  accessibilityLabel="Đóng"
                >
                  <Text style={styles.closeText}>✕</Text>
                </Pressable>
                <Animated.View style={[styles.bar, { paddingLeft: insets.left + 16, paddingRight: insets.right + 16 }, barStyle]}>
                  <View style={styles.info}>
                    {info}
                    {input}
                  </View>
                  {action}
                </Animated.View>
              </>
            )}
          </>
        )}
        <DetailsSheet memory={detailsOpen ? memory : null} onClose={() => setDetailsOpen(false)} onSave={onSaveDetails} />
      </View>
    </Modal>
  );
}

// Tách riêng để player chỉ được tạo khi trang video đang được xem, và được giải phóng khi vuốt đi.
function Video({ uri, width, height }: { uri: string; width: number; height: number }) {
  const player = useVideoPlayer(uri, (p) => p.play());
  return <VideoView player={player} style={{ width, height }} contentFit="contain" nativeControls />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  row: { flexDirection: 'row' },
  close: {
    position: 'absolute', width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center',
  },
  closeInline: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#fff', fontSize: 20 },
  bar: {
    position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 12,
    flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: colors.wall,
  },
  info: { flex: 1, minWidth: 0 },
  panel: { backgroundColor: colors.wall, paddingLeft: 16, gap: 8 },
  panelHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  panelFoot: { marginTop: 'auto', alignItems: 'flex-start' },
  date: { color: colors.chalkDim, fontFamily: handFont, fontSize: 16, fontVariant: ['tabular-nums'] },
  people: { color: '#ff9a8f', fontFamily: handFont, fontSize: 16 },
  caption: {
    color: colors.chalk, fontFamily: handFont, fontSize: 22, lineHeight: 28,
    height: 28 * 3 + 8, paddingVertical: 4, textAlignVertical: 'top',
  },
  captionPanel: { flexShrink: 1, height: undefined, minHeight: 120 },
  pill: { minHeight: 44, paddingHorizontal: 16, justifyContent: 'center', borderRadius: 22 },
  remove: { borderWidth: 1, borderColor: colors.yarn },
  removeText: { color: '#ff8f85', fontWeight: '600' },
  done: { backgroundColor: colors.accent },
  doneText: { color: colors.ink, fontWeight: '600' },
});
