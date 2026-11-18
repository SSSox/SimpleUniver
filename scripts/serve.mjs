#!/usr/bin/env node
/* Serves site/ at http://127.0.0.1:<port>/SimpleUniver/, the same path GitHub Pages uses, for a local look.
   Usage: node scripts/serve.mjs [port]   (default 8780; 8765 is the extension's QA fixture server) */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'site');
const port = Number(process.argv[2]) || 8780;
const prefix = '/SimpleUniver/';
const types = {
    '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp'
};

createServer(async (request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    if (url.pathname === '/' || url.pathname === '/SimpleUniver') {
        response.writeHead(302, { Location: prefix });
        return response.end();
    }
    if (!url.pathname.startsWith(prefix)) { response.writeHead(404); return response.end('not found'); }
    let file;
    try { file = path.resolve(root, '.' + decodeURIComponent(url.pathname.slice(prefix.length - 1))); }
    catch { response.writeHead(400); return response.end('bad address'); }
    if (!file.startsWith(root)) { response.writeHead(403); return response.end(); }
    try {
        if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
        const body = await readFile(file);
        response.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        response.end(body);
    } catch {
        response.writeHead(404);
        response.end('not found');
    }
}).listen(port, '127.0.0.1', () => console.log('http://127.0.0.1:' + port + prefix));
