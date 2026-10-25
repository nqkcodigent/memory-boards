import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { checkConnection, loadConfig, saveConfig } from '@/services/immich';

export default function SettingsScreen() {
  const [url, setUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadConfig().then((c) => {
      if (c) { setUrl(c.url); setApiKey(c.apiKey); }
    });
  }, []);

  async function save() {
    setBusy(true);
    setStatus(null);
    try {
      await saveConfig({ url, apiKey });
      const c = await loadConfig();
      const me = await checkConnection(c!);
      setStatus(`Đã kết nối với tài khoản ${me.name}.`);
    } catch (e) {
      setStatus(`Không kết nối được: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.label}>Địa chỉ server</Text>
      <TextInput
        style={styles.input}
        value={url}
        onChangeText={setUrl}
        placeholder="http://100.x.x.x:2283"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
      />
      <Text style={styles.label}>API key (Immich → Account Settings → API Keys)</Text>
      <TextInput
        style={styles.input}
        value={apiKey}
        onChangeText={setApiKey}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
      />
      <Pressable style={styles.button} onPress={save} disabled={busy} accessibilityRole="button">
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Lưu và kiểm tra</Text>}
      </Pressable>
      {status && <Text style={styles.status}>{status}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f3e9d8', padding: 16, gap: 8 },
  label: { color: '#5a4632', marginTop: 8 },
  input: { backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 12, minHeight: 44 },
  button: { backgroundColor: '#8b5e3c', borderRadius: 8, minHeight: 44, justifyContent: 'center', alignItems: 'center', marginTop: 16 },
  buttonText: { color: '#fff', fontWeight: '600' },
  status: { marginTop: 12, color: '#3b2a1a' },
});
