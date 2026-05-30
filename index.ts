import 'expo-router/entry';
import { Platform } from 'react-native';

if (Platform.OS === 'android') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { registerWidgetTaskHandler } = require('react-native-android-widget');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { widgetTaskHandler } = require('./widgets/widget-task-handler');
  registerWidgetTaskHandler(widgetTaskHandler);
}
