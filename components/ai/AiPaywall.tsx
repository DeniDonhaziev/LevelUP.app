import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useThemeColors } from '@/hooks/useThemeColors';
import { WebTheme } from '@/lib/theme';
import {
  PAYMENT_NOTE,
  PLANS,
  PLAN_BY_ID,
  SBP_BANK,
  SBP_PHONE,
  SBP_RECIPIENT,
  buildPaymentUrl,
  fmtSubDate,
  isPaymentConfigured,
  planTitle,
  type PlanId,
  type SubscriptionDoc,
} from '@/lib/subscription';

type Props = {
  sub: SubscriptionDoc | null;
  canSubmit: boolean;
  uid: string | null;
  username: string | null;
  onSubmit: (plan: PlanId) => Promise<void>;
};

/** Платный доступ к ИИ-коучу: выбор тарифа + отправка заявки на подтверждение. */
export function AiPaywall({ sub, canSubmit, uid, username, onSubmit }: Props) {
  const c = useThemeColors();
  const [selected, setSelected] = useState<PlanId>('3m');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pending = sub?.status === 'pending';
  const payEnabled = isPaymentConfigured();
  const price = PLAN_BY_ID[selected].price;

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      // Регистрируем заявку (видна админу)
      await onSubmit(selected);
      // Переход на страницу оплаты (СБП/карта), если настроен кошелёк
      const url = uid && username ? buildPaymentUrl(selected, uid, username) : null;
      if (url) await Linking.openURL(url);
    } catch (e) {
      setError((e as Error)?.message ?? 'Не удалось продолжить');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.wrap}>
      <View style={[styles.hero, { backgroundColor: c.accentSoft, borderColor: c.border }]}>
        <View style={[styles.heroIcon, { backgroundColor: c.card }]}>
          <Ionicons name="sparkles" size={22} color={c.accent} />
        </View>
        <Text style={[styles.heroTitle, { color: c.text }]}>ИИ-коуч — по подписке</Text>
        <Text style={[styles.heroSub, { color: c.muted }]}>
          Персональные тренировки, разбор анкеты и подсчёт калорий по фото. Выберите тариф.
        </Text>
      </View>

      {pending ? (
        <View style={[styles.statusCard, { backgroundColor: c.card, borderColor: c.accent }]}>
          <Ionicons name="hourglass-outline" size={20} color={c.accent} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.statusTitle, { color: c.text }]}>Заявка на рассмотрении</Text>
            <Text style={[styles.statusSub, { color: c.muted }]}>
              Тариф «{planTitle(sub!.plan)}» · {sub!.price} ₽. После подтверждения оплаты администратором доступ
              откроется автоматически.
            </Text>
          </View>
        </View>
      ) : null}

      {sub?.status === 'rejected' ? (
        <View style={[styles.statusCard, { backgroundColor: c.card, borderColor: c.danger }]}>
          <Ionicons name="close-circle-outline" size={20} color={c.danger} />
          <Text style={[styles.statusSub, { color: c.muted, flex: 1 }]}>
            Предыдущая заявка отклонена. Можно оформить снова.
          </Text>
        </View>
      ) : null}

      {/* Тарифы */}
      <View style={styles.plans}>
        {PLANS.map((p) => {
          const active = selected === p.id;
          return (
            <Pressable
              key={p.id}
              onPress={() => setSelected(p.id)}
              style={[
                styles.plan,
                { backgroundColor: c.card, borderColor: active ? c.accent : c.border },
                active && { borderWidth: 2 },
              ]}>
              <View style={styles.planLeft}>
                <View
                  style={[
                    styles.radio,
                    { borderColor: active ? c.accent : c.border, backgroundColor: active ? c.accent : 'transparent' },
                  ]}>
                  {active ? <Ionicons name="checkmark" size={13} color={c.onAccent} /> : null}
                </View>
                <View>
                  <Text style={[styles.planTitle, { color: c.text }]}>{p.title}</Text>
                  <Text style={[styles.planPer, { color: c.muted }]}>{p.perMonth}</Text>
                </View>
              </View>
              <View style={styles.planRight}>
                {p.badge ? (
                  <View style={[styles.badge, { backgroundColor: c.accentSoft }]}>
                    <Text style={[styles.badgeText, { color: c.accent }]}>{p.badge}</Text>
                  </View>
                ) : null}
                <Text style={[styles.planPrice, { color: c.text }]}>{p.price} ₽</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Перевод по СБП (ручной режим) */}
      {!payEnabled ? (
        <View style={[styles.sbpCard, { backgroundColor: c.card, borderColor: c.accent }]}>
          <Text style={[styles.sbpLabel, { color: c.muted }]}>Перевод по СБП ({price} ₽)</Text>
          <Text style={[styles.sbpPhone, { color: c.text }]} selectable>
            {SBP_PHONE}
          </Text>
          <Text style={[styles.sbpBank, { color: c.muted }]}>
            {SBP_BANK} · {SBP_RECIPIENT}
          </Text>
        </View>
      ) : null}

      {/* Реквизиты оплаты */}
      <View style={[styles.payNote, { backgroundColor: c.cardElevated, borderColor: c.border }]}>
        <Ionicons name="card-outline" size={16} color={c.muted} />
        <Text style={[styles.payNoteText, { color: c.muted }]}>{PAYMENT_NOTE}</Text>
      </View>

      {error ? <Text style={[styles.error, { color: c.danger }]}>{error}</Text> : null}

      {!canSubmit ? (
        <Text style={[styles.error, { color: c.muted }]}>
          Войдите в аккаунт, чтобы оформить подписку.
        </Text>
      ) : (
        <Pressable
          onPress={submit}
          disabled={busy}
          style={[styles.cta, { backgroundColor: c.accent, opacity: busy ? 0.6 : 1 }]}>
          {busy ? (
            <ActivityIndicator color={c.onAccent} size="small" />
          ) : (
            <Text style={[styles.ctaText, { color: c.onAccent }]}>
              {payEnabled ? `Оплатить ${price} ₽` : pending ? 'Изменить тариф и отправить снова' : 'Оформить заявку'}
            </Text>
          )}
        </Pressable>
      )}

      {payEnabled && canSubmit ? (
        <Text style={[styles.expiry, { color: c.muted }]}>СБП · банковская карта · безопасно через ЮMoney</Text>
      ) : null}

      {sub?.expiresAt && sub.status === 'active' ? (
        <Text style={[styles.expiry, { color: c.muted }]}>Подписка активна до {fmtSubDate(sub.expiresAt)}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14, paddingBottom: 24 },
  hero: { borderRadius: WebTheme.radiusLg, borderWidth: 1, padding: 20, alignItems: 'center', gap: 8 },
  heroIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', letterSpacing: -0.4, textAlign: 'center' },
  heroSub: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 19 },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  statusTitle: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  statusSub: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 19, marginTop: 2 },
  plans: { gap: 10 },
  plan: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  planLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  planTitle: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  planPer: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  planRight: { alignItems: 'flex-end', gap: 4 },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  planPrice: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  sbpCard: { borderRadius: 16, borderWidth: 1, padding: 16, alignItems: 'center', gap: 2 },
  sbpLabel: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  sbpPhone: { fontSize: 22, fontFamily: 'Inter_700Bold', letterSpacing: 0.3 },
  sbpBank: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  payNote: { flexDirection: 'row', gap: 10, borderRadius: 14, borderWidth: 1, padding: 14 },
  payNoteText: { flex: 1, fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  error: { fontSize: 13, fontFamily: 'Inter_500Medium', textAlign: 'center' },
  cta: { borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  ctaText: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  expiry: { fontSize: 12, textAlign: 'center', fontFamily: 'Inter_400Regular' },
});
