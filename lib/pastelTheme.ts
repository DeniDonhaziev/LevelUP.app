/** Пастельная палитра (как на референсе health-app) */
export const Pastel = {
  mint: '#D4F5E9',
  mintDark: '#8FD4B8',
  blue: '#D6EBFF',
  blueDark: '#7EB8FF',
  pink: '#FFE4EC',
  pinkDark: '#FF9DB8',
  yellow: '#FFF3D6',
  yellowDark: '#F5C76E',
  lavender: '#EDE8FF',
  lavenderDark: '#A894FF',
  peach: '#FFE8DC',
  peachDark: '#FFB899',
  sky: '#E8F4FF',
  white: '#FFFFFF',
  bg: '#F4F7FC',
  bgSoft: '#FAFBFE',
  text: '#2D3142',
  textMuted: '#8B92A8',
  accent: '#6C8CFF',
  accentSoft: 'rgba(108, 140, 255, 0.14)',
} as const;

export type PastelVariant = 'mint' | 'blue' | 'pink' | 'yellow' | 'lavender' | 'peach' | 'white';

export function pastelPair(variant: PastelVariant): { bg: string; accent: string } {
  switch (variant) {
    case 'mint':
      return { bg: Pastel.mint, accent: Pastel.mintDark };
    case 'blue':
      return { bg: Pastel.blue, accent: Pastel.blueDark };
    case 'pink':
      return { bg: Pastel.pink, accent: Pastel.pinkDark };
    case 'yellow':
      return { bg: Pastel.yellow, accent: Pastel.yellowDark };
    case 'lavender':
      return { bg: Pastel.lavender, accent: Pastel.lavenderDark };
    case 'peach':
      return { bg: Pastel.peach, accent: Pastel.peachDark };
    default:
      return { bg: Pastel.white, accent: Pastel.accent };
  }
}
