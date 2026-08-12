// ================================================================
// backend.js — optional Cloudflare bridge for Grow A Grade+
// If Pages Functions are deployed (GET /api/ping → {gag:true}) this
// hydrates reference data from R2 (XML) into localStorage on boot and
// write-throughs saves to /api/save/:type. On plain static hosting
// (no Functions) it silently no-ops and the app runs in demo mode.
//
// Load AFTER xml-utils.js + api.js, BEFORE features.js.
// Pages must `await API.ready` before their first render.
//
// Admin writes to protected types (users/students/houses/tcasPrograms)
// need a token: set window.GAG_ADMIN_TOKEN before this script runs, or
// manage that reference data via Admin → "นำเข้า CSV" (token-guarded).
// ================================================================
(function () {
  if (typeof API === 'undefined' || typeof XMLUtils === 'undefined') return;
  const SC = window.SCHEMAS || {};
  const TYPES = Object.keys(SC);
  const SKIP_WRITETHROUGH = new Set(['auditLogs']); // avoid write storms; audit stays local
  const token = () => window.GAG_ADMIN_TOKEN || '';

  async function detect() {
    try {
      const r = await fetch('/api/ping', { cache: 'no-store' });
      if (!r.ok) return false;
      const j = await r.json();
      return !!(j && j.gag);
    } catch { return false; }
  }

  async function hydrate() {
    const on = await detect();
    API.backend = on;
    if (!on) return false;

    // Pull each reference file from R2. 404 = not seeded yet → keep embedded SEED.
    for (const t of TYPES) {
      try {
        const r = await fetch('/api/data/' + t, { cache: 'no-store' });
        if (!r.ok) continue;
        const xml = await r.text();
        const recs = XMLUtils.parseList(xml, SC[t].item);
        localStorage.setItem('gag_' + t, JSON.stringify(recs));
      } catch { /* keep seed for this type */ }
    }

    // Write-through: every API.save also persists the whole type as XML to R2.
    const origSave = API.save.bind(API);
    API.save = function (type, data) {
      origSave(type, data);
      if (SKIP_WRITETHROUGH.has(type) || !TYPES.includes(type)) return;
      const headers = { 'content-type': 'application/json' };
      if (token()) headers['x-admin-token'] = token();
      fetch('/api/save/' + type, { method: 'POST', headers, body: JSON.stringify(data) })
        .catch(() => { /* offline / unauthorized → local copy still updated */ });
    };

    console.log('☁️ Grow A Grade+ : Cloudflare backend active (data hydrated from R2)');
    return true;
  }

  // Pages await this before first render.
  API.ready = hydrate();
})();
