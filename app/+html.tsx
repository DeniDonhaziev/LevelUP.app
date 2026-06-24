import { ScrollViewStyleReset } from 'expo-router/html';

import { webFontsCss } from '@/lib/webFontsCss';

// This file is web-only and used to configure the root HTML for every
// web page during static rendering.
// The contents of this function only run in Node.js environments and
// do not have access to the DOM or browser APIs.
export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta name="theme-color" content="#F2F2F7" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#000000" media="(prefers-color-scheme: dark)" />
        <meta name="application-name" content="LevelUp" />
        <meta name="apple-mobile-web-app-title" content="LevelUp" />
        {/* iOS: НЕ standalone — в standalone-PWA WebKit блокирует геолокацию.
            Браузерный режим иконки на iOS даёт рабочую геолокацию. Android управляется манифестом. */}
        <meta name="apple-mobile-web-app-capable" content="no" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="mobile-web-app-capable" content="yes" />
        {/*
          Иконки из public/ — стабильные URL без хэша. Путь /assets/images/app-icon.png после export не существует
          (файл попадает в /assets/assets/images/app-icon.<hash>.png), из‑за 404 iOS показывает букву вместо лого.
        */}
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="48x48" href="/favicon.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />

        {/* 
          Disable body scrolling on web. This makes ScrollView components work closer to how they do on native. 
          However, body scrolling is often nice to have for mobile web. If you want to enable it, remove this line.
        */}
        <ScrollViewStyleReset />

        {/* Using raw CSS styles as an escape-hatch to ensure the background color never flickers in dark-mode. */}
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="preload" href="/fonts/ionicons.ttf" as="font" type="font/ttf" crossOrigin="" />
        <style dangerouslySetInnerHTML={{ __html: webFontsCss + responsiveBackground }} />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var id='expo-generated-fonts',f='ionicons',u='/fonts/ionicons.ttf',s=document.getElementById(id);if(!s){s=document.createElement('style');s.id=id;document.head.appendChild(s);}var ok=false;try{ok=s.sheet&&Array.prototype.some.call(s.sheet.cssRules,function(r){return r instanceof CSSFontFaceRule&&r.style.fontFamily.indexOf(f)>=0;});}catch(e){}if(!ok){s.appendChild(document.createTextNode('@font-face{font-family:"'+f+'";src:url("'+u+'") format("truetype");font-display:swap}'));}})();`,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function () {});
  });
}
`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

/**
 * body + #root: без этого под вебом #root{display:flex} (ScrollViewStyleReset) даёт «дыру»
 * с дефолтным rgb(242,242,242) из темы навигации.
 */
const responsiveBackground = `
html {
  background-color: #F2F2F7;
  color-scheme: light dark;
}
body {
  background-color: #F2F2F7;
  color: #1C1C1E;
  font-family: 'Inter_400Regular', Inter, system-ui, -apple-system, 'Segoe UI', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
#root {
  flex: 1;
  width: 100%;
  min-height: 100%;
  background-color: #F2F2F7;
}
@media (prefers-color-scheme: dark) {
  html {
    background-color: #000000;
  }
  body {
    background-color: #000000;
    color: #F2F2F7;
  }
  #root {
    background-color: #000000;
  }
}
`;
