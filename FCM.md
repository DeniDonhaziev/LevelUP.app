# FCM Push — LevelUp

Полная система push-уведомлений через **Firebase Cloud Messaging**.

Сайт: https://leveluptracker.web.app/

## Структура проекта

```
lib/notifications/fcm/
  types.ts          — типы уведомлений и настройки
  channels.ts       — Android notification channels
  register.ts       — запрос разрешения + сохранение FCM токена
  preferences.ts    — notificationPrefs / notificationState в Firestore
  handlers.ts       — foreground + tap (native)
  routing.ts        — deep links по типу уведомления
  logout.ts         — удаление токенов при выходе
  index.ts

lib/firebase/messaging.web.ts   — FCM web SDK + service worker
lib/notifications/pushTokens.ts — сохранение в users/{uid}/pushTokens
public/sw.js                    — background push (PWA)

functions/
  index.js                        — экспорт всех Cloud Functions
  push/
    config.js, send.js, tokens.js, prefs.js, templates.js, metrics.js
  triggers/
    clanMessage.js, clanMember.js, runnerStat.js
  scheduled/
    daily.js, retention.js

components/NotificationSettings.tsx — UI настроек в профиле
```

## Firestore

```
users/{uid}
  pushTokens/{tokenId}     → { token, platform, updatedAt }
  notificationPrefs        → { enabled, goals, habits, ... }
  notificationState        → { lastDailyGoals, lastRetention2d, ... }

clans/{clanId}/members/{uid}
  expoPushToken, fcmPushToken, pushUpdatedAt
```

## Типы уведомлений

| Тип | Триггер | Пример |
|-----|---------|--------|
| `goals_incomplete` | daily 18:00 | Не забудь выполнить свои цели 🎯 |
| `habit_reminder` | daily 12:00 | Привычка ждёт тебя |
| `streak_warning` | daily 20:00 | Серия из 7 дней может прерваться 🔥 |
| `run_reminder` | daily 17:00 | Время для пробежки 🏃 |
| `run_goal_near` | runnerStats | До недельной цели 2 км |
| `run_goal_achieved` | runnerStats | Поздравляем! 🎉 |
| `weekly_stats` | weekly | За неделю: X км |
| `ai_recommendation` | daily 10:00 | AI-помощник подготовил рекомендации 🤖 |
| `club_new_member` | onCreate member | Новый участник клуба |
| `club_ranking_up` | weekly | Клуб в ТОП-10 🏆 |
| `club_achievement` | runnerStats | Участник пробежал 15 км |
| `clan_chat` | onCreate message | Клан · Имя: текст |
| `retention_2_days` | daily | Продолжай движение вперёд 🚀 |
| `retention_1_week` | daily | Мы скучаем! |

## Настройка Firebase

1. Firebase Console → Cloud Messaging → Web Push certificates → VAPID key
2. В `.env`: `EXPO_PUBLIC_FIREBASE_VAPID_KEY=...`
3. Включить **Blaze** для Cloud Functions

## Деплой

```powershell
npm run deploy:hosting
npx firebase deploy --only functions --project levelup-ff95c
node scripts/sync-clan-push-tokens.cjs
```

## Клиент

```typescript
import { registerFcmForUser } from '@/lib/notifications/fcm';
await registerFcmForUser(uid, clanId, { requestPermission: true });
```

## Пример отправки (Cloud Function)

```javascript
const { sendNotificationToUser } = require('./push/send');
const { TEMPLATES } = require('./push/templates');
await sendNotificationToUser(uid, TEMPLATES.goals_incomplete(), userDoc);
```
