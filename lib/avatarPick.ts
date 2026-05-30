import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

/**
 * Выбор аватара из галереи с устойчивым URI для хранения в AsyncStorage.
 * На web временные blob: URL после перезагрузки недействительны — поэтому
 * по возможности возвращаем data:image/...;base64,...
 */
export async function pickAvatarImageAsPersistentUri(): Promise<{
  /** Для AsyncStorage: data URL или временный uri */
  uri: string;
  /** false если взяли только временный uri (без base64) */
  stable: boolean;
  /**
   * Исходный URI из пикера (file/content/blob).
   * На web fetch(blob:...) часто зависает — для Firebase лучше использовать base64 ниже.
   */
  nativeUri: string;
  /** Сырые пиксели в base64 — для загрузки в Storage без fetch(uri) */
  base64?: string;
  mimeType?: string;
} | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    return null;
  }

  /** На web встроенный crop (allowsEditing) часто тормозит или зависает */
  const isWeb = Platform.OS === 'web';
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: !isWeb,
    ...(isWeb ? {} : { aspect: [1, 1] as [number, number] }),
    quality: 0.65,
    base64: true,
  });

  if (result.canceled || !result.assets?.[0]) {
    return null;
  }

  const asset = result.assets[0];
  const nativeUri = asset.uri;
  if (asset.base64) {
    const mime = asset.mimeType || 'image/jpeg';
    return {
      uri: `data:${mime};base64,${asset.base64}`,
      stable: true,
      nativeUri,
      base64: asset.base64,
      mimeType: mime,
    };
  }

  return { uri: asset.uri, stable: false, nativeUri, mimeType: asset.mimeType || undefined };
}
