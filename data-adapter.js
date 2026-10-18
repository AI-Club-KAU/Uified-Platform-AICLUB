/*
 * Data adapter
 * ------------
 * The UI never reads js/data/sample-data.js directly. It goes through A.data, which:
 *   1. fetches raw content from the configured source ('local' or 'apps-script');
 *   2. normalises it (accepting Google-Sheet style rows: strings, Arabic labels, TRUE/FALSE);
 *   3. exposes small query helpers used by the views.
 *
 * Everything that describes content structure is data, not code:
 *   - resourceTypes         global types used by search filters and badges
 *   - department.categories each department's own categories (the category filter)
 *   - department.archives   each department's own archive sections (the archive filter)
 * so new departments / categories appear without changing the UI.
 *
 * Only approved content reaches the platform: the Apps Script endpoint filters it on
 * the server, so everything this adapter receives is shown.
 */
(function (A) {
  'use strict';

  const { safeUrl } = A.utils;

  /* ---------- Defaults (used only when the data does not define its own) ---------- */
  const DEFAULT_TYPES = [
    { id: 'template', label: 'قوالب', singular: 'قالب', icon: 'file-text' },
    { id: 'sheet', label: 'شيتات', singular: 'شيت', icon: 'chart' },
    { id: 'guide', label: 'أدلة', singular: 'دليل', icon: 'book' },
    { id: 'text', label: 'نصوص جاهزة', singular: 'نص جاهز', icon: 'message' },
    { id: 'identity', label: 'هوية بصرية', singular: 'هوية بصرية', icon: 'sparkle' },
    { id: 'system', label: 'أنظمة', singular: 'نظام', icon: 'medal' }
  ];

  const SECTION_ALIASES = {
    department: 'department', departments: 'department', 'قسم': 'department', 'أقسام النادي': 'department',
    shared: 'shared', 'الموارد المشتركة': 'shared', 'مشترك': 'shared',
    system: 'system', systems: 'system', 'أنظمة النادي': 'system', 'نظام': 'system'
  };
  const SECTIONS = {
    department: { label: 'أقسام النادي', route: '#/departments' },
    shared: { label: 'الموارد المشتركة', route: '#/shared' },
    system: { label: 'أنظمة النادي', route: '#/systems' }
  };

  const IMAGE_FORMATS = ['PNG', 'JPG', 'JPEG', 'SVG', 'WEBP'];

  /* ---------- Normalisation helpers ---------- */
  function str(v) { return v == null ? '' : String(v).trim(); }
  function key(v) { return str(v).toLowerCase(); }

  function bool(v, fallback) {
    if (typeof v === 'boolean') return v;
    const s = key(v);
    if (['true', 'yes', '1', 'نعم'].includes(s)) return true;
    if (['false', 'no', '0', 'لا'].includes(s)) return false;
    return fallback;
  }

  function num(v, fallback) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  /** Text content keeps its line breaks; only surrounding blank space is trimmed. */
  function longText(v) {
    return v == null ? '' : String(v).replace(/\r\n?/g, '\n').replace(/^\s*\n|\s+$/g, '');
  }

  /** ISO-like date string, or '' when the value is not a date. */
  function date(v) {
    const s = str(v);
    return s && !isNaN(new Date(s)) ? s : '';
  }

  function guessFormat(url) {
    const m = /\.([a-z0-9]{2,5})(?:[?#]|$)/i.exec(url || '');
    return m ? m[1].toUpperCase() : '';
  }

  /**
   * A list field may arrive as an array of objects, a JSON string (sheet cell), or
   * "a|b|c" entries separated by new lines or ';' (sheet cell). `fields` names the
   * pipe-separated positions, e.g. ['id', 'label'].
   */
  function parseList(value, fields) {
    if (Array.isArray(value)) return value.filter((x) => x && typeof x === 'object');
    const raw = str(value);
    if (!raw) return [];
    if (raw.startsWith('[')) {
      try { const v = JSON.parse(raw); return Array.isArray(v) ? v : []; } catch (e) { return []; }
    }
    return raw.split(/[\n;]+/).map((entry) => {
      const parts = entry.split('|').map((p) => p.trim());
      const o = {};
      fields.forEach((f, i) => { if (parts[i] !== undefined) o[f] = parts[i]; });
      return o;
    });
  }

  /** Files: list field (label|url|format) or simple fileUrl / fileLabel columns. */
  function parseFiles(row) {
    let list = parseList(row.files, ['label', 'url', 'format']);
    // "url" only entries written without a label
    list = list.map((f) => (f.url === undefined && f.label && /[/.]/.test(f.label) ? { url: f.label } : f));
    if (!list.length && str(row.fileUrl)) {
      list = [{ label: str(row.fileLabel), url: str(row.fileUrl), format: str(row.format) }];
    }
    return list
      .map((f) => {
        const url = safeUrl(f.url);
        if (!url) return null;
        const format = str(f.format).toUpperCase() || guessFormat(url) || str(row.format).toUpperCase();
        return {
          label: str(f.label) || str(row.title),
          url,
          format,
          isImage: IMAGE_FORMATS.includes(format),
          preview: key(f.preview) === 'light' ? 'light' : key(f.preview) === 'dark' ? 'dark' : '',
          openable: bool(f.openable, format === 'PDF' || IMAGE_FORMATS.includes(format))
        };
      })
      .filter(Boolean);
  }

  function normalizeTypes(raw) {
    const list = parseList(raw, ['id', 'label', 'singular', 'icon'])
      .map((t) => ({ id: str(t.id), label: str(t.label), singular: str(t.singular) || str(t.label), icon: str(t.icon) }))
      .filter((t) => t.id && t.label);
    return list.length ? list : DEFAULT_TYPES.slice();
  }

  function normalizeDepartment(d, i, warnings) {
    const id = str(d.id);
    const name = str(d.name);
    if (!id || !name) { warnings.push('Department row ' + (i + 1) + ' skipped: missing id or name'); return null; }
    const categories = parseList(d.categories, ['id', 'label'])
      .map((c) => ({ id: str(c.id), label: str(c.label) }))
      .filter((c) => c.id && c.label);
    const archives = parseList(d.archives, ['id', 'title'])
      .map((a) => ({ id: str(a.id), title: str(a.title) }))
      .filter((a) => a.id && a.title);
    return {
      id,
      name,
      description: str(d.description),
      icon: str(d.icon) || 'grid',
      order: num(d.order, i + 1),
      categories,
      archives
    };
  }

  function normalizeResource(r, i, ctx) {
    const { deptById, typeAliases, warnings } = ctx;
    const id = str(r.id);
    const title = str(r.title);
    if (!id || !title) { warnings.push('Resource row ' + (i + 1) + ' skipped: missing id or title'); return null; }

    const section = SECTION_ALIASES[key(r.section)] || (str(r.departmentId) ? 'department' : '');
    if (!section) { warnings.push('Resource "' + id + '" skipped: unknown section'); return null; }

    const departmentId = section === 'department' ? str(r.departmentId) : '';
    const dep = deptById.get(departmentId);
    if (section === 'department' && !dep) {
      warnings.push('Resource "' + id + '" skipped: unknown department "' + departmentId + '"');
      return null;
    }

    // Category / archive must exist in that department's own configuration
    let category = str(r.category);
    if (category && !(dep && dep.categories.some((c) => c.id === category))) {
      warnings.push('Resource "' + id + '": category "' + category + '" is not defined for its department');
      category = '';
    }
    let archive = str(r.archive);
    if (archive && !(dep && dep.archives.some((a) => a.id === archive))) {
      warnings.push('Resource "' + id + '" skipped: archive "' + archive + '" is not defined for its department');
      return null;
    }

    const type = typeAliases.get(key(r.type)) || (section === 'system' ? 'system' : '');
    if (!type) warnings.push('Resource "' + id + '": unknown type "' + str(r.type) + '"');

    const text = longText(r.text);
    let action = key(r.action);
    if (section === 'system') action = 'external';
    else if (archive) action = 'view';       // archive works are view-only
    else if (text && !action) action = 'text';
    if (!['download', 'open', 'external', 'text', 'view'].includes(action)) action = 'download';

    const files = parseFiles(r);
    const createdAt = date(r.createdAt);
    const updatedAt = date(r.updatedAt);
    return {
      id,
      title,
      description: str(r.description),
      section,
      departmentId,
      category,
      archive,
      type,
      format: action === 'text' ? '' : (str(r.format) || (files[0] && files[0].format) || ''),
      action,
      url: safeUrl(r.url),
      files,
      text,
      icon: str(r.icon),
      createdAt,
      // Shown only when the resource was edited after it was added
      updatedAt: updatedAt && updatedAt !== createdAt ? updatedAt : '',
      sizeMb: num(r.sizeMb, 0),
      owner: str(r.owner),
      year: str(r.year),
      order: num(r.order, i + 1),
      tags: str(r.tags)
    };
  }

  function normalize(raw) {
    if (!raw || typeof raw !== 'object') throw new Error('Content payload is empty or invalid');
    const warnings = [];

    const types = normalizeTypes(raw.resourceTypes);
    const typeAliases = new Map();
    types.forEach((t) => [t.id, t.label, t.singular].forEach((k) => typeAliases.set(key(k), t.id)));

    const departments = (Array.isArray(raw.departments) ? raw.departments : [])
      .map((d, i) => normalizeDepartment(d || {}, i, warnings))
      .filter(Boolean)
      .sort((a, b) => a.order - b.order);
    const deptById = new Map(departments.map((d) => [d.id, d]));

    const seen = new Set();
    const resources = (Array.isArray(raw.resources) ? raw.resources : [])
      .map((r, i) => normalizeResource(r || {}, i, { deptById, typeAliases, warnings }))
      .filter(Boolean)
      .filter((r) => {
        if (seen.has(r.id)) { warnings.push('Duplicate resource id "' + r.id + '" ignored'); return false; }
        seen.add(r.id);
        return true;
      })
      .sort((a, b) => a.order - b.order);

    return { types, departments, resources, warnings };
  }

  /* ---------- Sorting ---------- */
  const SORTS = [
    { id: 'newest', label: 'الأحدث' },
    { id: 'oldest', label: 'الأقدم' },
    { id: 'az', label: 'أبجديًا' }
  ];

  function time(r) {
    const t = new Date(r.createdAt).getTime();
    return Number.isFinite(t) ? t : 0;
  }

  /** Returns a sorted copy. Resources without a date go last when sorting by date. */
  function sortResources(list, sort) {
    const out = list.slice();
    if (sort === 'az') return out.sort((a, b) => a.title.localeCompare(b.title, 'ar'));
    if (sort === 'oldest') return out.sort((a, b) => (time(a) || Infinity) - (time(b) || Infinity));
    return out.sort((a, b) => time(b) - time(a));
  }

  /* ---------- Talking to the Apps Script endpoint ---------- */
  /** The web-app URL: https only (http allowed for a local test server). */
  function endpoint() {
    const base = safeUrl(A.config.appsScriptUrl);
    if (/^https:\/\//i.test(base) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//i.test(base)) return base;
    return '';
  }

  /**
   * POST an action to the Apps Script endpoint. text/plain avoids a CORS preflight,
   * which Apps Script web apps don't answer. The session token identifies the member.
   * @returns {Promise<{ok: boolean, code?: string, data?: object}>}
   */
  async function post(action, payload, opts) {
    if (A.config.dataSource !== 'apps-script') return { ok: false, code: 'not-connected' };
    const base = endpoint();
    if (!base) return { ok: false, code: 'not-connected' };
    const body = Object.assign({ action }, opts && opts.noToken ? {} : { token: A.auth.token() }, payload);
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), A.config.requestTimeoutMs || 12000) : null;
    try {
      const res = await fetch(base, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(body),
        redirect: 'follow',
        cache: 'no-store',
        signal: ctrl && ctrl.signal
      });
      const json = await res.json();
      return json && json.ok ? { ok: true, data: json } : { ok: false, code: (json && json.code) || 'error' };
    } catch (e) {
      return { ok: false, code: 'error' };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /** Thrown when the session is no longer valid (member removed / everyone logged out). */
  function authError() {
    const e = new Error('Session is no longer valid');
    e.code = 'auth';
    return e;
  }

  /* ---------- Sources ---------- */
  const sources = {
    local: {
      async fetch() {
        if (!A.sampleData) throw new Error('Sample data file (js/data/sample-data.js) is missing');
        return JSON.parse(JSON.stringify(A.sampleData));
      }
    },

    'apps-script': {
      async fetch() {
        if (!endpoint()) throw new Error('appsScriptUrl is not configured in js/config.js');
        const res = await post('content', {});
        if (res.code === 'auth') throw authError();
        if (!res.ok) throw new Error('Content request failed (' + res.code + ')');
        return res.data;
      }
    }
  };

  /* ---------- Store + queries ---------- */
  let store = null;
  let byId = new Map();
  let deptById = new Map();
  let typeById = new Map();

  /*
   * Content is remembered on this device. On the next visit the platform shows it at once
   * and refreshes it quietly in the background (the Apps Script round trip takes seconds).
   * The server still checks the member on that refresh, and "خروج" clears the copy.
   */
  const CACHE_KEY = 'aiclub.content.v1';
  function readCache() {
    try { const raw = localStorage.getItem(CACHE_KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }
  function writeCache(raw) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(raw)); } catch (e) { /* storage full / blocked */ }
  }

  function apply(raw) {
    store = normalize(raw);
    byId = new Map(store.resources.map((r) => [r.id, r]));
    deptById = new Map(store.departments.map((d) => [d.id, d]));
    typeById = new Map(store.types.map((t) => [t.id, t]));
    if (store.warnings.length && window.console) console.warn('[AIClub data]', store.warnings);
    return store;
  }

  async function refresh() {
    let raw;
    try {
      raw = await sources['apps-script'].fetch();
    } catch (e) {
      if (e && e.code === 'auth' && data.onAuthLost) data.onAuthLost();
      return; // offline or a hiccup: keep showing the remembered copy
    }
    const changed = JSON.stringify(raw) !== JSON.stringify(readCache());
    writeCache(raw);
    if (changed) {
      apply(raw);
      if (data.onUpdate) data.onUpdate();
    }
  }

  async function load() {
    const name = A.config.dataSource || 'local';
    const source = sources[name];
    if (!source) throw new Error('Unknown dataSource "' + name + '"');
    if (name === 'apps-script') {
      const cached = readCache();
      if (cached) {
        apply(cached);
        refresh();
        return store;
      }
    }
    const raw = await source.fetch();
    if (name === 'apps-script') writeCache(raw);
    return apply(raw);
  }

  /** Forget the content (sign-out): memory and this device. */
  function reset() {
    store = null;
    try { localStorage.removeItem(CACHE_KEY); } catch (e) { /* ignore */ }
  }

  const data = {
    load,
    reset,
    onUpdate: null,   // set by app.js: re-draw the page when fresh content arrives
    onAuthLost: null, // set by app.js: the member was removed / everyone logged out
    get loaded() { return !!store; },
    get warnings() { return store ? store.warnings.slice() : []; },

    types: () => store.types.slice(),
    typeLabel: (id) => (typeById.get(id) || {}).label || '',
    typeSingular: (id) => (typeById.get(id) || {}).singular || '',
    typeIcon: (id) => (typeById.get(id) || {}).icon || '',
    section: (id) => SECTIONS[id] || null,

    departments: () => store.departments.slice(),
    department: (id) => deptById.get(id) || null,
    resource: (id) => byId.get(id) || null,
    all: () => store.resources.slice(),

    /** A department's own categories / archive sections */
    categories: (deptId) => ((deptById.get(deptId) || {}).categories || []).slice(),
    archives: (deptId) => ((deptById.get(deptId) || {}).archives || []).slice(),
    archive: (deptId, archiveId) => ((deptById.get(deptId) || {}).archives || []).find((a) => a.id === archiveId) || null,
    categoryLabel(r) {
      if (!r.category) return '';
      const c = this.categories(r.departmentId).find((x) => x.id === r.category);
      return c ? c.label : '';
    },
    archiveLabel(r) {
      return r.archive ? (this.archive(r.departmentId, r.archive) || {}).title || '' : '';
    },

    /** Active (non-archive) resources of a department */
    departmentResources: (deptId) => store.resources.filter((r) => r.departmentId === deptId && !r.archive),
    /** All archive works of a department (every archive section) */
    archiveResources: (deptId) => store.resources.filter((r) => r.departmentId === deptId && r.archive),
    shared: () => store.resources.filter((r) => r.section === 'shared'),
    systems: () => store.resources.filter((r) => r.section === 'system'),

    /** Newest resources (archive works and system links excluded) */
    latest(n) {
      const list = store.resources.filter((r) => !r.archive && r.section !== 'system' && r.createdAt);
      return sortResources(list, 'newest').slice(0, n || 5);
    },

    sorts: () => SORTS.slice(),
    isSort: (id) => SORTS.some((s) => s.id === id),
    sort: sortResources,

    /** Human label for where a resource lives, e.g. "العلاقات العامة" or "الموارد المشتركة" */
    locationLabel(r) {
      if (r.section === 'department') {
        const d = deptById.get(r.departmentId);
        return d ? d.name : '';
      }
      return (SECTIONS[r.section] || {}).label || '';
    },

    /** The route of the list a resource belongs to (for breadcrumbs / back) */
    parentRoute(r) {
      if (r.section === 'department') {
        return '#/departments/' + encodeURIComponent(r.departmentId) + (r.archive ? '/archive' : '');
      }
      return (SECTIONS[r.section] || SECTIONS.department).route;
    },

    /** Is there something real to open, download, copy or view? */
    isAvailable(r) {
      if (r.action === 'text') return !!r.text;
      if (r.action === 'external' || r.action === 'open') return !!r.url;
      return r.files.length > 0;
    },

    post,

    /** A member's note on a resource → sheet "الملاحظات" (the server adds the member's name). */
    sendFeedback: (resourceId, text) => post('feedback', { resourceId, text }),

    // exposed for future admin tooling
    _normalize: normalize
  };

  A.data = data;
})(window.AIClub);
