// Vercel's build step for this static site: writes the real API base URL into public/config.js.
// Everywhere else (local dev, the droplet serving itself), public/config.js keeps its checked-in
// default (same-origin, empty string) — this only runs as Vercel's `buildCommand`.
import { writeFileSync } from 'node:fs';

const apiBase = process.env.API_BASE_URL || '';
writeFileSync(new URL('../public/config.js', import.meta.url), `window.__API_BASE__ = ${JSON.stringify(apiBase)};\n`);
console.log(`public/config.js written with API_BASE_URL=${apiBase || '(empty — same origin)'}`);
