// ================================================================
// Cloudflare Pages Function — Grow A Grade+  (XML on R2)
// Routes:
//   GET  /api/ping           → { gag:true }  (backend-detect probe)
//   GET  /api/data/:type     → XML from R2 (404 if not seeded yet)
//   POST /api/import/:type   → CSV body → XML → R2   (needs x-admin-token)
//   POST /api/save/:type     → JSON array body → XML → R2 (bulk overwrite)
//   POST /api/write/:type    → single JSON record → upsert in XML → R2
// Binding: env.DATA (R2 bucket) · Secret: env.ADMIN_TOKEN
// ================================================================

// ── Schemas (MUST mirror js/api.js SCHEMAS) ─────────────────────── //
const SCHEMAS = {
  users:          { root:'users',          item:'user',    id:'id', fields:['id','username','role','displayName','email','active','houseId','studentId'], required:['id','username','role'], lists:{ permissions:{sep:'|',child:'permission'} } },
  students:       { root:'students',        item:'student', id:'id', fields:['id','displayName','plan','level','prevGPAX','prevCredits','houseId'], required:['id','displayName'] },
  houses:         { root:'houses',          item:'house',   id:'id', fields:['id','name','color','desc'], required:['id','name'], lists:{ keywords:{sep:'|',child:'keyword'} } },
  tcasPrograms:   { root:'tcasPrograms',    item:'program', id:'id', fields:['id','university','faculty','round','minGPAX','quota'], required:['id','university','faculty'] },
  grades:         { root:'grades',          item:'grade',   id:'id', fields:['id','studentId','subject','group','credit','grade','level','term'], required:['id','studentId','subject'] },
  targets:        { root:'targets',         item:'target',  id:'id', fields:['id','studentId','programId'], required:['id','studentId','programId'] },
  news:           { root:'news',            item:'item',    id:'id', fields:['id','authorId','title','body','image','expireAt','at'], required:['id','authorId','title'], lists:{ targetHouses:{sep:'|',child:'house'} } },
  pretests:       { root:'pretests',        item:'pretest', id:'id', fields:['id','studentId','houseId','score','status','takenAt'], required:['id','studentId'] },
  pretestResults: { root:'pretestResults',  item:'result',  id:'id', fields:['id','studentId','houseId','setKey','score','correct','total','completedAt'], required:['id','studentId'] },
  studentHouses:  { root:'studentHouses',   item:'link',    id:'id', fields:['id','studentId','houseId'], required:['id','studentId','houseId'] },
  plans:          { root:'plans',           item:'plan',    id:'id', fields:['id','studentId','title','date','done'], required:['id','studentId'] },
  practice:       { root:'practice',        item:'log',     id:'id', fields:['id','studentId','date'], required:['id','studentId'] },
  threads:        { root:'threads',         item:'thread',  id:'id', fields:['id','houseId','title','body','authorId','at'], required:['id','authorId'] },
  replies:        { root:'replies',         item:'reply',   id:'id', fields:['id','threadId','body','authorId','at'], required:['id','threadId'] },
  chatMessages:   { root:'chatMessages',    item:'msg',     id:'id', fields:['id','fromId','toId','body','at'], required:['id','fromId','toId'] },
  auditLogs:      { root:'auditLogs',       item:'log',     id:'id', fields:['id','actorId','action','entity','entityId','at'], required:['id'] },
};

// Reference (admin-managed) types require a token to write; per-user app data is open.
const PROTECTED = new Set(['users','students','houses','tcasPrograms']);

// ── CSV parser ──────────────────────────────────────────────────── //
function parseCSV(text) {
  text = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else { if (c === '"') q = true; else if (c === ',') { row.push(cur); cur = ''; }
      else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; } else cur += c; }
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  const clean = rows.filter(r => r.some(v => v.trim() !== ''));
  if (clean.length < 1) return { headers: [], records: [] };
  const headers = clean[0].map(h => h.trim());
  const records = clean.slice(1).map(r => { const o = {}; headers.forEach((h, i) => { o[h] = (r[i] ?? '').trim(); }); return o; });
  return { headers, records };
}

const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

function buildXML(s, records) {
  let out = `<?xml version="1.0" encoding="UTF-8"?>\n<${s.root}>\n`;
  for (const rec of records) {
    out += `  <${s.item} id="${esc(rec[s.id])}">\n`;
    for (const f of s.fields) {
      if (f === s.id) continue;
      const val = rec[f] ?? '';
      if (s.lists && s.lists[f]) {
        const { child, sep } = s.lists[f];
        const items = Array.isArray(val) ? val : String(val).split(sep).map(v => v.trim()).filter(Boolean);
        out += `    <${f}>\n`;
        items.forEach(v => { out += `      <${child}>${esc(v)}</${child}>\n`; });
        out += `    </${f}>\n`;
      } else out += `    <${f}>${esc(val)}</${f}>\n`;
    }
    out += `  </${s.item}>\n`;
  }
  return out + `</${s.root}>\n`;
}

