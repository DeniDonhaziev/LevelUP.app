import { encode } from 'base-64';

/** Как на сайте: btoa(encodeURIComponent(password)) */
export function hashPassword(password: string): string {
  return encode(encodeURIComponent(password));
}

export function verifyPassword(password: string, stored: string): boolean {
  return hashPassword(password) === stored;
}
