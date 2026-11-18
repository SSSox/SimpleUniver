import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const strings = createRequire(import.meta.url)('../site/assets/strings.js');
const html = await readFile(new URL('../site/index.html', import.meta.url), 'utf8');
const decode = text => text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');

test('every text key of the page exists in all three languages', () => {
    const keys = new Set([...html.matchAll(/data-t(?:-aria|-alt|-content)?="([A-Za-z0-9]+)"/g)].map(match => match[1]));
    for (const key of keys) {
        assert.ok(strings[key], 'missing key ' + key);
        assert.equal(strings[key].length, 3, key);
        strings[key].forEach((text, index) => assert.ok(typeof text === 'string' && text.trim(), key + '[' + index + ']'));
    }
});

test('the Russian text in index.html, read without scripts, is the dictionary’s Russian text', () => {
    let checked = 0;
    for (const match of html.matchAll(/<([a-z0-9]+)[^>]*\sdata-t="([A-Za-z0-9]+)"[^>]*>([^<]*)<\/\1>/g)) {
        assert.equal(decode(match[3]), strings[match[2]][0], match[2]);
        checked++;
    }
    for (const match of html.matchAll(/data-t-(alt|content|aria)="([A-Za-z0-9]+)"[^>]*?\s(?:alt|content|aria-label)="([^"]*)"/g)) {
        assert.equal(decode(match[3]), strings[match[2]][0], match[2]);
        checked++;
    }
    assert.ok(checked > 120, 'checked ' + checked);
});

test('placeholders match across languages and the copy keeps to plain punctuation', () => {
    for (const [key, values] of Object.entries(strings)) {
        const holes = values.map(text => (text.match(/\{\d\}/g) || []).sort().join());
        assert.ok(holes.every(value => value === holes[0]), 'placeholders differ in ' + key);
        values.forEach(text => assert.doesNotMatch(text, /[–—]/, 'dash in ' + key));
    }
});
