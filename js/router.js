/* Minimal hash router: #/path/:param?query */
(function (A) {
  'use strict';

  const routes = [];
  let notFound = null;
  let guard = null;
  let current = null;        // { path, query, hash, params, name } of the rendered route
  let index = 0;             // position of the current entry in this app's history
  let pendingReplace = null; // hash we asked location.replace() to load

  const STATE_KEY = 'aiclubIdx';

  function compile(pattern) {
    const names = [];
    const re = pattern
      .replace(/\/:([a-zA-Z]+)/g, (_, n) => { names.push(n); return '/([^/]+)'; })
      .replace(/\//g, '\\/');
    return { re: new RegExp('^' + re + '\\/?$'), names };
  }

  function parse(hash) {
    let h = (hash || '').replace(/^#/, '');
    if (!h.startsWith('/')) h = '/' + h;
    const qi = h.indexOf('?');
    const path = qi >= 0 ? h.slice(0, qi) : h;
    const query = {};
    if (qi >= 0) {
      new URLSearchParams(h.slice(qi + 1)).forEach((v, k) => { query[k] = v; });
    }
    return { path: path === '' ? '/' : path, query };
  }

  function match(path) {
    for (const r of routes) {
      const m = r.re.exec(path);
      if (m) {
        const params = {};
        r.names.forEach((n, i) => {
          try { params[n] = decodeURIComponent(m[i + 1]); } catch (e) { params[n] = m[i + 1]; }
        });
        return { route: r, params };
      }
    }
    return null;
  }

  /* ---------- History index (lets "رجوع" know whether there is an in-app page to return to) ---------- */
  function readIndex() {
    const s = history.state;
    return s && typeof s[STATE_KEY] === 'number' ? s[STATE_KEY] : null;
  }

  function stampIndex(i) {
    index = i;
    try {
      history.replaceState(Object.assign({}, history.state || {}, { [STATE_KEY]: i }), '');
    } catch (e) { /* some file:// contexts disallow replaceState — back() then uses the fallback */ }
  }

  function onHashChange() {
    const known = readIndex();
    const hash = location.hash || '#/';
    if (known !== null) {
      index = known; // back / forward to an entry we already stamped
    } else if (pendingReplace !== null && hash === pendingReplace) {
      stampIndex(index); // location.replace(): same position, new entry
    } else {
      stampIndex(index + 1); // a new navigation
    }
    pendingReplace = null;
    resolve();
  }

  function resolve() {
    const hash = location.hash;
    // Ignore hashes that are not app routes (e.g. in-page anchors)
    if (hash && !hash.startsWith('#/')) return;
    const { path, query } = parse(hash || '#/');
    const ctx = { path, query, hash: hash || '#/', params: {}, name: '' };
    if (guard) {
      const redirect = guard(ctx);
      if (redirect && redirect !== ctx.hash) { replace(redirect); return; }
    }
    const m = match(path);
    if (m) {
      ctx.params = m.params;
      ctx.name = m.route.name;
    } else {
      ctx.name = 'not-found';
    }
    current = ctx;
    if (m) m.route.handler(ctx);
    else if (notFound) notFound(ctx);
  }

  function replace(hash) {
    if (location.hash === hash) { resolve(); return; }
    pendingReplace = hash;
    location.replace(location.href.split('#')[0] + hash);
  }

  A.router = {
    add(name, pattern, handler) {
      routes.push(Object.assign({ name, handler }, compile(pattern)));
      return this;
    },
    otherwise(handler) { notFound = handler; return this; },
    setGuard(fn) { guard = fn; return this; },

    start() {
      const known = readIndex();
      if (known === null) stampIndex(0);
      else index = known; // page reload keeps its position
      window.addEventListener('hashchange', onHashChange);
      resolve();
    },

    go(hash) {
      if (location.hash === hash) resolve();
      else location.hash = hash;
    },

    replace,

    /**
     * Update the URL of the current route without re-rendering (live filters).
     * Keeps `current` in sync with the URL; a different path falls back to a normal resolve.
     */
    setQuietly(hash) {
      const next = parse(hash);
      try {
        history.replaceState(history.state, '', hash);
      } catch (e) {
        return; // URL could not be changed — leave state untouched so both stay consistent
      }
      if (current && next.path === current.path) {
        current.hash = hash;
        current.query = next.query;
      } else {
        resolve();
      }
    },

    /** Go back inside the app if possible, otherwise to a sensible parent route. */
    back(fallback) {
      if (index > 0) history.back();
      else replace(fallback || '#/');
    },

    get current() { return current; },
    get historyIndex() { return index; },
    parse
  };
})(window.AIClub);
