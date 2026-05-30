import * as ImagePicker from 'expo-image-picker';

/**
 * Выбор изображения логотипа/бренда из галереи устройства.
 * @returns URI файла или null (отмена / нет доступа).
 */
export async function pickBrandLogoFromLibrary(): Promise<string | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.85,
  });

  if (result.canceled) {
    return null;
  }

  const uri = result.assets?.[0]?.uri;
  return uri ?? null;
}
