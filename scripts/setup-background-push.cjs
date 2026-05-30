/**
 * Проверка настройки фоновых push (как WhatsApp).
 * Запуск: node scripts/setup-background-push.cjs
 */
const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'levelup-ff95c';
const vapid = (process.env.EXPO_PUBLIC_FIREBASE_VAPID_KEY || '').trim();

console.log('\n=== Фоновые push для чата клана ===\n');

if (!vapid) {
  console.log('❌ Нет EXPO_PUBLIC_FIREBASE_VAPID_KEY в .env\n');
  console.log('1. Откройте:');
  console.log(
    `   https://console.firebase.google.com/project/${projectId}/settings/cloudmessaging`
  );
  console.log('2. Web Push certificates → Generate key pair (или скопируйте существующий)');
  console.log('3. Вставьте ПУБЛИЧНЫЙ ключ в tracker-mobile/.env:');
  console.log('   EXPO_PUBLIC_FIREBASE_VAPID_KEY=ваш_ключ\n');
} else {
  console.log('✓ VAPID ключ в .env есть\n');
}

console.log('4. Задеплойте Cloud Function (один раз, с вашего ПК):');
console.log('   cd tracker-mobile');
console.log('   npx firebase login');
console.log('   npx firebase deploy --only functions\n');

console.log('5. Пересоберите сайт:');
console.log('   npm run deploy:web\n');

console.log('6. На телефоне: откройте сайт → Кланы → Включить уведомления → Разрешить');
console.log('   (на iPhone: «На экран Домой», иначе push в Safari не работает)\n');
