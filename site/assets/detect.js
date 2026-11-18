/* Which download suits this device. A pure function, shared by the page and the tests (tests/detect.test.mjs).
   Chrome and Edge 107+ write "Windows NT 10.0; Win64; x64" on every Windows, Windows 7 included, so only the
   high-entropy hints (platformVersion 0.x = Windows 7/8/8.1, 1-12 = Windows 10, 13+ = Windows 11) tell Legacy
   from Modern there. Firefox still writes the real NT version. */
(function (root, factory) {
    'use strict';
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.SimpleUniverDetect = factory();
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    var LEGACY_NT = { '6.1': '7', '6.2': '8', '6.3': '8.1' };

    function windowsFromHints(hints) {
        var major = parseInt(String(hints.platformVersion || '').split('.')[0], 10);
        var minor = parseInt(String(hints.platformVersion || '').split('.')[1], 10);
        if (isNaN(major)) return null;
        if (major === 0) return { variant: 'legacy', release: minor === 1 ? '7' : minor === 2 ? '8' : minor === 3 ? '8.1' : null };
        return { variant: 'modern', release: major >= 13 ? '11' : '10' };
    }

    function archFromHints(hints) {
        var arch = String(hints.architecture || '').toLowerCase();
        if (arch === 'arm') return 'arm64';
        if (arch === 'x86') return hints.bitness === '32' ? 'x86' : hints.bitness === '64' ? 'x64' : null;
        return null;
    }

    /* input: { userAgent, maxTouchPoints, platform (userAgentData.platform), hints (getHighEntropyValues result) }
       result: { os, variant, release, arch, sure }
         os: windows | android | ios | mac | linux | chromeos | unknown
         variant (Windows only): modern | legacy; release: '7' | '8' | '8.1' | '10' | '11' | null
         arch (Windows only): x64 | x86 | arm64 | null
         sure: false while the browser may hide the Windows version or the processor (hints not read yet). */
    function detect(input) {
        input = input || {};
        var ua = String(input.userAgent || '');
        var platform = String(input.platform || '');
        var hints = input.hints || null;
        var touch = Number(input.maxTouchPoints) || 0;

        if (/Android/i.test(ua) || platform === 'Android') return simple('android');
        if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && touch > 1)) return simple('ios');
        if (/CrOS/.test(ua) || platform === 'Chrome OS' || platform === 'ChromeOS') return simple('chromeos');

        var nt = /Windows NT (\d+\.\d+)/.exec(ua);
        if (nt || platform === 'Windows') {
            var result = { os: 'windows', variant: 'modern', release: null, arch: null, sure: false };
            var fromHints = hints && windowsFromHints(hints);
            if (fromHints) {
                result.variant = fromHints.variant;
                result.release = fromHints.release;
            } else if (nt && LEGACY_NT[nt[1]]) {
                result.variant = 'legacy';
                result.release = LEGACY_NT[nt[1]];
            }
            result.arch = (hints && archFromHints(hints)) ||
                (/ARM64|aarch64/i.test(ua) ? 'arm64' : /Win64|WOW64|x64|amd64/i.test(ua) ? 'x64' : 'x86');
            // Without hints: Firefox tells the truth about NT 6.x and 10.0; a Chromium browser does not.
            result.sure = !!fromHints || !input.platform;
            return result;
        }

        if (/Macintosh|Mac OS X/.test(ua) || platform === 'macOS') return simple('mac');
        if (/Linux|X11/.test(ua) || platform === 'Linux') return simple('linux');
        return simple('unknown');
    }

    function simple(os) { return { os: os, variant: null, release: null, arch: null, sure: true }; }

    /* What to offer first: a Windows build, the APK, the browser extension or nothing for this device. */
    function recommend(found) {
        if (found.os === 'windows') {
            if (found.arch === 'arm64') return { kind: 'extension', reason: 'arm' };
            return { kind: 'windows', variant: found.variant, arch: found.arch || 'x64' };
        }
        if (found.os === 'android') return { kind: 'android' };
        if (found.os === 'ios') return { kind: 'none', reason: 'ios' };
        if (found.os === 'mac' || found.os === 'linux' || found.os === 'chromeos') return { kind: 'extension', reason: found.os };
        return { kind: 'choose' };
    }

    return { detect: detect, recommend: recommend };
});
