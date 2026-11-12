// Page preferences: language and background theme.
// Classic script, load with `defer` before the page's module script.
//
// Language: English by default; others from ?lang=xx or a remembered choice. Elements keep English
// as their content and carry the Spanish in data-es (innerHTML), plus data-es-aria and
// data-es-title for attributes, and <meta name="title-es">.
// Theme: 'dark' by default; 'light' (bright background for screenshots and figures) from
// ?theme=light or a remembered choice. Sets <html data-theme>.
(function () {
  var LANGS = { en: 'en', es: 'es' };
  var THEMES = { dark: 1, light: 1 };
  var root = document.documentElement;
  var params = new URLSearchParams(location.search);

  function pick(key, param, valid, fallback) {
    var v = valid[param] ? param : null;
    try {
      if (v) localStorage.setItem(key, v);
      else v = localStorage.getItem(key);
    } catch (e) { /* storage blocked: the URL alone carries the choice */ }
    return valid[v] ? v : fallback;
  }
  var lang = pick('qtl-lang', params.get('lang'), LANGS, 'en');
  var theme = pick('qtl-theme', params.get('theme'), THEMES, 'dark');
  root.lang = LANGS[lang];
  root.setAttribute('data-lang', lang);
  root.setAttribute('data-theme', theme);

  function go(key, name, value) {
    try { localStorage.setItem(key, value); } catch (e) {}
    var u = new URL(location.href);
    u.searchParams.set(name, value);
    location.href = u.toString();
  }

  function apply() {
    if (lang !== 'en') {
      var a = 'data-' + lang;
      document.querySelectorAll('[' + a + ']').forEach(function (el) { el.innerHTML = el.getAttribute(a); });
      document.querySelectorAll('[' + a + '-aria]').forEach(function (el) { el.setAttribute('aria-label', el.getAttribute(a + '-aria')); });
      document.querySelectorAll('[' + a + '-title]').forEach(function (el) { el.setAttribute('title', el.getAttribute(a + '-title')); });
      var t = document.querySelector('meta[name="title-' + lang + '"]');
      if (t) document.title = t.getAttribute('content');
    }
    // keep non-default choices on internal links even when storage is blocked
    var q = [];
    if (lang !== 'en') q.push('lang=' + lang);
    if (theme !== 'dark') q.push('theme=' + theme);
    if (q.length) {
      document.querySelectorAll('a[href$=".html"]').forEach(function (el) {
        var href = el.getAttribute('href');
        if (!/^https?:/.test(href)) el.setAttribute('href', href + '?' + q.join('&'));
      });
    }
    document.querySelectorAll('select[data-lang-select]').forEach(function (sel) {
      sel.value = lang;
      sel.addEventListener('change', function () { if (sel.value !== lang) go('qtl-lang', 'lang', sel.value); });
    });
    document.querySelectorAll('select[data-theme-select]').forEach(function (sel) {
      sel.value = theme;
      sel.addEventListener('change', function () { if (sel.value !== theme) go('qtl-theme', 'theme', sel.value); });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply);
  else apply();
})();
