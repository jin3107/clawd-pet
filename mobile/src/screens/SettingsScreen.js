import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { DEFAULT_GREETINGS } from '../storage/config';

export default function SettingsScreen({ config, onSave, onCancel }) {
  const [petName, setPetName] = useState(config.petName);
  const [enabled, setEnabled] = useState(
    new Set(DEFAULT_GREETINGS.filter((g) => (config.enabledGreetings || []).includes(g)))
  );
  const [customText, setCustomText] = useState((config.customGreetings || []).join('\n'));
  const [intervalMin, setIntervalMin] = useState(String(config.intervalMinMin));
  const [intervalMax, setIntervalMax] = useState(String(config.intervalMaxMin));
  const [error, setError] = useState('');

  function toggle(g) {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });
  }

  function handleSave() {
    const name = petName.trim() || 'Clawd Pet';
    const enabledGreetings = DEFAULT_GREETINGS.filter((g) => enabled.has(g));
    const customGreetings = customText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    const min = parseInt(intervalMin, 10);
    const max = parseInt(intervalMax, 10);

    if (!Number.isFinite(min) || !Number.isFinite(max) || min < 1) {
      setError('Thời gian phải là số nguyên dương.');
      return;
    }
    if (max < min) {
      setError('Giá trị "đến" phải lớn hơn hoặc bằng giá trị đầu.');
      return;
    }
    if (enabledGreetings.length === 0 && customGreetings.length === 0) {
      setError('Chọn ít nhất một câu mặc định hoặc tự nhập một câu.');
      return;
    }

    onSave({
      petName: name,
      enabledGreetings,
      customGreetings,
      intervalMinMin: min,
      intervalMaxMin: max,
    });
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.h1}>Cài đặt Clawd Pet</Text>

      <Text style={styles.label}>Tên pet</Text>
      <TextInput
        style={styles.input}
        value={petName}
        onChangeText={setPetName}
        placeholder="Clawd Pet"
        maxLength={30}
      />

      <Text style={styles.label}>Câu chào mặc định</Text>
      {DEFAULT_GREETINGS.map((g) => (
        <View key={g} style={styles.checkRow}>
          <Switch value={enabled.has(g)} onValueChange={() => toggle(g)} />
          <Text style={styles.checkLabel}>{g}</Text>
        </View>
      ))}

      <Text style={styles.label}>Câu chào tự thêm (mỗi dòng 1 câu)</Text>
      <TextInput
        style={[styles.input, styles.textarea]}
        value={customText}
        onChangeText={setCustomText}
        multiline
        numberOfLines={4}
      />

      <Text style={styles.label}>Khoảng thời gian nhắc (phút)</Text>
      <View style={styles.row}>
        <TextInput
          style={[styles.input, styles.numberInput]}
          value={intervalMin}
          onChangeText={setIntervalMin}
          keyboardType="number-pad"
        />
        <Text style={styles.rowSep}>đến</Text>
        <TextInput
          style={[styles.input, styles.numberInput]}
          value={intervalMax}
          onChangeText={setIntervalMax}
          keyboardType="number-pad"
        />
      </View>

      {!!error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.actions}>
        <Pressable style={styles.btnGhost} onPress={onCancel}>
          <Text style={styles.btnGhostText}>Huỷ</Text>
        </Pressable>
        <Pressable style={styles.btn} onPress={handleSave}>
          <Text style={styles.btnText}>Lưu</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20, gap: 8 },
  h1: { fontSize: 18, fontWeight: '700', color: '#2B2B2B', marginBottom: 8 },
  label: { fontSize: 13, fontWeight: '700', color: '#2B2B2B', marginTop: 14 },
  input: {
    borderWidth: 2,
    borderColor: '#2B2B2B',
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: '#2B2B2B',
  },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  checkLabel: { flex: 1, fontSize: 13, color: '#2B2B2B' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowSep: { fontSize: 13, color: '#2B2B2B' },
  numberInput: { width: 70, textAlign: 'center' },
  error: { color: '#C0392B', fontSize: 12, marginTop: 10 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 20 },
  btn: { borderWidth: 2, borderColor: '#2B2B2B', backgroundColor: '#2B2B2B', paddingVertical: 8, paddingHorizontal: 20 },
  btnText: { color: '#fff', fontWeight: '700' },
  btnGhost: { borderWidth: 2, borderColor: '#2B2B2B', paddingVertical: 8, paddingHorizontal: 20 },
  btnGhostText: { color: '#2B2B2B', fontWeight: '700' },
});
