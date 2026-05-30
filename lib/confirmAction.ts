import { Alert, Platform } from 'react-native';

/** Подтверждение удаления: на web — confirm(), на iOS/Android — Alert. */
export function confirmDelete(title: string, itemLabel: string, onConfirm: () => void): void {
  const detail = itemLabel ? `«${itemLabel}»` : '';
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm([title, detail].filter(Boolean).join('\n'))) {
      onConfirm();
    }
    return;
  }
  Alert.alert(title, detail || undefined, [
    { text: 'Отмена', style: 'cancel' },
    { text: 'Удалить', style: 'destructive', onPress: onConfirm },
  ]);
}
