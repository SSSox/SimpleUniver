/* The privacy page holds all three languages in the HTML (store reviewers read it without scripts);
   this shows the one the visitor chose on the download page, else the browser's. */
(function () {
    'use strict';
    var LANGS = ['ru', 'kz', 'en'], HTML_LANGS = ['ru', 'kk', 'en'];
    var TITLES = ['Simple Univer: конфиденциальность расширения', 'Simple Univer: кеңейтудің құпиялылығы', 'Simple Univer: extension privacy'];
    function saved() {
        try { return window.localStorage.getItem('simpleuniver-lang'); } catch (e) { return null; }
    }
    function start() {
        var value = saved();
        if (LANGS.indexOf(value) >= 0) return LANGS.indexOf(value);
        var wanted = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'ru'];
        for (var i = 0; i < wanted.length; i++) {
            var code = String(wanted[i]).toLowerCase();
            if (/^(kk|kz)/.test(code)) return 1;
            if (/^ru/.test(code)) return 0;
            if (/^en/.test(code)) return 2;
        }
        return 0;
    }
    function show(index) {
        document.documentElement.lang = HTML_LANGS[index];
        document.title = TITLES[index];
        Array.prototype.forEach.call(document.querySelectorAll('article.policy'), function (article) {
            article.hidden = article.getAttribute('data-lang') !== LANGS[index];
        });
        Array.prototype.forEach.call(document.querySelectorAll('.lang button'), function (button) {
            button.setAttribute('aria-pressed', String(button.getAttribute('data-lang') === LANGS[index]));
        });
    }
    Array.prototype.forEach.call(document.querySelectorAll('.lang button'), function (button) {
        button.addEventListener('click', function () {
            var index = LANGS.indexOf(button.getAttribute('data-lang'));
            try { window.localStorage.setItem('simpleuniver-lang', LANGS[index]); } catch (e) { /* storage blocked: choice lasts this visit */ }
            show(index);
        });
    });
    show(start());
})();
