/* View: search results with type / department filters (sidebar on desktop, bottom sheet on mobile) */
(function (A) {
  'use strict';

  const { esc } = A.utils;
  const icon = A.icon;
  A.views = A.views || {};

  function scopeOptions() {
    return [{ id: '', label: 'الكل' }]
      .concat(A.data.departments().map((d) => ({ id: d.id, label: d.name })))
      .concat([{ id: '__shared', label: 'الموارد المشتركة' }, { id: '__systems', label: 'أنظمة النادي' }]);
  }

  function sortOptions() {
    return [{ id: '', label: 'الأنسب' }].concat(A.data.sorts());
  }

  function filtersHtml(state, idPrefix, withApply) {
    const types = [{ id: '', label: 'الكل' }].concat(A.data.types());
    return '<div class="filters" data-filters>' +
      '<div><p class="filters__group-title" id="' + idPrefix + 'TypeLbl">نوع المورد</p>' +
        '<div class="chips" role="group" aria-labelledby="' + idPrefix + 'TypeLbl">' +
          types.map((t) => '<button type="button" class="chip" data-filter-type="' + esc(t.id) + '" aria-pressed="' + (t.id === state.type) + '">' + esc(t.label) + '</button>').join('') +
        '</div></div>' +
      '<div class="field"><label class="filters__group-title" for="' + idPrefix + 'Dept" style="margin:0">القسم</label>' +
        '<select class="select" id="' + idPrefix + 'Dept" data-filter-dept>' +
          scopeOptions().map((o) => '<option value="' + esc(o.id) + '"' + (o.id === state.dept ? ' selected' : '') + '>' + esc(o.label) + '</option>').join('') +
        '</select></div>' +
      '<div class="field"><label class="filters__group-title" for="' + idPrefix + 'Sort" style="margin:0">الترتيب</label>' +
        '<select class="select" id="' + idPrefix + 'Sort" data-filter-sort>' +
          sortOptions().map((o) => '<option value="' + esc(o.id) + '"' + (o.id === state.sort ? ' selected' : '') + '>' + esc(o.label) + '</option>').join('') +
        '</select></div>' +
      '<div class="filters__actions">' +
        '<button type="button" class="btn btn--outline" data-filter-clear>مسح الفلاتر</button>' +
        (withApply ? '<button type="button" class="btn btn--primary btn--block" data-filter-apply>عرض النتائج</button>' : '') +
      '</div>' +
    '</div>';
  }

  function syncFilters(root, state) {
    root.querySelectorAll('[data-filter-type]').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.filterType === state.type)));
    const sel = root.querySelector('[data-filter-dept]');
    if (sel) sel.value = state.dept;
    const sort = root.querySelector('[data-filter-sort]');
    if (sort) sort.value = state.sort;
    // Nothing to clear → the clear button is shown disabled instead of doing nothing
    const clear = root.querySelector('[data-filter-clear]');
    if (clear) clear.disabled = !state.type && !state.dept;
  }

  A.views.search = function (ctx) {
    A.ui.renderShell({ authed: true, nav: '' });

    const validTypes = A.data.types().map((t) => t.id);
    const validScopes = scopeOptions().map((o) => o.id);
    const state = {
      q: (ctx.query.q || '').slice(0, 120),
      type: validTypes.includes(ctx.query.type) ? ctx.query.type : '',
      dept: validScopes.includes(ctx.query.dept) ? ctx.query.dept : '',
      sort: A.data.isSort(ctx.query.sort) ? ctx.query.sort : ''
    };
    const activeCount = () => (state.type ? 1 : 0) + (state.dept ? 1 : 0);

    const html =
      A.ui.crumbs({ fallback: '#/' }) +
      '<h1 style="font-size:var(--fs-xl);margin-bottom:16px">نتائج البحث</h1>' +
      '<form class="search-form search-form--inline" id="searchForm" role="search" style="margin-bottom:12px">' +
        '<label class="visually-hidden" for="searchQ">كلمة البحث</label>' +
        '<input class="input" id="searchQ" type="search" autocomplete="off" placeholder="ابحث عن قالب، دليل، نظام..." value="' + esc(state.q) + '">' +
        '<button class="btn btn--primary" type="submit">بحث</button>' +
      '</form>' +
      '<button type="button" class="btn btn--outline btn--block filter-toggle" id="filterToggle" aria-haspopup="dialog">' +
        icon('filter') + '<span>تصفية (<span id="filterCount">' + activeCount() + '</span>)</span></button>' +
      '<div class="search-layout" style="margin-top:24px">' +
        '<aside class="search-aside" aria-label="تصفية نتائج البحث">' +
          '<h2 class="section__title" style="margin-bottom:12px">تصفية نتائج البحث</h2>' +
          filtersHtml(state, 'aside', false) +
        '</aside>' +
        '<section aria-labelledby="resultsTitle">' +
          '<div class="section__head"><h2 class="section__title" id="resultsTitle">الموارد المطابقة</h2>' +
            '<span class="section__meta" id="resultsCount" aria-live="polite"></span></div>' +
          '<div id="results"></div>' +
        '</section>' +
      '</div>';

    const view = A.ui.mount(html, 'نتائج البحث', { noFocus: true });
    const input = view.querySelector('#searchQ');
    const aside = view.querySelector('.search-aside');

    function updateUrl() {
      const p = new URLSearchParams();
      if (state.q) p.set('q', state.q);
      if (state.type) p.set('type', state.type);
      if (state.dept) p.set('dept', state.dept);
      if (state.sort) p.set('sort', state.sort);
      const qs = p.toString();
      A.router.setQuietly('#/search' + (qs ? '?' + qs : ''));
    }

    function render() {
      // Never touch the URL or DOM once the user has left this view
      if (!view.isConnected || (A.router.current && A.router.current.name !== 'search')) return;
      const list = A.search.run(state);
      view.querySelector('#resultsCount').textContent = A.utils.counts.results(list.length);
      view.querySelector('#filterCount').textContent = String(activeCount());
      view.querySelector('#results').innerHTML = list.length
        ? '<div class="grid">' + list.map(A.ui.resourceCard).join('') + '</div>'
        : A.ui.emptyState({
            icon: 'search',
            title: 'لا توجد نتائج',
            text: 'جرّب كلمة مختلفة أو امسح الفلاتر.',
            actions: activeCount() ? '<button type="button" class="btn btn--outline" data-filter-clear>مسح الفلاتر</button>' : ''
          });
      syncFilters(aside, state);
      updateUrl();
    }

    // Search box: submit, plus light live search while typing.
    // The pending timer is cancelled when the view is left (otherwise it would rewrite
    // the next page's URL with a stale #/search hash).
    let timer = null;
    A.ui.onLeave(() => { clearTimeout(timer); timer = null; });
    view.querySelector('#searchForm').addEventListener('submit', (e) => {
      e.preventDefault();
      clearTimeout(timer);
      state.q = input.value.trim().slice(0, 120);
      render();
      // Close the on-screen keyboard on phones so the results are visible
      if (window.matchMedia && window.matchMedia('(max-width: 899px)').matches) input.blur();
    });
    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => { state.q = input.value.trim().slice(0, 120); render(); }, 250);
    });

    // Desktop sidebar + empty-state "clear": apply immediately
    view.addEventListener('click', (e) => {
      const chip = e.target.closest('[data-filter-type]');
      if (chip && aside.contains(chip)) { state.type = chip.dataset.filterType; render(); }
      if (e.target.closest('[data-filter-clear]')) { state.type = ''; state.dept = ''; render(); }
    });
    aside.querySelector('[data-filter-dept]').addEventListener('change', (e) => { state.dept = e.target.value; render(); });
    aside.querySelector('[data-filter-sort]').addEventListener('change', (e) => { state.sort = e.target.value; render(); });

    // Mobile bottom sheet: edit a draft, apply on "عرض النتائج"
    const toggle = view.querySelector('#filterToggle');
    toggle.addEventListener('click', () => {
      const draft = { type: state.type, dept: state.dept, sort: state.sort };
      A.ui.openSheet({
        title: 'تصفية نتائج البحث',
        body: filtersHtml(draft, 'sheet', true),
        returnFocus: toggle,
        onOpen(sheet) {
          sheet.addEventListener('click', (e) => {
            const chip = e.target.closest('[data-filter-type]');
            if (chip) { draft.type = chip.dataset.filterType; syncFilters(sheet, draft); }
            if (e.target.closest('[data-filter-clear]')) { draft.type = ''; draft.dept = ''; syncFilters(sheet, draft); }
            if (e.target.closest('[data-filter-apply]')) {
              state.type = draft.type;
              state.dept = draft.dept;
              state.sort = draft.sort;
              A.ui.closeSheet();
              render();
            }
          });
          sheet.querySelector('[data-filter-dept]').addEventListener('change', (e) => { draft.dept = e.target.value; syncFilters(sheet, draft); });
          sheet.querySelector('[data-filter-sort]').addEventListener('change', (e) => { draft.sort = e.target.value; syncFilters(sheet, draft); });
          syncFilters(sheet, draft);
        }
      });
    });

    render();
    if (!state.q) input.focus();
    else { const h = view.querySelector('h1'); h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  };
})(window.AIClub);
