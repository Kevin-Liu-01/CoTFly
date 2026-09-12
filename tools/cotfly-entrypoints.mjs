import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const artifact = (name) => fileURLToPath(new URL(`../dist/${name}`, import.meta.url));
const game = readFileSync(artifact('index.html'), 'utf8');
const consolePage = readFileSync(artifact('fly.html'), 'utf8');
assert.ok(game.includes('id="app"'), 'Expected the freshly built game entry before publishing');
assert.ok(consolePage.includes('id="specimen"'), 'Expected the CoTFly console entry');
// Vercel can serve an existing index before applying a framework rewrite.
// Publish real static entries so the root always opens the console.
writeFileSync(artifact('game.html'), game);
writeFileSync(artifact('index.html'), consolePage);
writeFileSync(artifact('robots.txt'), 'User-agent: *\nAllow: /\n\nSitemap: https://fly.kevinliu.studio/sitemap.xml\n');
writeFileSync(artifact('sitemap.xml'), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://fly.kevinliu.studio/</loc></url></urlset>\n');
console.log('CoTFly entrypoints: console at / and /fly; embedded battle at /game.html');
