import type { ClanPushTargets } from '@/lib/firebase/clanSync';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export type ClanPushSendResult = {
  expoSent: number;
  expoFailed: number;
  fcmTargets: number;
};

async function sendExpoChunk(messages: object[]): Promise<boolean> {
  const res = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(messages),
  });
  if (!res.ok) {
    const errText = await res.text();
    console.warn('sendExpoChunk:', res.status, errText);
    return false;
  }
  return true;
}

/**
 * Push участникам клана (Expo — работает без Cloud Functions, если у получателя сохранён токен).
 * FCM-токены доставляются через Cloud Function onClanMessageCreated при включённом Blaze.
 */
export async function notifyClanMembersOnMessage(
  senderName: string,
  text: string,
  targets: ClanPushTargets,
  clanId?: string
): Promise<ClanPushSendResult> {
  const title = `Клан · ${senderName}`;
  const body = (text || 'Новое сообщение').slice(0, 180);

  const tokens = [...new Set(targets.expoTokens.filter((t) => t.startsWith('ExponentPushToken[')))];
  if (!tokens.length) {
    return { expoSent: 0, expoFailed: 0, fcmTargets: targets.fcmTokens.length };
  }

  const messages = tokens.map((to) => ({
    to,
    title,
    body,
    sound: 'default',
    priority: 'high',
    channelId: 'clan-chat',
    data: {
      type: 'clan_chat',
      clanId: clanId ?? '',
    },
  }));

  let expoSent = 0;
  let expoFailed = 0;

  try {
    for (let i = 0; i < messages.length; i += 100) {
      const chunk = messages.slice(i, i + 100);
      if (await sendExpoChunk(chunk)) expoSent += chunk.length;
      else expoFailed += chunk.length;
    }
  } catch (e) {
    console.warn('notifyClanMembersOnMessage:', e);
    expoFailed += tokens.length - expoSent;
  }

  if (targets.fcmTokens.length) {
    console.log(
      `clan push: ${targets.fcmTokens.length} FCM token(s) — нужна Cloud Function (Blaze) для фона`
    );
  }

  return { expoSent, expoFailed, fcmTargets: targets.fcmTokens.length };
}
