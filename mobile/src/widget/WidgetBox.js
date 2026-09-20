import { useEffect, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { PET_HTML } from './petHtml';

// react-native-webview dropped web support, so `expo start --web` can't
// render the pet at all with just <WebView>. This tiny shim swaps in a
// plain <iframe> on web only — real devices (Android/iOS) always use
// <WebView> below. Handy for quick visual checks without a phone.
function WebPreview({ html }) {
  return (
    <iframe
      srcDoc={html}
      style={{ width: '100%', height: '100%', border: 'none', background: 'transparent' }}
      title="clawd-pet-preview"
    />
  );
}

// The pet's whole world. The WebView is clipped to exactly this size, so the
// engine running inside it (src/widget/assets/pet-web/engine.js) can never
// draw or move the creature outside these bounds — that's the "khung tiện
// ích" the pet is confined to. No native clamping needed on top of this.
export const WIDGET_W = 260;
export const WIDGET_H = 170;

export default function WidgetBox({ settings, width = WIDGET_W, height = WIDGET_H }) {
  const webRef = useRef(null);

  const initialInject = `window.__PET_SETTINGS__ = ${JSON.stringify(toEngineSettings(settings))}; true;`;

  useEffect(() => {
    if (!webRef.current) return;
    webRef.current.injectJavaScript(
      `window.__applyPetSettings && window.__applyPetSettings(${JSON.stringify(toEngineSettings(settings))}); true;`
    );
  }, [settings]);

  const htmlWithSettings = PET_HTML.replace(
    '<script>',
    `<script>window.__PET_SETTINGS__ = ${JSON.stringify(toEngineSettings(settings))};`
  );

  return (
    <View style={[styles.frame, { width, height }]}>
      {Platform.OS === 'web' ? (
        <WebPreview html={htmlWithSettings} />
      ) : (
        <WebView
          ref={webRef}
          originWhitelist={['*']}
          source={{ html: PET_HTML }}
          injectedJavaScriptBeforeContentLoaded={initialInject}
          style={styles.webview}
          containerStyle={styles.webview}
          scrollEnabled={false}
          bounces={false}
          overScrollMode="never"
          backgroundColor="transparent"
          androidLayerType="hardware"
        />
      )}
    </View>
  );
}

function toEngineSettings(settings) {
  if (!settings) return {};
  return {
    petName: settings.petName,
    greetings: [...(settings.enabledGreetings || []), ...(settings.customGreetings || [])],
    intervalMinMin: settings.intervalMinMin,
    intervalMaxMin: settings.intervalMaxMin,
  };
}

const styles = StyleSheet.create({
  frame: {
    borderWidth: 2,
    borderColor: '#2B2B2B',
    backgroundColor: '#F2F2F2',
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
