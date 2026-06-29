/** ── Подписка на ИИ-коуч ── */

export type PlanId = '1m' | '3m' | '12m';
export type SubStatus = 'pending' | 'active' | 'rejected';

export type SubscriptionDoc = {
  uid: string;
  username: string;
  email: string;
  plan: PlanId;
  status: SubStatus;
  price: number;
  requestedAt: number;
  activatedAt?: number;
  expiresAt?: number;
};

export type PlanInfo = {
  id: PlanId;
  months: number;
  price: number;
  title: string;
  perMonth: string;
  badge?: string;
};

export const PLANS: PlanInfo[] = [
  { id: '1m', months: 1, price: 299, title: '1 месяц', perMonth: '299 ₽ / мес' },
  { id: '3m', months: 3, price: 699, title: '3 месяца', perMonth: '233 ₽ / мес', badge: 'выгодно' },
  { id: '12m', months: 12, price: 1999, title: '12 месяцев', perMonth: '167 ₽ / мес', badge: 'лучшая цена' },
];

export const PLAN_BY_ID: Record<PlanId, PlanInfo> = {
  '1m': PLANS[0],
  '3m': PLANS[1],
  '12m': PLANS[2],
};

/**
 * Кошелёк ЮMoney для приёма оплаты (СБП/карта).
 * ВСТАВЬТЕ сюда номер своего кошелька ЮMoney (вид: 4100 1XXX XXXX XXX).
 * Создать: yoomoney.ru → войти по номеру телефона → «Кошелёк» → номер счёта.
 * Пока пусто — показывается ручной режим (заявка → админ присылает реквизиты).
 */
export const YOOMONEY_WALLET = '';

const SUCCESS_URL = 'https://leveluptracker.web.app/';

export function isPaymentConfigured(): boolean {
  return YOOMONEY_WALLET.trim().length > 0;
}

/** Ссылка на страницу оплаты ЮMoney (СБП + карта), сумма и метка заявки уже вписаны. */
export function buildPaymentUrl(plan: PlanId, uid: string, username: string): string | null {
  if (!isPaymentConfigured()) return null;
  const p = PLAN_BY_ID[plan];
  const q = [
    `receiver=${encodeURIComponent(YOOMONEY_WALLET.trim())}`,
    `quickpay-form=button`,
    `sum=${p.price}`,
    `label=${encodeURIComponent(`${uid}:${plan}`)}`,
    `targets=${encodeURIComponent(`LevelUp ИИ — ${p.title} (${username})`)}`,
    `successURL=${encodeURIComponent(SUCCESS_URL)}`,
  ].join('&');
  return `https://yoomoney.ru/quickpay/confirm?${q}`;
}

/** Текст про оплату на пейволе. */
export const PAYMENT_NOTE = isPaymentConfigured()
  ? 'Оплата картой или через СБП на защищённой странице ЮMoney. Доступ к ИИ откроется сразу после подтверждения оплаты администратором.'
  : 'Нажмите «Оформить заявку» — администратор свяжется с вами и пришлёт реквизиты для оплаты. Доступ к ИИ откроется автоматически после подтверждения.';

export function planTitle(plan: PlanId): string {
  return PLAN_BY_ID[plan]?.title ?? plan;
}

export function isSubActive(sub: SubscriptionDoc | null): boolean {
  return !!sub && sub.status === 'active' && (sub.expiresAt ?? 0) > Date.now();
}

/** Прибавить месяцы к метке времени (ms). */
export function addMonths(baseMs: number, months: number): number {
  const d = new Date(baseMs);
  d.setMonth(d.getMonth() + months);
  return d.getTime();
}

export function fmtSubDate(ms?: number): string {
  if (!ms) return '—';
  const d = new Date(ms);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

/** Сколько дней осталось до окончания подписки (>= 0). */
export function daysLeft(sub: SubscriptionDoc | null): number {
  if (!sub?.expiresAt) return 0;
  return Math.max(0, Math.ceil((sub.expiresAt - Date.now()) / 86_400_000));
}
