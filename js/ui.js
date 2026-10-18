/* Shared UI: shell (header / navs / footer) and HTML component builders */
(function (A) {
  'use strict';

  const { esc, $ } = A.utils;
  const icon = A.icon;

  const NAV = [
    { id: 'home', label: 'الرئيسية', icon: 'home', href: '#/' },
    { id: 'departments', label: 'الأقسام', icon: 'grid', href: '#/departments' },
    { id: 'shared', label: 'الموارد', icon: 'folder', href: '#/shared' },
    { id: 'systems', label: 'الأنظمة', icon: 'systems', href: '#/systems' }
  ];

  /* ---------- Shell ---------- */
  function renderShell(opts) {
    const authed = !!opts.authed;
    const active = opts.nav || '';
    document.body.classList.toggle('is-auth', !authed);
    document.body.classList.remove('is-loading');

    $('#topbarActions').innerHTML = authed
      ? '<a class="btn-sm btn-sm--accent" href="#/search">' + icon('search') + '<span>بحث</span></a>' +
        '<button type="button" class="btn-sm" data-action="logout">' + icon('logout') + '<span>خروج</span></button>'
      : '';

    const links = (cls) => NAV.map((n) =>
      '<li><a class="' + cls + '" href="' + n.href + '"' + (n.id === active ? ' aria-current="page"' : '') + '>' +
      icon(n.icon) + '<span>' + n.label + '</span></a></li>'
    ).join('');

    $('#desktopNav').innerHTML = authed ? '<div class="container"><ul class="desktop-nav__list">' + links('desktop-nav__link') + '</ul></div>' : '';
    $('#bottomNav').innerHTML = authed ? '<ul class="bottom-nav__list">' + links('bottom-nav__link') + '</ul>' : '';

    $('#siteFooter').innerHTML =
      '<div class="site-footer__inner">' +
        '<span class="site-footer__tag">#نقود_المستقبل</span> · ' + esc(A.config.clubName) + ' — <span class="latin">FCIT</span>' +
      '</div>';
  }

  /**
   * Place a view into <main>, set the page title and move focus for screen readers.
   * Returns a fresh wrapper element, so listeners attached to it die with the view.
   */
  let leaveHandlers = [];

  /** Register cleanup for the current view (timers, listeners on document, …). Runs before the next view mounts. */
  function onLeave(fn) {
    if (typeof fn === 'function') leaveHandlers.push(fn);
  }

  function runLeaveHandlers() {
    const handlers = leaveHandlers;
    leaveHandlers = [];
    handlers.forEach((fn) => { try { fn(); } catch (e) { if (window.console) console.error('[AIClub] view cleanup failed', e); } });
  }

  let quietOnce = false; // set by redraw(): keep scroll position and focus

  /** Re-draw the current route in place (fresh content), without jumping to the top. */
  function redraw(hash) {
    quietOnce = true;
    A.router.replace(hash);
  }

  function mount(html, title, opts) {
    if (quietOnce) { opts = Object.assign({}, opts, { keepScroll: true, noFocus: true }); quietOnce = false; }
    runLeaveHandlers();
    closeSheet(true);
    const main = $('#main');
    const view = document.createElement('div');
    view.className = 'view';
    view.innerHTML = html;
    main.replaceChildren(view);
    document.title = (title ? title + ' · ' : '') + A.config.appName;
    if (!(opts && opts.keepScroll)) window.scrollTo(0, 0);
    if (!(opts && opts.noFocus)) {
      const h = view.querySelector('h1');
      if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
    }
    return view;
  }

  /* ---------- Components ---------- */
  function pixels() {
    return '<span class="pixels" aria-hidden="true"><i></i><i></i><i></i></span>';
  }

  function hero(o) {
    return '<section class="hero' + (o.cls ? ' ' + o.cls : '') + '">' +
      '<div class="hero__top"><span class="eyebrow">' + esc(o.eyebrow) + '</span>' + pixels() + '</div>' +
      '<h1 class="hero__title">' + esc(o.title) + '</h1>' +
      (o.lead ? '<p class="hero__lead">' + esc(o.lead) + '</p>' : '') +
      (o.extra || '') +
      '</section>';
  }

  function sectionHead(title, meta, tag) {
    const t = tag || 'h2';
    return '<div class="section__head">' +
      (title ? '<' + t + ' class="section__title">' + esc(title) + '</' + t + '>' : '') +
      (meta ? '<span class="section__meta">' + esc(meta) + '</span>' : '') + '</div>';
  }

  function tile(o) {
    return '<a class="tile' + (o.cls ? ' ' + o.cls : '') + '" href="' + esc(o.href) + '">' +
      '<span class="icon-tile">' + icon(o.icon) + '</span>' +
      '<span class="tile__title">' + esc(o.title) + '</span>' +
      (o.desc ? '<span class="tile__desc">' + o.desc + '</span>' : '') +
      '</a>';
  }

  function resourceIcon(r) {
    return r.icon || A.data.typeIcon(r.type) || 'file-text';
  }

  function resourceMeta(r) {
    return [A.data.locationLabel(r), A.data.categoryLabel(r) || A.data.typeLabel(r.type), r.format]
      .filter(Boolean).map(esc).join(' · ');
  }

  function dateLine(r) {
    if (!r.createdAt) return '';
    return '<span class="res-card__date">' + icon('clock') + esc(A.utils.formatDate(r.createdAt)) + '</span>';
  }

  function resourceCard(r) {
    return '<a class="res-card" href="#/resource/' + encodeURIComponent(r.id) + '">' +
      '<span class="icon-tile">' + icon(resourceIcon(r)) + '</span>' +
      '<span class="res-card__body">' +
        '<span class="res-card__title">' + esc(r.title) +
          (A.data.isAvailable(r) ? '' : '<span class="badge badge--muted">غير متوفر</span>') + '</span>' +
        '<span class="res-card__meta">' + resourceMeta(r) + '</span>' +
        dateLine(r) +
      '</span>' +
      '<span class="res-card__chev" aria-hidden="true">' + icon('chevron-left') + '</span>' +
      '</a>';
  }

  function resourceList(list, emptyHtml) {
    if (!list.length) return emptyHtml || emptyState({ title: 'لا توجد موارد', text: 'لا توجد موارد في هذا القسم حتى الآن.' });
    return '<div class="grid grid--sm-2">' + list.map(resourceCard).join('') + '</div>';
  }

  /** Back button + optional breadcrumb trail [{label, href?}] */
  function crumbs(o) {
    const trail = o.trail || [];
    return '<div class="crumbs-row">' +
      '<button type="button" class="back-btn" data-action="back" data-fallback="' + esc(o.fallback || '#/') + '">' +
        icon('arrow-right') + '<span>رجوع</span></button>' +
      (trail.length
        ? '<nav class="breadcrumb" aria-label="مسار التنقل"><ol>' + trail.map((c, i) =>
            '<li>' + (c.href && i < trail.length - 1
              ? '<a href="' + esc(c.href) + '">' + esc(c.label) + '</a>'
              : '<span' + (i === trail.length - 1 ? ' aria-current="page"' : '') + '>' + esc(c.label) + '</span>') + '</li>'
          ).join('') + '</ol></nav>'
        : '') +
      '</div>';
  }

  /**
   * Compact dropdown filters shown side by side (category / archive section / sort).
   * fields: [{ id, label, value, options: [{id, label}] }]
   * Native <select>: phones open their own picker, so it stays tidy with any number of options.
   */
  function selectFilters(fields) {
    return '<div class="select-row">' + fields.map((f) =>
      '<div class="select-field">' +
        '<label class="select-field__label" for="' + esc(f.id) + '">' + esc(f.label) + '</label>' +
        '<select class="select select--compact" id="' + esc(f.id) + '" data-select="' + esc(f.key || f.id) + '">' +
          f.options.map((o) => '<option value="' + esc(o.id) + '"' + (o.id === f.value ? ' selected' : '') + '>' + esc(o.label) + '</option>').join('') +
        '</select>' +
      '</div>'
    ).join('') + '</div>';
  }

  function emptyState(o) {
    return '<div class="empty" role="status">' + icon(o.icon || 'folder') +
      (o.title ? '<p class="empty__title">' + esc(o.title) + '</p>' : '') +
      (o.text ? '<p>' + esc(o.text) + '</p>' : '') +
      (o.actions ? '<div class="empty__actions">' + o.actions + '</div>' : '') +
      '</div>';
  }

  function notice(text, variant) {
    return '<div class="notice' + (variant ? ' notice--' + variant : '') + '">' + icon(variant === 'warning' ? 'alert' : 'info') +
      '<p>' + text + '</p></div>';
  }

  /* ---------- Live search suggestions ---------- */
  /**
   * Turns a search input into a combobox that suggests matching resources while typing.
   * Choosing a suggestion opens it; submitting the form still goes to the full results.
   */
  let suggestSeq = 0;
  function attachSuggest(input, onSubmitAll) {
    const listId = 'suggest-' + (++suggestSeq);
    const list = document.createElement('ul');
    list.className = 'suggest__list';
    list.id = listId;
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', 'اقتراحات البحث');
    list.hidden = true;
    input.parentNode.appendChild(list);

    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('aria-controls', listId);

    let items = [];
    let active = -1;
    let timer = null;

    function close() {
      list.hidden = true;
      list.innerHTML = '';
      items = [];
      active = -1;
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
    }

    function setActive(i) {
      active = i;
      items.forEach((el, n) => el.setAttribute('aria-selected', String(n === i)));
      if (i >= 0) input.setAttribute('aria-activedescendant', items[i].id);
      else input.removeAttribute('aria-activedescendant');
    }

    function render() {
      const q = input.value.trim();
      const found = A.search.suggest(q, 5);
      if (!q) { close(); return; }
      list.innerHTML =
        found.map((r, i) =>
          '<li class="suggest__item" role="option" id="' + listId + '-' + i + '" data-href="#/resource/' + encodeURIComponent(r.id) + '" aria-selected="false">' +
            '<span class="suggest__icon">' + icon(resourceIcon(r)) + '</span>' +
            '<span class="suggest__text"><span class="suggest__title">' + esc(r.title) + '</span>' +
            '<span class="suggest__meta">' + esc(A.data.locationLabel(r)) + '</span></span>' +
          '</li>').join('') +
        '<li class="suggest__item suggest__all" role="option" id="' + listId + '-all" data-all aria-selected="false">' +
          icon('search') + '<span>' + (found.length ? 'عرض كل النتائج لـ «' + esc(q) + '»' : 'لا توجد نتائج مطابقة لـ «' + esc(q) + '»') + '</span>' +
        '</li>';
      items = Array.from(list.querySelectorAll('.suggest__item'));
      active = -1;
      list.hidden = false;
      input.setAttribute('aria-expanded', 'true');
    }

    function choose(el) {
      const href = el.dataset.href;
      close();
      if (href) A.router.go(href);
      else onSubmitAll();
    }

    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(render, 120);
    });
    input.addEventListener('keydown', (e) => {
      if (list.hidden || !items.length) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive((active + 1) % items.length); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active <= 0 ? items.length - 1 : active - 1); }
      else if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); choose(items[active]); }
    });
    // mousedown (not click) so the choice lands before the input loses focus
    list.addEventListener('mousedown', (e) => {
      const el = e.target.closest('.suggest__item');
      if (!el) return;
      e.preventDefault();
      choose(el);
    });
    input.addEventListener('blur', () => setTimeout(close, 100));
    onLeave(() => clearTimeout(timer));

    return { close };
  }

  /* ---------- Toast ---------- */
  let toastTimer = null;
  function toast(message) {
    const el = $('#toast');
    el.textContent = message;
    el.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-visible'), 2600);
  }

  /* ---------- Clipboard ---------- */
  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        // Some browsers leave the promise pending (e.g. unanswered permission) — don't wait forever
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('clipboard timeout')), 1500));
        await Promise.race([navigator.clipboard.writeText(text), timeout]);
        return true;
      }
    } catch (e) { /* fall through to the legacy method */ }
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    return ok;
  }

  /* ---------- Bottom sheet ---------- */
  let sheetState = null;

  function openSheet(o) {
    closeSheet(true);
    const root = $('#overlayRoot');
    const titleId = 'sheet-title';
    root.innerHTML =
      '<div class="sheet-backdrop" data-sheet-close></div>' +
      '<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="' + titleId + '">' +
        '<div class="sheet__head"><h2 class="sheet__title" id="' + titleId + '">' + esc(o.title) + '</h2>' +
        '<button type="button" class="icon-btn" data-sheet-close aria-label="إغلاق">' + icon('x') + '</button></div>' +
        '<div class="sheet__body">' + o.body + '</div>' +
      '</div>';
    const sheet = root.querySelector('.sheet');
    const backdrop = root.querySelector('.sheet-backdrop');
    document.body.classList.add('has-sheet');
    // Hide the rest of the app from assistive tech while the dialog is open
    document.querySelector('.app-shell').setAttribute('inert', '');
    document.querySelector('#bottomNav').setAttribute('inert', '');

    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); closeSheet(); }
      if (e.key === 'Tab') {
        const f = Array.from(sheet.querySelectorAll('button, [href], input, select, [tabindex]:not([tabindex="-1"])')).filter((x) => !x.disabled);
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    const onClick = (e) => { if (e.target.closest('[data-sheet-close]')) closeSheet(); };
    document.addEventListener('keydown', onKey);
    root.addEventListener('click', onClick);

    sheetState = { root, onKey, onClick, returnFocus: o.returnFocus || document.activeElement, onClose: o.onClose };
    requestAnimationFrame(() => {
      sheet.classList.add('is-open');
      backdrop.classList.add('is-open');
      const first = sheet.querySelector('[data-autofocus]') || sheet.querySelector('button, input, select');
      if (first) first.focus();
    });
    if (o.onOpen) o.onOpen(sheet);
    return sheet;
  }

  function closeSheet(silent) {
    if (!sheetState) return;
    const s = sheetState;
    sheetState = null;
    document.removeEventListener('keydown', s.onKey);
    s.root.removeEventListener('click', s.onClick);
    s.root.innerHTML = '';
    document.body.classList.remove('has-sheet');
    document.querySelector('.app-shell').removeAttribute('inert');
    document.querySelector('#bottomNav').removeAttribute('inert');
    if (!silent) {
      if (s.onClose) s.onClose();
      if (s.returnFocus && document.contains(s.returnFocus)) s.returnFocus.focus();
    }
  }

  function loading(text) {
    return '<div class="loading" role="status"><span class="spinner" aria-hidden="true"></span><span>' + esc(text || 'جارٍ التحميل…') + '</span></div>';
  }

  A.ui = {
    renderShell, mount, redraw, onLeave, pixels, hero, sectionHead, tile, resourceCard, resourceList, resourceIcon,
    resourceMeta, crumbs, selectFilters, emptyState, notice, attachSuggest, toast, copyText, openSheet, closeSheet, loading
  };
})(window.AIClub);
