/* Views: departments list, department page (resources / archive tabs) */
(function (A) {
  'use strict';

  const { esc } = A.utils;
  const icon = A.icon;
  A.views = A.views || {};

  function deptHref(id, suffix) {
    return '#/departments/' + encodeURIComponent(id) + (suffix || '');
  }

  /* ---------- أقسام النادي ---------- */
  A.views.departments = function () {
    A.ui.renderShell({ authed: true, nav: 'departments' });
    const d = A.data;
    const list = d.departments();

    const html =
      A.ui.crumbs({ fallback: '#/' }) +
      A.ui.hero({ eyebrow: 'AI CLUB · DEPARTMENTS', title: 'أقسام النادي', lead: 'اختر قسمك للوصول إلى موارده وأرشيفه.' }) +
      '<section class="section">' +
        A.ui.sectionHead('', A.utils.counts.departments(list.length)) +
        (list.length
          ? '<div class="grid grid--sm-2 grid--md-3">' + list.map((dep) => A.ui.tile({
              href: deptHref(dep.id),
              icon: dep.icon,
              title: dep.name,
              desc: '<span class="dept-card__count">' + esc(A.utils.counts.resources(d.departmentResources(dep.id).length)) + '</span>'
            })).join('') + '</div>'
          : A.ui.emptyState({ title: 'لا توجد أقسام', text: 'لم تُضف أقسام إلى المنصة بعد.' })) +
      '</section>';

    A.ui.mount(html, 'أقسام النادي');
  };

  /* ---------- Archive work card (thumbnail + owner + year) ---------- */
  function workCard(r) {
    const d = A.data;
    // Images show as they are; other Drive files (PDFs, videos…) get Google's own thumbnail
    const drive = r.files.find((f) => A.utils.driveId(f.url));
    const img = r.files.find((f) => f.isImage) || (drive ? { url: drive.url, preview: '' } : null);
    const thumb = img
      ? '<span class="work-card__thumb' + (img.preview === 'light' ? ' work-card__thumb--light' : '') + '">' +
          '<img src="' + esc(A.utils.imageSrc(img.url, 640)) + '" alt="" loading="lazy"></span>'
      : '<span class="work-card__thumb work-card__thumb--icon">' + icon(A.ui.resourceIcon(r)) + '</span>';
    return '<a class="work-card" href="#/resource/' + encodeURIComponent(r.id) + '">' +
      thumb +
      '<span class="work-card__body">' +
        '<span class="work-card__section">' + esc(d.archiveLabel(r)) + '</span>' +
        '<span class="work-card__title">' + esc(r.title) + '</span>' +
        (r.owner ? '<span class="work-card__meta">' + icon('users') + esc(r.owner) + '</span>' : '') +
        (r.year ? '<span class="work-card__meta">' + icon('calendar') + '<bdi dir="ltr">' + esc(r.year) + '</bdi></span>' : '') +
      '</span>' +
    '</a>';
  }

  /* ---------- صفحة القسم ---------- */
  A.views.department = function (ctx) {
    const d = A.data;
    const dep = d.department(ctx.params.id);
    if (!dep) return A.views.notFound(ctx, { text: 'هذا القسم غير موجود أو أُزيل من المنصة.', href: '#/departments', label: 'أقسام النادي' });

    A.ui.renderShell({ authed: true, nav: 'departments' });
    const isArchive = ctx.name === 'department-archive';
    const base = deptHref(dep.id, isArchive ? '/archive' : '');

    // Filter options: the department's categories, or its archive sections
    const groups = isArchive
      ? d.archives(dep.id).map((a) => ({ id: a.id, label: a.title }))
      : d.categories(dep.id);
    const groupKey = isArchive ? 'section' : 'category';
    const state = {
      group: groups.some((g) => g.id === ctx.query[groupKey]) ? ctx.query[groupKey] : '',
      sort: d.isSort(ctx.query.sort) ? ctx.query.sort : 'newest'
    };

    const tabsHtml =
      '<div class="tabs" role="tablist" aria-label="محتوى القسم">' +
        '<a class="tabs__tab" role="tab" href="' + deptHref(dep.id) + '" aria-selected="' + !isArchive + '">الموارد</a>' +
        '<a class="tabs__tab" role="tab" href="' + deptHref(dep.id, '/archive') + '" aria-selected="' + isArchive + '">الأرشيف</a>' +
      '</div>';

    const filters = [];
    // A filter with a single choice is pointless — show it only from two categories up
    if (groups.length > 1) {
      filters.push({ id: 'fGroup', key: 'group', label: 'التصنيف', value: state.group,
        options: [{ id: '', label: 'الكل' }].concat(groups) });
    }
    filters.push({ id: 'fSort', key: 'sort', label: 'الترتيب', value: state.sort, options: d.sorts() });

    const trail = [{ label: 'أقسام النادي', href: '#/departments' }];
    trail.push(isArchive ? { label: dep.name, href: deptHref(dep.id) } : { label: dep.name });
    if (isArchive) trail.push({ label: 'الأرشيف' });

    const html =
      A.ui.crumbs({ fallback: isArchive ? deptHref(dep.id) : '#/departments', trail }) +
      A.ui.hero({ eyebrow: 'AI CLUB · DEPARTMENT', title: dep.name, lead: dep.description || 'الموارد والأرشيف الخاص بالقسم.' }) +
      tabsHtml +
      (isArchive ? '<p class="archive-note">' + icon('eye') + 'أعمال سابقة للاطلاع والاستفادة منها، متاحة للمشاهدة فقط.</p>' : '') +
      A.ui.selectFilters(filters) +
      '<section class="section" aria-labelledby="listTitle">' +
        '<div class="section__head"><h2 class="section__title" id="listTitle">' + (isArchive ? 'الأعمال السابقة' : 'الموارد') + '</h2>' +
          '<span class="section__meta" id="listCount"></span></div>' +
        '<div id="list"></div>' +
      '</section>';

    const view = A.ui.mount(html, isArchive ? 'أرشيف ' + dep.name : dep.name);
    const all = isArchive ? d.archiveResources(dep.id) : d.departmentResources(dep.id);
    const labelOf = (id) => (groups.find((g) => g.id === id) || {}).label || '';

    function render() {
      const filtered = state.group ? all.filter((r) => (isArchive ? r.archive : r.category) === state.group) : all;
      const list = d.sort(filtered, state.sort);
      view.querySelector('#listCount').textContent = isArchive ? A.utils.counts.works(list.length) : A.utils.counts.resources(list.length);
      const empty = A.ui.emptyState({
        icon: isArchive ? 'archive' : 'folder',
        title: state.group
          ? (isArchive ? 'لا توجد أعمال في «' : 'لا توجد موارد في «') + labelOf(state.group) + '» بعد'
          : (isArchive ? 'لا توجد أعمال في الأرشيف بعد' : 'لا توجد موارد في هذا القسم بعد'),
        text: state.group ? 'اختر تصنيفًا آخر أو اعرض الكل.' : (isArchive ? 'ستظهر الأعمال السابقة هنا عند إضافتها.' : 'ستظهر موارد القسم هنا عند إضافتها.'),
        actions: state.group ? '<button type="button" class="btn btn--outline" data-group-reset>عرض الكل</button>' : ''
      });
      view.querySelector('#list').innerHTML = !list.length
        ? empty
        : isArchive
          ? '<div class="grid grid--sm-2 grid--md-3">' + list.map(workCard).join('') + '</div>'
          : '<div class="grid grid--sm-2">' + list.map(A.ui.resourceCard).join('') + '</div>';

      const p = new URLSearchParams();
      if (state.group) p.set(groupKey, state.group);
      if (state.sort !== 'newest') p.set('sort', state.sort);
      const qs = p.toString();
      A.router.setQuietly(base + (qs ? '?' + qs : ''));
    }

    view.addEventListener('change', (e) => {
      const sel = e.target.closest('[data-select]');
      if (!sel) return;
      state[sel.dataset.select] = sel.value;
      render();
    });
    view.addEventListener('click', (e) => {
      if (!e.target.closest('[data-group-reset]')) return;
      state.group = '';
      const sel = view.querySelector('#fGroup');
      if (sel) sel.value = '';
      render();
    });
    render();
  };
})(window.AIClub);
