// Base URL for the API. Empty means "same origin" — the default for local dev and for the droplet
// serving both the API and these static files itself. When the front is deployed separately (e.g.
// Vercel calling the API on the droplet), Vercel's build step overwrites this file with the real
// URL — see scripts/build-vercel-config.js and vercel.json.
window.__API_BASE__ = '';
