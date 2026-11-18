/* The download page: language, what to offer this device, files from data/releases.json, tabs, copying and the viewer.
   Without this script the page still works: every panel shows, in Russian, with links to the release pages. */
(function () {
    'use strict';
    var T = window.SimpleUniverStrings, D = window.SimpleUniverDetect;
    var LANGS = ['ru', 'kz', 'en'], HTML_LANGS = ['ru', 'kk', 'en'];
    var DESKTOP_RELEASES = 'https://github.com/SSSox/Simple-UniverKazNU-Desktop/releases/latest';
    var ANDROID_RELEASES = 'https://github.com/SSSox/Simple-UniverKazNU-Android/releases/latest';
    var APK_LATEST = 'https://github.com/SSSox/Simple-UniverKazNU-Android/releases/latest/download/Simple-UniverKazNU.apk';
    var FILE_URL = /^https:\/\/github\.com\/SSSox\/Simple-UniverKazNU-(Desktop|Android)\/releases\/(download|tag|latest)\//;
    var STORES = {
        chrome: 'https://chromewebstore.google.com/detail/',
        edge: 'https://microsoftedge.microsoft.com/addons/detail/',
        firefox: 'https://addons.mozilla.org/'
    };
    var RUNTIMES = {
        modern: { net: 'netModern', netUrl: null, vc: 'vcModern', vcUrl: 'https://aka.ms/vs/17/release/vc_redist.{0}.exe' },
        legacy: { net: 'netLegacy', netUrl: 'https://www.microsoft.com/en-us/download/details.aspx?id=42642', vc: 'vcLegacy', vcUrl: 'https://aka.ms/vs/16/release/vc_redist.{0}.exe' }
    };

    var lang = 0, data = null, found = null, offer = null, waiting = false, chosen = false;
    var state = { system: 'modern', bits: 'x64' };

    function $(selector, root) { return (root || document).querySelector(selector); }
    function $$(selector, root) { return Array.prototype.slice.call((root || document).querySelectorAll(selector)); }
    function t(key, args) {
        var entry = T[key], text = entry ? (entry[lang] !== undefined ? entry[lang] : entry[0]) : key;
        (args || []).forEach(function (value, index) { text = text.split('{' + index + '}').join(value); });
        return text;
    }
    function remember(key, value) {
        try {
            if (value === undefined) return window.localStorage.getItem(key);
            window.localStorage.setItem(key, value);
        } catch (e) { /* private window or blocked storage: the choice lasts until reload */ }
        return null;
    }
    function fileUrl(value) { return typeof value === 'string' && FILE_URL.test(value) ? value : null; }
    function storeUrl(store, value) { return typeof value === 'string' && value.indexOf(STORES[store]) === 0 ? value : null; }
    function megabytes(bytes) {
        var mb = bytes / 1048576, text = String(mb >= 100 ? Math.round(mb) : Math.round(mb * 10) / 10);
        return (lang === 2 ? text : text.replace('.', ',')) + ' ' + t('mb');
    }
    function day(iso) {
        var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
        if (!match) return '';
        var month = t('months').split(' ')[parseInt(match[2], 10) - 1], date = parseInt(match[3], 10);
        return lang === 1 ? match[1] + ' жылғы ' + date + ' ' + month : date + ' ' + month + ' ' + match[1];
    }
    function link(href, text) {
        var anchor = document.createElement('a');
        anchor.href = href;
        anchor.textContent = text;
        return anchor;
    }
    function systemName(variant) { return t(variant === 'legacy' ? 'winLegacy' : 'winModern'); }
    function bitsName(arch) { return t(arch === 'x86' ? 'bits32' : 'bits64'); }

    /* Language: the visitor's choice, else the browser's first language we speak, else Russian. */
    function startLanguage() {
        var saved = remember('simpleuniver-lang');
        if (LANGS.indexOf(saved) >= 0) return LANGS.indexOf(saved);
        var wanted = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'ru']);
        for (var i = 0; i < wanted.length; i++) {
            var code = String(wanted[i]).toLowerCase();
            if (/^(kk|kz)/.test(code)) return 1;
            if (/^ru/.test(code)) return 0;
            if (/^en/.test(code)) return 2;
        }
        return 0;
    }

    function localize() {
        document.documentElement.lang = HTML_LANGS[lang];
        $$('[data-t]').forEach(function (node) { node.textContent = t(node.getAttribute('data-t')); });
        $$('[data-t-aria]').forEach(function (node) { node.setAttribute('aria-label', t(node.getAttribute('data-t-aria'))); });
        $$('[data-t-alt]').forEach(function (node) { node.alt = t(node.getAttribute('data-t-alt')); });
        $$('[data-t-content]').forEach(function (node) { node.setAttribute('content', t(node.getAttribute('data-t-content'))); });
        $$('.lang button').forEach(function (button) { button.setAttribute('aria-pressed', String(button.getAttribute('data-lang') === LANGS[lang])); });
        var heads = $$('.compare thead th').map(function (cell) { return cell.textContent; });
        $$('.compare tbody tr').forEach(function (row) {
            $$('td', row).forEach(function (cell, index) { cell.setAttribute('data-col', heads[index + 1] || ''); });
        });
        render();
    }

    /* Windows: two file cards for the chosen system and bitness. */
    function fillFile(card, file, labelKey) {
        var anchor = $('[data-part=link]', card), label = $('[data-part=link] span', card);
        var url = file && fileUrl(file.url);
        anchor.href = url || (data && data.desktop && fileUrl(data.desktop.page)) || DESKTOP_RELEASES;
        label.textContent = url ? t(labelKey) : t('openRelease');
        $('[data-part=size]', card).textContent = url && file.size > 0 ? megabytes(file.size) : '';
        var name = $('[data-part=name]', card);
        name.textContent = url ? file.name : '';
        name.hidden = !url;
        var sum = $('[data-part=sum]', card), sha = url && /^[0-9a-f]{64}$/.test(file.sha256 || '') ? file.sha256 : '';
        sum.hidden = !sha;
        $('[data-part=sha]', card).textContent = sha;
        $('.copy', sum).setAttribute('data-copy', sha);
    }

    function renderWindows() {
        var variant = state.system + '-' + state.bits;
        var files = data && data.desktop && data.desktop.files && data.desktop.files[variant];
        $$('#panel-windows input[name=system]').forEach(function (input) { input.checked = input.value === state.system; });
        $$('#panel-windows input[name=bits]').forEach(function (input) { input.checked = input.value === state.bits; });
        fillFile($('#file-setup'), files && files.setup, 'dlSetup');
        fillFile($('#file-zip'), files && files.zip, 'dlZip');
        $('#legacy-warning').hidden = state.system !== 'legacy';
        $('#x86-note').hidden = !(state.system === 'modern' && state.bits === 'x86');

        var runtime = RUNTIMES[state.system], net = $('#need-net'), vc = $('#need-vc');
        net.textContent = '';
        net.appendChild(runtime.netUrl ? link(runtime.netUrl, t(runtime.net)) : document.createTextNode(t(runtime.net)));
        vc.textContent = '';
        vc.appendChild(link(runtime.vcUrl.replace('{0}', state.bits), t(runtime.vc, [state.bits])));

        var setup = files && files.setup;
        $('#hash-command').textContent = 'Get-FileHash .\\' + (setup ? setup.name : 'Univer-Desktop-' + (data && data.desktop ? data.desktop.version : '0.15.0') + '-' + variant + '-setup.exe');
        releaseLine($('#release-windows'), data && data.desktop, DESKTOP_RELEASES);
    }

    function releaseLine(node, release, fallback) {
        node.textContent = '';
        if (release && release.version) {
            node.appendChild(document.createTextNode(t('releaseLine', [release.version, day(release.date)]) + ' · '));
            node.appendChild(link(fileUrl(release.page) || fallback, t('releaseAll')));
        } else if (data === false) {
            node.appendChild(document.createTextNode(t('noData') + ' '));
            node.appendChild(link(fallback, t('openRelease')));
        } else {
            node.appendChild(link(fallback, t('releaseAll')));
        }
    }

    function renderAndroid() {
        var release = data && data.android, apk = release && release.apk, url = apk && fileUrl(apk.url);
        $('#apk-link').href = url || APK_LATEST;
        $('#apk-meta').textContent = url ? t('apkMeta', [release.version, megabytes(apk.size)]) : t('apkMetaDefault');
        var sha = url && /^[0-9a-f]{64}$/.test(apk.sha256 || '') ? apk.sha256 : '';
        $('#apk-sum').hidden = !sha;
        $('#apk-sha').textContent = sha;
        releaseLine($('#release-android'), release, ANDROID_RELEASES);
    }

    function extension() {
        var ext = data && data.desktop && data.desktop.extension;
        return {
            stores: (data && data.stores) || {},
            zip: ext && ext.chromium && fileUrl(ext.chromium.url) ? ext.chromium : null,
            xpi: ext && ext.firefox && fileUrl(ext.firefox.url) ? ext.firefox : null
        };
    }

    function renderBrowser() {
        var ext = extension();
        $$('.browser').forEach(function (card) {
            var store = card.getAttribute('data-store');
            var url = storeUrl(store, ext.stores[store]) || (store === 'firefox' && ext.xpi ? ext.xpi.url : null);
            $('[data-part=pending]', card).hidden = !!url;
            var install = $('[data-part=install]', card);
            install.hidden = !url;
            if (url) install.href = url; else install.removeAttribute('href');
        });
        $('#ext-manual').hidden = !ext.zip;
        if (ext.zip) {
            $('#ext-zip').href = ext.zip.url;
            $('#ext-zip-size').textContent = megabytes(ext.zip.size);
        }
    }

    function browserStore() {
        var ua = navigator.userAgent;
        return /Firefox\//.test(ua) ? 'firefox' : /Edg\//.test(ua) ? 'edge' : /Chrome\//.test(ua) ? 'chrome' : null;
    }

    function renderHero() {
        var button = $('#hero-button'), verb = $('#hero-verb'), meta = $('#hero-meta'), note = $('#hero-note'), other = $('#hero-other');
        button.hidden = false;
        button.href = '#download';
        button.removeAttribute('data-tab');
        verb.textContent = t('heroDownload');
        meta.textContent = t('heroMetaDefault');
        note.hidden = true;
        note.textContent = '';
        other.textContent = t('heroOther');
        if (waiting || !offer) return;

        if (offer.kind === 'windows') {
            var setup = data && data.desktop && data.desktop.files && data.desktop.files[offer.variant + '-' + offer.arch];
            setup = setup && setup.setup && fileUrl(setup.setup.url) ? setup.setup : null;
            var system = systemName(offer.variant) + ', ' + bitsName(offer.arch);
            if (setup) {
                button.href = setup.url;
                meta.textContent = t('heroMetaWindows', [systemName(offer.variant), bitsName(offer.arch), megabytes(setup.size)]);
            } else {
                button.setAttribute('data-tab', 'windows');
                meta.textContent = system;
            }
            if (!found.sure) { note.textContent = t('heroNoteWindows', [system]); note.hidden = false; }
        } else if (offer.kind === 'android') {
            var apk = data && data.android && data.android.apk;
            button.href = apk && fileUrl(apk.url) ? apk.url : APK_LATEST;
            meta.textContent = apk && fileUrl(apk.url) ? t('heroMetaAndroid', [megabytes(apk.size)]) : t('apkMetaDefault');
        } else if (offer.kind === 'extension') {
            var ext = extension(), store = browserStore();
            var url = store && (storeUrl(store, ext.stores[store]) || (store === 'firefox' && ext.xpi ? ext.xpi.url : null));
            verb.textContent = t('heroExtension');
            meta.textContent = t('heroMetaExtension');
            if (url) button.href = url; else button.setAttribute('data-tab', 'browser');
            note.textContent = t(offer.reason === 'arm' ? 'heroNoteArm' : 'heroNoteDesktop') + (url || ext.zip ? '' : ' ' + t('heroNotePending'));
            note.hidden = false;
        } else if (offer.kind === 'none') {
            button.hidden = true;
            note.textContent = t('heroNoteIos');
            note.hidden = false;
        }
    }

    function render() {
        renderWindows();
        renderAndroid();
        renderBrowser();
        renderHero();
    }

    /* Tabs (download platforms and screenshot groups): click, arrows, Home and End, as WAI-ARIA tabs. */
    function tabs(list, onUser) {
        var buttons = $$('[role=tab]', list);
        list.hidden = false;
        function select(target, focus) {
            buttons.forEach(function (button) {
                var on = button === target;
                button.setAttribute('aria-selected', String(on));
                button.tabIndex = on ? 0 : -1;
                document.getElementById(button.getAttribute('aria-controls')).hidden = !on;
            });
            if (focus) target.focus();
        }
        buttons.forEach(function (button, index) {
            button.addEventListener('click', function () {
                select(button, false);
                if (onUser) onUser();
            });
            button.addEventListener('keydown', function (event) {
                var next = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: buttons.length - 1 }[event.key];
                if (next === undefined) return;
                event.preventDefault();
                select(buttons[(next + buttons.length) % buttons.length], true);
                if (onUser) onUser();
            });
        });
        select(buttons.filter(function (button) { return button.getAttribute('aria-selected') === 'true'; })[0] || buttons[0], false);
        return {
            show: function (name) {
                var target = buttons.filter(function (button) { return button.id.split('-').pop() === name; })[0];
                if (target) select(target, false);
            }
        };
    }

    var platformTabs, shotTabs;

    function applyOffer() {
        if (offer && !chosen) {
            if (offer.kind === 'windows') {
                state.system = offer.variant;
                state.bits = offer.arch === 'x86' ? 'x86' : 'x64';
                platformTabs.show('windows');
            } else if (offer.kind === 'android' || offer.kind === 'none') {
                platformTabs.show(offer.kind === 'android' ? 'android' : 'windows');
                shotTabs.show('android');
            } else if (offer.kind === 'extension') {
                platformTabs.show('browser');
            }
        }
        document.documentElement.classList.toggle('is-phone', !!found && (found.os === 'android' || found.os === 'ios'));
        render();
    }

    function detectNow(hints) {
        var agent = navigator.userAgentData;
        found = D.detect({
            userAgent: navigator.userAgent,
            maxTouchPoints: navigator.maxTouchPoints,
            platform: agent && agent.platform,
            hints: hints
        });
        offer = D.recommend(found);
    }

    function detectDevice() {
        detectNow(null);
        var agent = navigator.userAgentData;
        if (!(found.os === 'windows' && agent && typeof agent.getHighEntropyValues === 'function')) { applyOffer(); return; }
        // Chrome and Edge tell Windows 7 from Windows 11 and 32 from 64 bits only here. Until then the hero offers no file.
        waiting = true;
        var done = false;
        function finish(hints) {
            if (done) return;
            done = true;
            waiting = false;
            if (hints) detectNow(hints);
            applyOffer();
        }
        agent.getHighEntropyValues(['platformVersion', 'architecture', 'bitness']).then(finish, function () { finish(null); });
        setTimeout(function () { finish(null); }, 1000);
        render();
    }

    /* Copy a checksum or the PowerShell command; when the clipboard is refused, select the text instead. */
    function copy(button) {
        var from = button.getAttribute('data-copy-from');
        var source = from ? document.getElementById(from) : null;
        var text = button.getAttribute('data-copy') || (source ? source.textContent : '');
        var label = $('span', button), status = $('#status');
        function say(key) {
            label.textContent = t(key);
            status.textContent = t(key);
            clearTimeout(button.copyTimer);
            button.copyTimer = setTimeout(function () { label.textContent = t('copy'); }, 1800);
        }
        function select() {
            var target = source || $('.sum-value', button.parentNode);
            if (target) {
                var range = document.createRange();
                range.selectNodeContents(target);
                var selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(range);
            }
            say('copyFail');
        }
        if (!text) return;
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { say('copied'); }, select);
        else select();
    }

    /* The screenshot viewer: a native dialog with previous and next; Escape closes it. */
    function viewer() {
        var dialog = $('#viewer');
        if (!dialog || typeof dialog.showModal !== 'function') return;
        var image = $('#viewer-image'), caption = $('#viewer-caption'), count = $('#viewer-count');
        var group = [], index = 0, opener = null;
        function show(at) {
            index = (at + group.length) % group.length;
            var shot = group[index];
            image.src = shot.getAttribute('href');
            image.alt = $('img', shot).alt;
            caption.textContent = $('.caption', shot).textContent;
            count.textContent = t('counter', [index + 1, group.length]);
            $('#viewer-prev').hidden = $('#viewer-next').hidden = group.length < 2;
        }
        $$('.shot').forEach(function (shot) {
            shot.addEventListener('click', function (event) {
                if (event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0) return;
                event.preventDefault();
                group = $$('.shot', shot.parentNode);
                opener = shot;
                show(group.indexOf(shot));
                dialog.showModal();
            });
        });
        $('#viewer-prev').addEventListener('click', function () { show(index - 1); });
        $('#viewer-next').addEventListener('click', function () { show(index + 1); });
        $('#viewer-close').addEventListener('click', function () { dialog.close(); });
        dialog.addEventListener('click', function (event) { if (event.target === dialog) dialog.close(); });
        dialog.addEventListener('keydown', function (event) {
            if (event.key === 'ArrowLeft') { event.preventDefault(); show(index - 1); }
            if (event.key === 'ArrowRight') { event.preventDefault(); show(index + 1); }
        });
        dialog.addEventListener('close', function () {
            image.removeAttribute('src');
            if (opener) opener.focus();
        });
    }

    function start() {
        var status = document.createElement('p');
        status.id = 'status';
        status.className = 'visually-hidden';
        status.setAttribute('role', 'status');
        document.body.appendChild(status);

        lang = startLanguage();
        platformTabs = tabs($('#download .tabs'), function () { chosen = true; });
        shotTabs = tabs($('#screens .tabs'));
        $$('.lang button').forEach(function (button) {
            button.addEventListener('click', function () {
                lang = LANGS.indexOf(button.getAttribute('data-lang'));
                remember('simpleuniver-lang', LANGS[lang]);
                localize();
            });
        });
        $$('#panel-windows input[type=radio]').forEach(function (input) {
            input.addEventListener('change', function () {
                if (!input.checked) return;
                state[input.name === 'system' ? 'system' : 'bits'] = input.value;
                chosen = true;
                renderWindows();
            });
        });
        $$('.copy').forEach(function (button) { button.addEventListener('click', function () { copy(button); }); });
        $('#hero-button').addEventListener('click', function () {
            var tab = this.getAttribute('data-tab');
            if (tab) platformTabs.show(tab);
        });
        var wanted = /^#(windows|android|browser)$/.exec(location.hash);
        if (wanted) {
            chosen = true;
            platformTabs.show(wanted[1]);
            document.getElementById('download').scrollIntoView();
        }
        viewer();
        localize();
        detectDevice();

        fetch('data/releases.json', { cache: 'no-cache' }).then(function (response) {
            if (!response.ok) throw new Error(String(response.status));
            return response.json();
        }).then(function (value) {
            data = value && typeof value === 'object' ? value : false;
            render();
        }, function () {
            data = false;
            render();
        });
    }

    start();
})();
