#!/usr/bin/env node
/* Writes site/data/releases.json from the latest releases of the Windows and Android apps and from stores.json.
   The page reads only this file, so visitors never call the GitHub API themselves (a campus network shares
   one IP and its 60 requests an hour).
   No release yet, or a file missing from it: that entry is null and the page links to the releases page.
   The API failing or refusing (rate limit, 5xx, network): exit 1, so the workflow keeps the site already
   published instead of deploying one without files. */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const REPOS = {
    desktop: 'SSSox/Simple-UniverKazNU-Desktop',
    android: 'SSSox/Simple-UniverKazNU-Android'
};
export const VARIANTS = ['modern-x64', 'modern-x86', 'legacy-x64', 'legacy-x86'];
export const APK = 'Simple-UniverKazNU.apk';
export const STORE_ORIGINS = {
    chrome: 'https://chromewebstore.google.com/detail/',
    edge: 'https://microsoftedge.microsoft.com/addons/detail/',
    firefox: 'https://addons.mozilla.org/'
};

const VERSION = /^v(\d{1,4}\.\d{1,4}\.\d{1,4})$/;
const EXTENSION_VERSION = '\\d{1,4}\\.\\d{1,4}\\.\\d{1,4}(?:\\.\\d{1,5})?';

function download(repo, tag, name) {
    return 'https://github.com/' + repo + '/releases/download/' + tag + '/' + encodeURIComponent(name);
}

function hexOf(text) {
    const match = /^\s*([0-9a-fA-F]{64})\b/.exec(String(text || ''));
    return match ? match[1].toLowerCase() : null;
}

function digestOf(asset) {
    const match = /^sha256:([0-9a-f]{64})$/.exec(String(asset && asset.digest || ''));
    return match ? match[1] : null;
}

/* One file of a release, or null. The URL is built from the tag and the exact name, never taken from the API. */
function file(repo, release, name, sums) {
    const asset = (release.assets || []).find(item => item && item.name === name && (item.state === undefined || item.state === 'uploaded'));
    if (!asset || !Number.isSafeInteger(asset.size) || asset.size <= 0) return null;
    return {
        name,
        url: download(repo, release.tag_name, name),
        size: asset.size,
        sha256: digestOf(asset) || (sums && sums[name]) || null
    };
}

function day(value) {
    const match = /^(\d{4}-\d{2}-\d{2})T/.exec(String(value || ''));
    return match ? match[1] : null;
}

/* Names of files whose checksum must come from their .sha256 neighbour (the API had no digest). */
export function missingDigests(release, names) {
    return names.filter(name => {
        const asset = (release.assets || []).find(item => item && item.name === name);
        return asset && !digestOf(asset) && (release.assets || []).some(item => item && item.name === name + '.sha256');
    });
}

export function desktopNames(version) {
    const names = [];
    for (const variant of VARIANTS) {
        names.push('Univer-Desktop-' + version + '-' + variant + '-setup.exe', 'Univer-Desktop-' + version + '-' + variant + '.zip');
    }
    return names;
}

export function extensionNames(release) {
    const chromium = new RegExp('^Univer-Extension-(' + EXTENSION_VERSION + ')-chromium\\.zip$');
    const firefox = new RegExp('^Univer-Extension-(' + EXTENSION_VERSION + ')-firefox\\.xpi$');
    // A release can carry an extension-only fix (0.15.0.1) beside 0.15.0, for one browser or both, and the AMO-signed
    // .xpi is added by hand later: each browser gets its own newest file.
    const parts = version => version.split('.').map(Number).concat(0).slice(0, 4);
    const newer = (a, b) => { const x = parts(a), y = parts(b); for (let i = 0; i < 4; i++) if (x[i] !== y[i]) return x[i] > y[i]; return false; };
    const best = { chromium: null, firefox: null }, versions = { chromium: null, firefox: null };
    for (const asset of release.assets || []) {
        const name = String(asset && asset.name || '');
        // A file still uploading (or a failed upload) is not a candidate: the older complete one stays offered.
        if (!asset || (asset.state !== undefined && asset.state !== 'uploaded') || !Number.isSafeInteger(asset.size) || asset.size <= 0) continue;
        for (const [kind, pattern] of [['chromium', chromium], ['firefox', firefox]]) {
            const match = pattern.exec(name);
            if (match && (versions[kind] === null || newer(match[1], versions[kind]))) { best[kind] = name; versions[kind] = match[1]; }
        }
    }
    let version = versions.chromium;
    if (versions.firefox !== null && (version === null || newer(versions.firefox, version))) version = versions.firefox;
    return { chromium: best.chromium, firefox: best.firefox, version };
}

