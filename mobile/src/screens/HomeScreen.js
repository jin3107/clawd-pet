import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import WidgetBox from '../widget/WidgetBox';

const MARGIN = 12;
const GEAR_SIZE = 40;

export default function HomeScreen({ config, onOpenSettings }) {
  const { width, height } = useWindowDimensions();
  const boxW = Math.max(200, width - MARGIN * 2);
  const boxH = Math.max(140, height - MARGIN * 2);

  return (
    <View style={styles.container}>
      <WidgetBox settings={config} width={boxW} height={boxH} />
      <Pressable style={styles.gear} onPress={onOpenSettings} hitSlop={8}>
        <Text style={styles.gearText}>⚙</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    padding: MARGIN,
  },
  gear: {
    position: 'absolute',
    top: MARGIN * 2,
    right: MARGIN * 2,
    width: GEAR_SIZE,
    height: GEAR_SIZE,
    borderRadius: GEAR_SIZE / 2,
    borderWidth: 2,
    borderColor: '#2B2B2B',
    backgroundColor: '#F2F2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gearText: {
    fontSize: 18,
    color: '#2B2B2B',
  },
});
