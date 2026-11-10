import { useEffect, useState } from 'preact/hooks';
import { ru, type Key } from './ru.ts';
import { en } from './en.ts';
import { eraseKeys } from '../core/storage.ts';

export type Lang = 'ru' | 'en';
export const LANGS: Lang[] = ['ru', 'en'];
export const DEFAULT_LANG: Lang = 'ru';

const STORAGE_KEY = 'family-crest:lang';
const DICTS: Record<Lang, Record<Key, string>> = { ru, en };

const isLang = (v: unknown): v is Lang => v === 'ru' || v === 'en';

function initialLang(): Lang {
  if (typeof window === 'undefined') return DEFAULT_LANG;
  try {
    const q = new URLSearchParams(location.search).get('lang');
    if (isLang(q)) return q;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isLang(saved)) return saved;
  } catch {
    /* хранилище или адрес недоступны: остаётся язык по умолчанию */
  }
  return DEFAULT_LANG;
}

let lang: Lang = initialLang();
const listeners = new Set<() => void>();

export const getLang = (): Lang => lang;

/** Подставляет значения в {name} и выбирает строку по текущему языку. */
export function t(key: Key, params?: Record<string, string | number>): string {
  const s = DICTS[lang][key] ?? ru[key];
  return params ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m)) : s;
}

/** Пара «русский / английский» для небольших данных, которые удобнее хранить рядом с кодом. */
export interface Pair {
  ru: string;
  en: string;
}
export const pick = (p: Pair): string => p[lang];
/** Выбор из двух вариантов по текущему языку. */
export const tx = (ruText: string, enText: string): string => (lang === 'en' ? enText : ruText);

/** Применяет язык к самой странице: атрибут lang, заголовок вкладки (название сайта) и описание для поисковиков. */
export function applyDocumentLang(): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = lang;
  document.title = t('shell.title'); // the shell adds the tool's name once it is shown
  document.querySelector('meta[name="description"]')?.setAttribute('content', t('shell.description'));
}

/** Forgets the saved language choice (the language in use stays until the page is reloaded). Throws if it could not be erased. */
export function eraseLang(): void {
  eraseKeys([STORAGE_KEY]);
}

export function setLang(next: Lang): void {
  if (next === lang) return;
  lang = next;
  try {
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* язык просто не запомнится */
  }
  applyDocumentLang();
  listeners.forEach((l) => l());
}

/** Текущий язык для компонента: при смене языка он перерисовывается. */
export function useLang(): Lang {
  const [value, setValue] = useState(lang);
  useEffect(() => {
    const on = () => setValue(lang);
    listeners.add(on);
    on();
    return () => {
      listeners.delete(on);
    };
  }, []);
  return value;
}
