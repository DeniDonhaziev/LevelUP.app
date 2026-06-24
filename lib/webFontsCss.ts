/** Inter для web: имена семейств как у @expo-google-fonts (Inter_400Regular и т.д.). */
const INTER_WOFF2 =
  'https://fonts.gstatic.com/s/inter/v18/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa1ZL7.woff2';

export const webFontsCss = `
@font-face {
  font-family: "ionicons";
  font-display: swap;
  src: url('/fonts/ionicons.ttf') format('truetype');
}
@font-face {
  font-family: 'Inter_400Regular';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('${INTER_WOFF2}') format('woff2');
}
@font-face {
  font-family: 'Inter_500Medium';
  font-style: normal;
  font-weight: 500;
  font-display: swap;
  src: url('${INTER_WOFF2}') format('woff2');
}
@font-face {
  font-family: 'Inter_600SemiBold';
  font-style: normal;
  font-weight: 600;
  font-display: swap;
  src: url('${INTER_WOFF2}') format('woff2');
}
@font-face {
  font-family: 'Inter_700Bold';
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url('${INTER_WOFF2}') format('woff2');
}
`;
