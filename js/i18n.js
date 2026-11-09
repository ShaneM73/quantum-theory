// Language switch (classic script, load with `defer` before the page's module script).
// English is the default. Other languages come from ?lang=xx or a remembered choice.
// Elements keep English as their content and carry translations in data-zh / data-es / data-ja
// (innerHTML), plus data-xx-aria and data-xx-title for attributes, and <meta name="title-xx">.
(function () {
  var KEY = 'qtl-lang';
  var LANGS = { en: 'en', zh: 'zh-CN', es: 'es', ja: 'ja' };
  var root = document.documentElement;
  var param = new URLSearchParams(location.search).get('lang');
  var lang = LANGS[param] ? param : null;
  try {
    if (lang) localStorage.setItem(KEY, lang);
    else lang = localStorage.getItem(KEY);
  } catch (e) { /* storage blocked: the URL alone carries the choice */ }
  if (!LANGS[lang]) lang = 'en';
  root.lang = LANGS[lang];
  root.setAttribute('data-lang', lang);

  function go(next) {
    try { localStorage.setItem(KEY, next); } catch (e) {}
    var u = new URL(location.href);
    u.searchParams.set('lang', next);
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
      // keep the choice on internal links even when storage is blocked
      document.querySelectorAll('a[href$=".html"]').forEach(function (el) {
        var href = el.getAttribute('href');
        if (!/^https?:/.test(href)) el.setAttribute('href', href + '?lang=' + lang);
      });
    }
    document.querySelectorAll('select[data-lang-select]').forEach(function (sel) {
      sel.value = lang;
      sel.addEventListener('change', function () { if (sel.value !== lang) go(sel.value); });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply);
  else apply();
})();
