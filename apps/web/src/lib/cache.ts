const store = new Map<string, { at: number; value: unknown }>();
export async function cached<T>(
  key: string,
  ttlMs: number,
  load: () => Promise<T>,
  force = false,
): Promise<T> {
  const hit = store.get(key);
  if (!force && hit && Date.now() - hit.at < ttlMs) return hit.value as T;
  const value = await load();
  store.set(key, { at: Date.now(), value });
  return value;
}
export function invalidate(prefix: string) {
  for (const key of [...store.keys()])
    if (key.startsWith(prefix)) store.delete(key);
}

/** Drop everything, e.g. on sign-out so one user's data never leaks to the next. */
export function clearCache() {
  store.clear();
}
