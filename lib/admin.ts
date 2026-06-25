import { isFirebaseConfigured } from '@/lib/firebase/config';
import { getFirebaseAuth } from '@/lib/firebase/app';

/** Email-аккаунты с доступом к админ-панели. */
const ADMIN_EMAILS = ['denidonhaziev@mail.ru'];

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

/** Email текущего пользователя Firebase Auth (если вошёл облачно). */
export function getCurrentAuthEmail(): string | null {
  try {
    if (!isFirebaseConfigured()) return null;
    return getFirebaseAuth().currentUser?.email ?? null;
  } catch {
    return null;
  }
}

/** Является ли текущий вошедший пользователь админом. */
export function isCurrentUserAdmin(currentUser?: string | null): boolean {
  if (isAdminEmail(getCurrentAuthEmail())) return true;
  // запасной вариант — если логин совпадает с админ-email
  return isAdminEmail(currentUser);
}
