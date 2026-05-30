export function isTabVisibleForTopic(routeName: string): boolean {
  const hidden = new Set(['projects', 'accounting', 'hr', 'warehouse', 'activity']);
  return !hidden.has(routeName);
}
