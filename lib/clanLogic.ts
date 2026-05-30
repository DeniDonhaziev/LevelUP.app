import type { Clan, ClanMember } from '@/lib/types';

const INVITE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateInviteCode(length = 6): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += INVITE_CHARS[Math.floor(Math.random() * INVITE_CHARS.length)];
  }
  return code;
}

export function sortClanMembers(members: ClanMember[]): ClanMember[] {
  return [...members].sort((a, b) => {
    const d = (b.distanceMeters || 0) - (a.distanceMeters || 0);
    if (d !== 0) return d;
    return a.username.localeCompare(b.username, 'ru');
  });
}

export function sortClansByKm(clans: Clan[]): Clan[] {
  return [...clans].sort((a, b) => {
    const d = (b.totalDistanceMeters || 0) - (a.totalDistanceMeters || 0);
    if (d !== 0) return d;
    return a.name.localeCompare(b.name, 'ru');
  });
}
