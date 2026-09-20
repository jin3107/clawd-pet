import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import HomeScreen from './src/screens/HomeScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { loadConfig, saveConfig } from './src/storage/config';

export default function App() {
  const [config, setConfig] = useState(null);
  const [screen, setScreen] = useState('home');

  useEffect(() => {
    loadConfig().then(setConfig);
  }, []);

  if (!config) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator />
      </View>
    );
  }

  async function handleSave(next) {
    const merged = { ...config, ...next };
    setConfig(merged);
    await saveConfig(merged);
    setScreen('home');
  }

  return (
    <View style={styles.root}>
      {screen === 'home' ? (
        <HomeScreen config={config} onOpenSettings={() => setScreen('settings')} />
      ) : (
        <SettingsScreen config={config} onSave={handleSave} onCancel={() => setScreen('home')} />
      )}
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
