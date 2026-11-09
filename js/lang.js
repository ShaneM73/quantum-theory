// Current page language for module code. Set by js/i18n.js before modules run.
const LANGS = ['en', 'zh', 'es', 'ja'];
const attr = document.documentElement.getAttribute('data-lang');
export const lang = LANGS.includes(attr) ? attr : 'en';

// L(en, zh, es, ja): pick the string for the current language (falls back to English).
export function L(en, zh, es, ja) {
  const v = { en, zh, es, ja }[lang];
  return v === undefined ? en : v;
}