export function desktop(release, sums) {
    const repo = REPOS.desktop;
    const tag = VERSION.exec(String(release && release.tag_name || ''));
    if (!tag || release.draft || release.prerelease) return null;
    const version = tag[1];
    const files = {};
    for (const variant of VARIANTS) {
        files[variant] = {
            setup: file(repo, release, 'Univer-Desktop-' + version + '-' + variant + '-setup.exe', sums),
            zip: file(repo, release, 'Univer-Desktop-' + version + '-' + variant + '.zip', sums)
        };
    }
    const ext = extensionNames(release);
    return {
        version,
        date: day(release.published_at),
        page: 'https://github.com/' + repo + '/releases/tag/' + release.tag_name,
        files,
        extension: ext.chromium || ext.firefox ? {
            version: ext.version,
            chromium: ext.chromium ? file(repo, release, ext.chromium, sums) : null,
            firefox: ext.firefox ? file(repo, release, ext.firefox, sums) : null
        } : null
    };
}

export function android(release, sums) {
    const repo = REPOS.android;
    const tag = VERSION.exec(String(release && release.tag_name || ''));
    if (!tag || release.draft || release.prerelease) return null;
    return {
        version: tag[1],
        date: day(release.published_at),
        page: 'https://github.com/' + repo + '/releases/tag/' + release.tag_name,
        apk: file(repo, release, APK, sums),
        latest: 'https://github.com/' + repo + '/releases/latest/download/' + APK
    };
}

/* Store links the owner fills in after publication; anything off the store's own address is dropped. */
export function stores(value) {
    const result = { chrome: null, edge: null, firefox: null };
    for (const key of Object.keys(result)) {
        const url = value && typeof value[key] === 'string' ? value[key].trim() : '';
        if (!url) continue;
        let parsed;
        try { parsed = new URL(url); } catch { continue; }
        if (parsed.username || parsed.password || parsed.port) continue;
        if (parsed.href.startsWith(STORE_ORIGINS[key]) && parsed.href.length <= 300) result[key] = parsed.href;
    }
    return result;
}

export async function latest(repo, fetcher, token) {
    const headers = { 'Accept': 'application/vnd.github+json', 'User-Agent': 'simpleuniver-pages', 'X-GitHub-Api-Version': '2022-11-28' };
    if (token) headers.Authorization = 'Bearer ' + token;
    const response = await fetcher('https://api.github.com/repos/' + repo + '/releases/latest', { headers });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(repo + ': GitHub API answered ' + response.status);
    return response.json();
}

async function checksums(repo, release, names, fetcher) {
    const sums = {};
    for (const name of missingDigests(release, names)) {
        const response = await fetcher(download(repo, release.tag_name, name + '.sha256'), { headers: { 'User-Agent': 'simpleuniver-pages' } });
        if (response.ok) sums[name] = hexOf(await response.text());
    }
    return sums;
}

export async function build({ fetcher = fetch, token = process.env.GITHUB_TOKEN, storeLinks = {}, now = new Date() } = {}) {
    const desktopRelease = await latest(REPOS.desktop, fetcher, token);
    const androidRelease = await latest(REPOS.android, fetcher, token);
    let desktopData = null, androidData = null;
    if (desktopRelease) {
        const tag = VERSION.exec(String(desktopRelease.tag_name || ''));
        const ext = extensionNames(desktopRelease);
        const names = tag ? desktopNames(tag[1]).concat([ext.chromium, ext.firefox].filter(Boolean)) : [];
        desktopData = desktop(desktopRelease, await checksums(REPOS.desktop, desktopRelease, names, fetcher));
    }
    if (androidRelease) {
        androidData = android(androidRelease, await checksums(REPOS.android, androidRelease, [APK], fetcher));
    }
    return {
        generated: now.toISOString(),
        desktop: desktopData,
        android: androidData,
        stores: stores(storeLinks)
    };
}

async function main() {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    const storeLinks = JSON.parse(await readFile(path.join(root, 'stores.json'), 'utf8'));
    const data = await build({ storeLinks });
    const target = path.join(root, 'site', 'data', 'releases.json');
    await writeFile(target, JSON.stringify(data, null, 2) + '\n', 'utf8');
    const desktopFiles = data.desktop ? Object.values(data.desktop.files).flatMap(item => [item.setup, item.zip]).filter(Boolean).length : 0;
    console.log('releases.json: Windows ' + (data.desktop ? data.desktop.version + ' (' + desktopFiles + ' files)' : 'none') +
        ', Android ' + (data.android ? data.android.version : 'none') +
        ', extension ' + (data.desktop && data.desktop.extension ? data.desktop.extension.version : 'none'));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main().catch(error => { console.error(error.message); process.exit(1); });
}
