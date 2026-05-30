export function todayKey(): string {
  const d = new Date();
  return (
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0')
  );
}

/** YYYY-MM для календаря достижений */
export function monthKey(year: number, month1to12: number): string {
  return year + '-' + String(month1to12).padStart(2, '0');
}

export const MONTHS_RU = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
];

export const MONTHS_SHORT_RU = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

export function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Доброе утро!';
  if (h < 18) return 'Добрый день!';
  return 'Добрый вечер!';
}