const json = (o, status = 200) => new Response(JSON.stringify(o), {
  status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }
});
const xmlResponse = body => new Response(body, {
  headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'no-store', 'access-control-allow-origin': '*' }
});
const authorized = (request, env) => env.ADMIN_TOKEN && request.headers.get('x-admin-token') === env.ADMIN_TOKEN;

async function putXML(env, s, records) {
  await env.DATA.put(`data/${s.root}.xml`, buildXML(s, records), { httpMetadata: { contentType: 'application/xml; charset=utf-8' } });
}

// Minimal server-side XML → records (for /api/write upsert)
function parseXMLRecords(xmlText, s) {
  const records = [];
  const re = new RegExp(`<${s.item}([^>]*)>([\\s\\S]*?)<\\/${s.item}>`, 'g');
  let m;
  while ((m = re.exec(xmlText)) !== null) {
    const idM = m[1].match(/id="([^"]*)"/);
    const rec = { [s.id]: idM ? idM[1] : '' };
    const body = m[2];
    for (const f of s.fields) {
      if (f === s.id) continue;
      if (s.lists && s.lists[f]) {
        const child = s.lists[f].child;
        const list = [...body.matchAll(new RegExp(`<${child}>([^<]*)<\\/${child}>`, 'g'))].map(x => x[1]);
        rec[f] = list;
      } else {
        const fm = body.match(new RegExp(`<${f}>([\\s\\S]*?)<\\/${f}>`));
        rec[f] = fm ? fm[1] : '';
      }
    }
    records.push(rec);
  }
  return records;
}

export async function onRequest({ request, env, params }) {
  const [action, type] = params.path || [];

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': 'content-type, x-admin-token'
    }});
  }

  if (action === 'ping') return json({ gag: true, version: '3.0' });

  const s = SCHEMAS[type];

  // GET /api/data/:type
  if (action === 'data' && request.method === 'GET') {
    if (!s) return json({ error: 'unknown type: ' + type }, 404);
    const obj = await env.DATA.get(`data/${s.root}.xml`);
    if (!obj) return new Response('not found', { status: 404, headers: { 'access-control-allow-origin': '*' } });
    return xmlResponse(await obj.text());
  }

  // POST /api/import/:type  (CSV → XML, admin token)
  if (action === 'import' && request.method === 'POST') {
    if (!s) return json({ error: 'unknown type' }, 404);
    if (!authorized(request, env)) return json({ error: 'unauthorized' }, 401);
    const { headers, records } = parseCSV(await request.text());
    const missing = s.required.filter(r => !headers.includes(r));
    if (missing.length) return json({ error: 'ขาดคอลัมน์: ' + missing.join(', ') }, 400);
    const ids = new Set();
    for (const r of records) {
      if (!r[s.id]) return json({ error: 'มีแถว id ว่าง' }, 400);
      if (ids.has(r[s.id])) return json({ error: 'id ซ้ำ: ' + r[s.id] }, 400);
      ids.add(r[s.id]);
      if (s.lists) Object.keys(s.lists).forEach(f => { if (typeof r[f] === 'string') r[f] = r[f].split('|').map(v => v.trim()).filter(Boolean); });
    }
    await putXML(env, s, records);
    return json({ ok: true, count: records.length, key: `data/${s.root}.xml` });
  }

  // POST /api/save/:type  (bulk JSON array → XML overwrite)
  if (action === 'save' && request.method === 'POST') {
    if (!s) return json({ error: 'unknown type' }, 404);
    if (PROTECTED.has(type) && !authorized(request, env)) return json({ error: 'unauthorized' }, 401);
    let records;
    try { records = await request.json(); } catch { return json({ error: 'bad json' }, 400); }
    if (!Array.isArray(records)) return json({ error: 'expected array' }, 400);
    await putXML(env, s, records);
    return json({ ok: true, count: records.length });
  }

  // POST /api/write/:type  (single record upsert)
  if (action === 'write' && request.method === 'POST') {
    if (!s) return json({ error: 'unknown type' }, 404);
    if (PROTECTED.has(type) && !authorized(request, env)) return json({ error: 'unauthorized' }, 401);
    let record;
    try { record = await request.json(); } catch { return json({ error: 'bad json' }, 400); }
    if (!record[s.id]) return json({ error: 'missing id' }, 400);
    const obj = await env.DATA.get(`data/${s.root}.xml`);
    let records = obj ? parseXMLRecords(await obj.text(), s) : [];
    const idx = records.findIndex(r => r[s.id] === record[s.id]);
    if (idx >= 0) records[idx] = record; else records.push(record);
    await putXML(env, s, records);
    return json({ ok: true, id: record[s.id] });
  }

  return json({ error: 'not found' }, 404);
}
