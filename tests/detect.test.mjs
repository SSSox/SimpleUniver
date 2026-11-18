import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const { detect, recommend } = createRequire(import.meta.url)('../site/assets/detect.js');

const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36';
const CHROME_109 = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36';

function windows(input) {
    const found = detect(input);
    return [found.os, found.variant, found.release, found.arch, found.sure];
}

test('Firefox writes the real Windows version, so Legacy and the bitness come from the user agent', () => {
    assert.deepEqual(windows({ userAgent: 'Mozilla/5.0 (Windows NT 6.1; Win64; x64; rv:115.0) Gecko/20100101 Firefox/115.0' }), ['windows', 'legacy', '7', 'x64', true]);
    assert.deepEqual(windows({ userAgent: 'Mozilla/5.0 (Windows NT 6.3; rv:115.0) Gecko/20100101 Firefox/115.0' }), ['windows', 'legacy', '8.1', 'x86', true]);
    assert.deepEqual(windows({ userAgent: 'Mozilla/5.0 (Windows NT 6.2; WOW64; rv:115.0) Gecko/20100101 Firefox/115.0' }), ['windows', 'legacy', '8', 'x64', true]);
    assert.deepEqual(windows({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; rv:146.0) Gecko/20100101 Firefox/146.0' }), ['windows', 'modern', null, 'x86', true]);
});

test('Chrome and Edge hide the Windows version, so only the hints tell Windows 7 from Windows 11', () => {
    assert.deepEqual(windows({ userAgent: CHROME_109, platform: 'Windows' }), ['windows', 'modern', null, 'x64', false]);
    const hints = (platformVersion, architecture, bitness) => ({ platformVersion, architecture, bitness });
    assert.deepEqual(windows({ userAgent: CHROME_109, platform: 'Windows', hints: hints('0.1.0', 'x86', '64') }), ['windows', 'legacy', '7', 'x64', true]);
    assert.deepEqual(windows({ userAgent: CHROME_109, platform: 'Windows', hints: hints('0.3.0', 'x86', '32') }), ['windows', 'legacy', '8.1', 'x86', true]);
    assert.deepEqual(windows({ userAgent: CHROME, platform: 'Windows', hints: hints('10.0.0', 'x86', '32') }), ['windows', 'modern', '10', 'x86', true]);
    assert.deepEqual(windows({ userAgent: CHROME, platform: 'Windows', hints: hints('19.0.0', 'x86', '64') }), ['windows', 'modern', '11', 'x64', true]);
    assert.deepEqual(windows({ userAgent: CHROME, platform: 'Windows', hints: hints('15.0.0', 'arm', '64') }), ['windows', 'modern', '11', 'arm64', true]);
});

test('each device gets the build it can run, and the honest answer where there is none', () => {
    const offer = input => recommend(detect(input));
    assert.deepEqual(offer({ userAgent: CHROME, platform: 'Windows', hints: { platformVersion: '15.0.0', architecture: 'x86', bitness: '64' } }), { kind: 'windows', variant: 'modern', arch: 'x64' });
    assert.deepEqual(offer({ userAgent: CHROME_109, platform: 'Windows', hints: { platformVersion: '0.1.0', architecture: 'x86', bitness: '32' } }), { kind: 'windows', variant: 'legacy', arch: 'x86' });
    assert.deepEqual(offer({ userAgent: CHROME, platform: 'Windows', hints: { platformVersion: '15.0.0', architecture: 'arm', bitness: '64' } }), { kind: 'extension', reason: 'arm' });
    assert.deepEqual(offer({ userAgent: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36' }), { kind: 'android' });
    assert.deepEqual(offer({ userAgent: 'Mozilla/5.0 (Android 14; Mobile; rv:146.0) Gecko/146.0 Firefox/146.0' }), { kind: 'android' });
    assert.deepEqual(offer({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1' }), { kind: 'none', reason: 'ios' });
    const ipadOrMac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15';
    assert.deepEqual(offer({ userAgent: ipadOrMac, maxTouchPoints: 5 }), { kind: 'none', reason: 'ios' }, 'iPadOS presents itself as a Mac');
    assert.deepEqual(offer({ userAgent: ipadOrMac, maxTouchPoints: 0 }), { kind: 'extension', reason: 'mac' });
    assert.deepEqual(offer({ userAgent: 'Mozilla/5.0 (X11; Linux x86_64; rv:146.0) Gecko/20100101 Firefox/146.0' }), { kind: 'extension', reason: 'linux' });
    assert.deepEqual(offer({ userAgent: 'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36' }), { kind: 'extension', reason: 'chromeos' });
    assert.deepEqual(offer({ userAgent: '' }), { kind: 'choose' });
});
