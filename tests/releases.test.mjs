import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { build, desktop, android, stores } from '../scripts/releases.mjs';

const fixture = async name => JSON.parse(await readFile(new URL('./fixtures/' + name, import.meta.url), 'utf8'));

function api(routes) {
    const calls = [];
    const fetcher = async (url) => {
        calls.push(url);
        const route = routes[url];
        if (!route) return { ok: false, status: 404, json: async () => ({}), text: async () => '' };
        return { ok: route.status === 200, status: route.status, json: async () => route.body, text: async () => route.body };
    };
    return { fetcher, calls };
}

const DESKTOP_API = 'https://api.github.com/repos/SSSox/Simple-UniverKazNU-Desktop/releases/latest';
const ANDROID_API = 'https://api.github.com/repos/SSSox/Simple-UniverKazNU-Android/releases/latest';

test('the Windows release gives eight files with checksums and links built from the tag', async () => {
    const data = desktop(await fixture('desktop-latest.json'));
    assert.equal(data.version, '0.15.0');
    assert.equal(data.date, '2026-11-16');
    const setup = data.files['modern-x64'].setup;
    assert.deepEqual(setup, {
        name: 'Univer-Desktop-0.15.0-modern-x64-setup.exe',
        url: 'https://github.com/SSSox/Simple-UniverKazNU-Desktop/releases/download/v0.15.0/Univer-Desktop-0.15.0-modern-x64-setup.exe',
        size: 119986216,
        sha256: 'de3f7e9cbb5446dfaf13cab19632a0f7a347a2d2789b23c408617b3843245f05'
    });
    for (const variant of ['modern-x64', 'modern-x86', 'legacy-x64', 'legacy-x86']) {
        assert.ok(data.files[variant].setup && data.files[variant].zip, variant);
        assert.match(data.files[variant].zip.sha256, /^[0-9a-f]{64}$/);
    }
    assert.equal(data.extension, null);
});

test('the Android release gives the APK with its checksum and the address that always serves the newest one', async () => {
    const data = android(await fixture('android-latest.json'));
    assert.equal(data.version, '2.4.0');
    assert.equal(data.apk.sha256, '7d39738499fdf6aa78583527cb63ae5bc35e6c28d820f23647de18a5e461e946');
    assert.equal(data.apk.url, 'https://github.com/SSSox/Simple-UniverKazNU-Android/releases/download/v2.4.0/Simple-UniverKazNU.apk');
    assert.equal(data.latest, 'https://github.com/SSSox/Simple-UniverKazNU-Android/releases/latest/download/Simple-UniverKazNU.apk');
});

test('a file missing from the release, an unfinished upload, a draft or a strange tag become null', async () => {
    const release = await fixture('desktop-latest.json');
    release.assets = release.assets.filter(asset => !asset.name.startsWith('Univer-Desktop-0.15.0-legacy-x86'));
    release.assets.find(asset => asset.name === 'Univer-Desktop-0.15.0-modern-x86.zip').state = 'open';
    const data = desktop(release);
    assert.equal(data.files['legacy-x86'].setup, null);
    assert.equal(data.files['modern-x86'].zip, null);
    assert.ok(data.files['modern-x86'].setup);
    assert.equal(desktop({ ...release, draft: true }), null);
    assert.equal(desktop({ ...release, tag_name: 'v0.15.0"><script>' }), null);
    assert.equal(android({ tag_name: 'latest', assets: [] }), null);
});

test('extension files attached to the Windows release are picked up, with a fourth version part', async () => {
    const release = await fixture('desktop-latest.json');
    release.assets.push(
        { name: 'Univer-Extension-0.15.0.1-chromium.zip', size: 900000, digest: 'sha256:' + 'a'.repeat(64), state: 'uploaded' },
        { name: 'Univer-Extension-0.15.0.1-firefox.zip', size: 900000, digest: 'sha256:' + 'b'.repeat(64), state: 'uploaded' }
    );
    const data = desktop(release);
    assert.equal(data.extension.version, '0.15.0.1');
    assert.equal(data.extension.chromium.url, 'https://github.com/SSSox/Simple-UniverKazNU-Desktop/releases/download/v0.15.0/Univer-Extension-0.15.0.1-chromium.zip');
    assert.equal(data.extension.firefox, null, 'an unsigned Firefox ZIP is not offered; only a signed .xpi is');
});

