/** Генерация VAPID без npm-пакетов (только crypto). */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const curve = crypto.createECDH('prime256v1');
curve.generateKeys();

const publicKey = curve.getPublicKey('base64url');
const privateKey = curve.getPrivateKey('base64url');

const envPath = path.join(__dirname, '..', '.env');
let env = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';

if (/EXPO_PUBLIC_FIREBASE_VAPID_KEY=/.test(env)) {
  env = env.replace(/EXPO_PUBLIC_FIREBASE_VAPID_KEY=.*/m, `EXPO_PUBLIC_FIREBASE_VAPID_KEY=${publicKey}`);
} else {
  env += `\nEXPO_PUBLIC_FIREBASE_VAPID_KEY=${publicKey}\n`;
}
fs.writeFileSync(envPath, env);

console.log('\n✓ Публичный ключ записан в .env (EXPO_PUBLIC_FIREBASE_VAPID_KEY)\n');
console.log('Публичный ключ:\n', publicKey, '\n');
console.log('Приватный ключ (импортируйте в Firebase Console → Cloud Messaging → Web Push → Import):\n');
console.log(privateKey, '\n');
console.log(
  `Firebase: https://console.firebase.google.com/project/${process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'levelup-ff95c'}/settings/cloudmessaging\n`
);
