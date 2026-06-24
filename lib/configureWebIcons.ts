import { Platform } from 'react-native';
import { useLayoutEffect, useState } from 'react';

/** Стабильный URL — не зависит от хэша Metro и не попадает под ignore node_modules на Hosting. */
export const IONICONS_FAMILY = 'ionicons';
export const IONICONS_FONT_URL = '/fonts/ionicons.ttf';

const EXPO_FONTS_STYLE_ID = 'expo-generated-fonts';

function ioniconsFaceCss(): string {
  return `@font-face{font-family:"${IONICONS_FAMILY}";src:url("${IONICONS_FONT_URL}") format("truetype");font-display:swap}`;
}

function hasIoniconsFaceInExpoStyles(): boolean {
  if (typeof document === 'undefined') return false;
  const style = document.getElementById(EXPO_FONTS_STYLE_ID) as HTMLStyleElement | null;
  const sheet = style?.sheet;
  if (!sheet) return false;
  for (let i = 0; i < sheet.cssRules.length; i++) {
    const rule = sheet.cssRules[i];
    if (rule instanceof CSSFontFaceRule && rule.style.fontFamily.includes(IONICONS_FAMILY)) {
      return true;
    }
  }
  return false;
}

/** Регистрирует ionicons в #expo-generated-fonts — Font.isLoaded('ionicons') смотрит только туда. */
export function primeWebIconFont(): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  if (hasIoniconsFaceInExpoStyles()) return;

  let style = document.getElementById(EXPO_FONTS_STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = EXPO_FONTS_STYLE_ID;
    document.head.appendChild(style);
  }
  style.appendChild(document.createTextNode(ioniconsFaceCss()));
}

/** Ionicons после SSR вызывает loadAsync с путём assets/node_modules — подменяем на /fonts/. */
export function configureWebIonicons(): void {
  if (Platform.OS !== 'web') return;

  primeWebIconFont();

  try {
    const { Ionicons } = require('@expo/vector-icons') as typeof import('@expo/vector-icons');
    const webFont = { [IONICONS_FAMILY]: IONICONS_FONT_URL };
    (Ionicons as unknown as { font: Record<string, string> }).font = webFont;
    (Ionicons as unknown as { loadFont: () => Promise<void> }).loadFont = async () => {
      const { loadAsync, isLoaded } = await import('expo-font');
      primeWebIconFont();
      if (isLoaded(IONICONS_FAMILY) || hasIoniconsFaceInExpoStyles()) return;
      try {
        await loadAsync(webFont);
      } catch {
        primeWebIconFont();
      }
    };
  } catch {
    /* vector-icons недоступен при SSG */
  }
}

if (Platform.OS === 'web') {
  configureWebIonicons();
}

/** Не монтировать Ionicons до готовности шрифта (SSR отдаёт пустые квадраты). */
export function useWebIconsReady(): boolean {
  const isWeb = Platform.OS === 'web';
  const [ready, setReady] = useState(() => !isWeb);

  useLayoutEffect(() => {
    if (!isWeb) return;

    configureWebIonicons();

    let cancelled = false;
    const finish = () => {
      if (!cancelled) setReady(true);
    };

    void (async () => {
      const { loadAsync, isLoaded } = await import('expo-font');
      primeWebIconFont();
      if (isLoaded(IONICONS_FAMILY) || hasIoniconsFaceInExpoStyles()) {
        finish();
        return;
      }
      try {
        await loadAsync({ [IONICONS_FAMILY]: IONICONS_FONT_URL });
      } catch {
        primeWebIconFont();
      }
      finish();
    })();

    const t = window.setTimeout(finish, 3000);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [isWeb]);

  return ready;
}
