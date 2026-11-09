// Language switch (classic script, load with `defer` before the page's module script).
// English is the default. Chinese comes from ?lang=zh or a remembered choice.
// Elements carry their Chinese text in data-zh (innerHTML), data-zh-aria and data-zh-title.
(function () {
  var KEY = 'qtl-lang';
  var root = document.documentElement;
  var param = new URLSearchParams(location.search).get('lang');
  var lang = param === 'zh' || param === 'en' ? param : null;
  try {
    if (lang) localStorage.setItem(KEY, lang);
    else lang = localStorage.getItem(KEY);
  } catch (e) { /* storage blocked: fall back to the URL only */ }
  if (lang !== 'zh') lang = 'en';
  root.lang = lang === 'zh' ? 'zh-CN' : 'en';
  root.setAttribute('data-lang', lang);

  function apply() {
    if (lang === 'zh') {
      document.querySelectorAll('[data-zh]').forEach(function (el) { el.innerHTML = el.getAttribute('data-zh'); });
      document.querySelectorAll('[data-zh-aria]').forEach(function (el) { el.setAttribute('aria-label', el.getAttribute('data-zh-aria')); });
      document.querySelectorAll('[data-zh-title]').forEach(function (el) { el.setAttribute('title', el.getAttribute('data-zh-title')); });
      var t = document.querySelector('meta[name="title-zh"]');
      if (t) document.title = t.getAttribute('content');
      // keep the choice on internal links even when storage is blocked
      document.querySelectorAll('a[href$=".html"]').forEach(function (a) {
        var href = a.getAttribute('href');
        if (!/^https?:/.test(href)) a.setAttribute('href', href + '?lang=zh');
      });
    }
    document.querySelectorAll('[data-lang-toggle]').forEach(function (b) {
      var next = lang === 'zh' ? 'en' : 'zh';
      b.textContent = next === 'zh' ? '中文' : 'English';
      b.setAttribute('lang', next === 'zh' ? 'zh-CN' : 'en');
      b.setAttribute('aria-label', next === 'zh' ? '切换到中文' : 'Switch to English');
      b.addEventListener('click', function () {
        try { localStorage.setItem(KEY, next); } catch (e) {}
        var u = new URL(location.href);
        u.searchParams.set('lang', next);
        location.href = u.toString();
      });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply);
  else apply();
})();
