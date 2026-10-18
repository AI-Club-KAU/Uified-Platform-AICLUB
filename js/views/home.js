/* View: Home — search + the three main groups + latest resources */
(function (A) {
  'use strict';

  const { esc } = A.utils;
  const icon = A.icon;
  A.views = A.views || {};

  function latestRow(r) {
    return '<li><a class="latest__row" href="#/resource/' + encodeURIComponent(r.id) + '">' +
      '<span class="latest__icon">' + icon(A.ui.resourceIcon(r)) + '</span>' +
      '<span class="latest__body">' +
        '<span class="latest__title">' + esc(r.title) + '</span>' +
        '<span class="latest__meta">' + esc(A.data.locationLabel(r)) + '</span>' +
      '</span>' +
      '<time class="latest__date" datetime="' + esc(r.createdAt) + '">' + esc(A.utils.formatDate(r.createdAt, true)) + '</time>' +
    '</a></li>';
  }

  A.views.home = function () {
    A.ui.renderShell({ authed: true, nav: 'home' });
    const d = A.data;

    const searchForm =
      '<form class="search-form search-form--inline hero__search" id="homeSearch" role="search">' +
        '<label class="visually-hidden" for="homeQ">ابحث في موارد النادي</label>' +
        '<div class="suggest">' +
          '<input class="input" id="homeQ" name="q" type="search" placeholder="ابحث عن قالب، دليل، نظام..." autocomplete="off">' +
        '</div>' +
        '<button class="btn btn--primary" type="submit">بحث</button>' +
      '</form>';

    const groups = [
      { href: '#/departments', icon: 'grid', title: 'أقسام النادي', desc: 'قوالب ونماذج وملفات كل قسم' },
      { href: '#/shared', icon: 'folder', title: 'الموارد المشتركة', desc: 'موارد وملفات مشتركة بين جميع أقسام النادي' },
      { href: '#/systems', icon: 'systems', title: 'أنظمة النادي', desc: 'روابط الأنظمة المستقلة' }
    ];

    const latest = d.latest(5);

    const html =
      A.ui.hero({
        cls: 'hero--search',
        eyebrow: 'AI CLUB · UNIFIED PLATFORM',
        title: 'كل موارد النادي في مكان واحد',
        lead: 'ابحث، استكشف، وصِل إلى الأدوات التي تحتاجها بسهولة.',
        extra: searchForm
      }) +
      '<section class="section" aria-labelledby="exploreTitle">' +
        '<div class="section__head"><h2 class="section__title" id="exploreTitle">تصفّح المنصة</h2><span class="section__meta">3 أقسام رئيسية</span></div>' +
        '<div class="grid grid--md-3">' +
          groups.map((g) => A.ui.tile(Object.assign({ cls: 'group-card' }, g, { desc: esc(g.desc) }))).join('') +
        '</div>' +
      '</section>' +
      (latest.length
        ? '<section class="section latest" aria-labelledby="latestTitle">' +
            '<div class="latest__head">' +
              '<h2 class="section__title" id="latestTitle"><span class="latest__dot" aria-hidden="true"></span>أُضيف حديثًا</h2>' +
              '<a class="latest__all" href="#/search?sort=newest">عرض الكل' + icon('chevron-left') + '</a>' +
            '</div>' +
            '<ol class="latest__list">' + latest.map(latestRow).join('') + '</ol>' +
          '</section>'
        : '');

    const main = A.ui.mount(html, 'الرئيسية');
    const input = main.querySelector('#homeQ');
    const goToResults = () => {
      const q = input.value.trim();
      A.router.go('#/search' + (q ? '?q=' + encodeURIComponent(q) : ''));
    };
    A.ui.attachSuggest(input, goToResults);
    main.querySelector('#homeSearch').addEventListener('submit', (e) => {
      e.preventDefault();
      goToResults();
    });
  };
})(window.AIClub);
