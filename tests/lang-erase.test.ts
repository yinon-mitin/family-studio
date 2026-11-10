import { afterEach, describe, expect, it, vi } from 'vitest';
import { eraseLang, getLang, setLang } from '../src/i18n/index.ts';

afterEach(() => {
  setLang('ru');
  vi.unstubAllGlobals();
});

describe('eraseLang', () => {
  it('removes the stored language and keeps the language in memory', () => {
    const data = new Map([['family-crest:lang', 'en']]);
    vi.stubGlobal('localStorage', { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) });
    setLang('en');
    eraseLang();
    expect(data.has('family-crest:lang')).toBe(false);
    expect(getLang()).toBe('en');
  });

  it('throws when the key stays', () => {
    vi.stubGlobal('localStorage', { getItem: () => 'en', setItem: () => {}, removeItem: () => {} });
    expect(() => eraseLang()).toThrow();
  });
});
