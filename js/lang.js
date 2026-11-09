// Current page language for module code. Set by js/i18n.js before modules run.
export const lang = document.documentElement.getAttribute('data-lang') === 'zh' ? 'zh' : 'en';
export const L = (en, zh) => (lang === 'zh' ? zh : en);
