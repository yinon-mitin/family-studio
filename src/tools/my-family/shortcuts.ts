/** Keyboard matching for undo and redo; pure, so it can be tested in Node. */

export interface ShortcutKeys {
  key: string;
  code: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}

/**
 * The letter the person means. A Latin letter is taken as typed (QWERTZ, AZERTY and Dvorak move it to other physical keys).
 * Only a letter of another script (Cyrillic and the like) falls back to the physical key, because "я" is Ctrl+Z on a Russian layout.
 * Digits, punctuation and dead keys never count.
 */
function letterOf(e: ShortcutKeys): string | null {
  if (/^[a-z]$/i.test(e.key)) return e.key.toLowerCase();
  if (/^\p{L}$/u.test(e.key)) {
    const m = /^Key([A-Z])$/.exec(e.code);
    return m ? m[1].toLowerCase() : null;
  }
  return null;
}

export function shortcutOf(e: ShortcutKeys): 'undo' | 'redo' | null {
  if (!(e.ctrlKey || e.metaKey)) return null;
  const letter = letterOf(e);
  if (letter === 'z') return e.shiftKey ? 'redo' : 'undo';
  if (letter === 'y') return e.shiftKey ? null : 'redo';
  return null;
}
