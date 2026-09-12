import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const artifact = (name) => fileURLToPath(new URL(`../dist/${name}`, import.meta.url));
const game = readFileSync(artifact('game.html'), 'utf8');
const consolePage = readFileSync(artifact('index.html'), 'utf8');
assert.ok(game.includes('id="app"'), 'Expected the independently built battle entry');
assert.ok(consolePage.includes('id="specimen"'), 'Expected CoTFly at the site root');
writeFileSync(artifact('robots.txt'), 'User-agent: *\nAllow: /\n\nSitemap: https://fly.kevinliu.studio/sitemap.xml\n');
writeFileSync(artifact('sitemap.xml'), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://fly.kevinliu.studio/</loc></url></urlset>\n');
console.log('CoTFly entrypoints: console at /; embedded battle at /game.html');
