const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Push участникам клана (Expo). Работает при закрытом приложении у получателя.
 * Отправитель должен быть онлайн в момент отправки сообщения.
 */
export async function notifyClanMembersOnMessage(
  senderName: string,
  text: string,
  expoPushTokens: string[]
): Promise<void> {
  const title = `Клан · ${senderName}`;
  const body = (text || 'Новое сообщение').slice(0, 180);

  const tokens = expoPushTokens.filter((t) => t.startsWith('ExponentPushToken['));
  if (!tokens.length) return;

  const messages = tokens.map((to) => ({
    to,
    title,
    body,
    sound: 'default',
    priority: 'high',
    channelId: 'clan-chat',
  }));

  try {
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
      console.warn('notifyClanMembersOnMessage:', res.status, errText);
    }
  } catch (e) {
    console.warn('notifyClanMembersOnMessage:', e);
  }
}