test('with several extension versions in one release each browser gets its own newest file', async () => {
    const release = await fixture('desktop-latest.json');
    const asset = name => ({ name, size: 900000, digest: 'sha256:' + 'c'.repeat(64), state: 'uploaded' });
    release.assets.push(asset('Univer-Extension-0.15.0.10-chromium.zip'), asset('Univer-Extension-0.15.0-chromium.zip'),
        asset('Univer-Extension-0.15.0-firefox.xpi'), asset('Univer-Extension-0.15.0.2-chromium.zip'));
    const data = desktop(release);
    assert.equal(data.extension.version, '0.15.0.10');
    assert.match(data.extension.chromium.url, /Univer-Extension-0\.15\.0\.10-chromium\.zip$/);
    assert.match(data.extension.firefox.url, /Univer-Extension-0\.15\.0-firefox\.xpi$/, 'the signed .xpi stays offered until a newer one is signed');
    // A Firefox-only fix does not take the Chromium file away.
    const only = await fixture('desktop-latest.json');
    only.assets.push(asset('Univer-Extension-0.15.0-chromium.zip'), asset('Univer-Extension-0.15.0.1-firefox.xpi'));
    const both = desktop(only).extension;
    assert.match(both.chromium.url, /0\.15\.0-chromium\.zip$/);
    assert.match(both.firefox.url, /0\.15\.0\.1-firefox\.xpi$/);
    assert.equal(both.version, '0.15.0.1');
    // A newer .xpi still uploading does not hide the older signed one.
    const uploading = await fixture('desktop-latest.json');
    uploading.assets.push(asset('Univer-Extension-0.15.0-firefox.xpi'), { ...asset('Univer-Extension-0.15.0.1-firefox.xpi'), state: 'open' });
    const pending = desktop(uploading).extension;
    assert.match(pending.firefox.url, /0\.15\.0-firefox\.xpi$/);
    assert.equal(pending.version, '0.15.0');
    // Nor does a newer file with no usable size.
    for (const size of [0, -1, '900', 1.5, undefined]) {
        const sized = await fixture('desktop-latest.json');
        sized.assets.push(asset('Univer-Extension-0.15.0-chromium.zip'), { ...asset('Univer-Extension-0.15.0.1-chromium.zip'), size });
        assert.match(desktop(sized).extension.chromium.url, /0\.15\.0-chromium\.zip$/, String(size));
    }
});

test('a checksum missing from the API is read from the .sha256 file next to it', async () => {
    const release = await fixture('android-latest.json');
    release.assets[0].digest = null;
    const sum = 'c'.repeat(64);
    const { fetcher, calls } = api({
        [DESKTOP_API]: { status: 404 },
        [ANDROID_API]: { status: 200, body: release },
        'https://github.com/SSSox/Simple-UniverKazNU-Android/releases/download/v2.4.0/Simple-UniverKazNU.apk.sha256': { status: 200, body: sum + '  Simple-UniverKazNU.apk\n' }
    });
    const data = await build({ fetcher, token: '', storeLinks: {}, now: new Date('2026-11-18T00:00:00Z') });
    assert.equal(data.desktop, null, 'no Windows release yet is not an error');
    assert.equal(data.android.apk.sha256, sum);
    assert.equal(calls.length, 3);
});

test('a refusal or failure of the GitHub API stops the build instead of writing an empty page', async () => {
    const { fetcher } = api({ [DESKTOP_API]: { status: 403, body: {} } });
    await assert.rejects(build({ fetcher, token: '', storeLinks: {} }), /403/);
    await assert.rejects(build({ fetcher: async () => { throw new Error('network down'); }, token: '', storeLinks: {} }), /network down/);
});

test('store links are kept only on the store’s own address', () => {
    assert.deepEqual(stores({
        chrome: 'https://chromewebstore.google.com/detail/simple-univer/abcdefghijklmnopabcdefghijklmnop',
        edge: 'https://evil.example/addons/detail/x',
        firefox: 'javascript:alert(1)'
    }), {
        chrome: 'https://chromewebstore.google.com/detail/simple-univer/abcdefghijklmnopabcdefghijklmnop',
        edge: null,
        firefox: null
    });
    assert.deepEqual(stores({ chrome: 'https://chromewebstore.google.com.evil.example/detail/x', firefox: 'https://user@addons.mozilla.org/ru/firefox/addon/x/' }),
        { chrome: null, edge: null, firefox: null });
    assert.deepEqual(stores(null), { chrome: null, edge: null, firefox: null });
});
