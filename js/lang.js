// Current page language for module code. Set by js/i18n.js before modules run.
const LANGS = ['en', 'es'];
const attr = document.documentElement.getAttribute('data-lang');
export const lang = LANGS.includes(attr) ? attr : 'en';

// L(en, es): pick the string for the current language (English by default).
export function L(en, es) {
  return lang === 'es' && es !== undefined ? es : en;
}
