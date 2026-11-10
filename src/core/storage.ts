/** Erasing browser storage so that a failure is noticed instead of swallowed. Importable in plain Node. */

export type KeyStore = Pick<Storage, 'getItem' | 'removeItem'>;

/**
 * Removes the keys and checks that they are really gone. Throws if the storage throws or a key is still
 * there afterwards; every key is tried even when an earlier one failed. With no storage at all (Node) there is nothing to erase.
 */
export function eraseKeys(keys: readonly string[], store?: KeyStore): void {
  const s = store ?? (globalThis as { localStorage?: KeyStore }).localStorage; // reading it may throw: that is a failure too
  if (!s) return;
  let failure: unknown;
  for (const key of keys) {
    try {
      s.removeItem(key);
    } catch (e) {
      failure ??= e;
    }
  }
  if (failure !== undefined) throw failure;
  for (const key of keys) {
    if (s.getItem(key) !== null) throw new Error(`storage still holds ${key}`);
  }
}
