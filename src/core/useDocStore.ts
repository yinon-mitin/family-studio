import { useEffect, useState } from 'preact/hooks';
import type { DocSnapshot, DocStore } from './docStore.ts';

/** Subscribes a component to a slice of the store; `select` must return a stable value (primitive or a reused reference). */
export function useDocStore<D, T>(store: DocStore<D>, select: (s: DocSnapshot<D>) => T): T {
  const [value, setValue] = useState(() => select(store.get()));
  useEffect(() => {
    const check = () => setValue(() => select(store.get()));
    const off = store.subscribe(check);
    check();
    return off;
  }, [store]);
  return value;
}
