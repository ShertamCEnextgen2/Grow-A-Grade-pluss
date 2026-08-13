// ================================================================
// xml-utils.js — XML parsing & building utilities
// ================================================================

const XMLUtils = {
  /**
   * Parse XML string → flat array of objects
   * Handles nested list elements (e.g., permissions, keywords)
   */
  parseList(xmlStr, itemTag) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlStr, 'application/xml');
    if (doc.querySelector('parsererror')) {
      console.error('XML parse error');
      return [];
    }
    return [...doc.getElementsByTagName(itemTag)].map(el => {
      const obj = { id: el.getAttribute('id') || '' };
      for (const child of el.children) {
        if (child.children.length > 0) {
          // List element → array
          obj[child.tagName] = [...child.children].map(c => c.textContent.trim());
        } else {
          obj[child.tagName] = child.textContent.trim();
        }
      }
      return obj;
    });
  },

  /**
   * Build XML string from array of objects using a schema definition
   * Schema: { root, item, id, fields[], lists?: { fieldName: { sep, child } } }
   */
  buildXML(schema, records) {
    const esc = s => String(s ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    let out = `<?xml version="1.0" encoding="UTF-8"?>\n<${schema.root}>\n`;
    for (const rec of records) {
      out += `  <${schema.item} id="${esc(rec[schema.id])}">\n`;
      for (const f of schema.fields) {
        if (f === schema.id) continue;
        const val = rec[f] ?? '';
        if (schema.lists && schema.lists[f]) {
          const { child, sep } = schema.lists[f];
          const items = Array.isArray(val)
            ? val
            : String(val).split(sep).map(v => v.trim()).filter(Boolean);
          out += `    <${f}>\n`;
          items.forEach(v => { out += `      <${child}>${esc(v)}</${child}>\n`; });
          out += `    </${f}>\n`;
        } else {
          out += `    <${f}>${esc(val)}</${f}>\n`;
        }
      }
      out += `  </${schema.item}>\n`;
    }
    return out + `</${schema.root}>\n`;
  },

  /** Trigger browser download of an XML string */
  downloadXML(content, filename) {
    const blob = new Blob([content], { type: 'application/xml; charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  /** Find record by id in an array */
  getById(list, id) { return list.find(item => item.id === id) || null; },

  /**
   * Parse CSV text → { headers, records }
   * Handles quoted fields, UTF-8 BOM, Windows line endings
   */
  parseCSV(text) {
    text = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    const rows = []; let row = [], cur = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
        else cur += c;
      } else {
        if (c === '"') q = true;
        else if (c === ',') { row.push(cur); cur = ''; }
        else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
        else cur += c;
      }
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    const clean = rows.filter(r => r.some(v => v.trim() !== ''));
    if (clean.length < 2) return { headers: [], records: [] };
    const headers = clean[0].map(h => h.trim());
    const records = clean.slice(1).map(r => {
      const o = {};
      headers.forEach((h, i) => { o[h] = (r[i] ?? '').trim(); });
      return o;
    });
    return { headers, records };
  },

  /** Format date string for display */
  formatDate(isoStr) {
    if (!isoStr) return '—';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch { return isoStr; }
  }
};

window.XMLUtils = XMLUtils;
