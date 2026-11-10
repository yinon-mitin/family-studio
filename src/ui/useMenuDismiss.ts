import type { RefObject } from 'preact';
import { useEffect } from 'preact/hooks';

/**
 * A `<details>` menu that stays open until its button is pressed again is a trap:
 * Escape closes it (focus returns to its summary) and so does a press anywhere outside it.
 */
export function useMenuDismiss(menu: RefObject<HTMLDetailsElement | null>): void {
  useEffect(() => {
    const onDown = (e: Event) => {
      const el = menu.current;
      if (el?.open && !el.contains(e.target as Node)) el.open = false;
    };
    const onKey = (e: KeyboardEvent) => {
      const el = menu.current;
      if (e.key !== 'Escape' || !el?.open) return;
      el.open = false;
      el.querySelector('summary')?.focus();
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, []);
}
