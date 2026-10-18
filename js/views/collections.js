/* Views: الموارد المشتركة and أنظمة النادي */
(function (A) {
  'use strict';

  A.views = A.views || {};

  A.views.shared = function () {
    A.ui.renderShell({ authed: true, nav: 'shared' });
    const list = A.data.sort(A.data.shared(), 'newest');
    const html =
      A.ui.crumbs({ fallback: '#/' }) +
      A.ui.hero({ eyebrow: 'AI CLUB · RESOURCES', title: 'الموارد المشتركة', lead: 'موارد وملفات مشتركة بين جميع أقسام النادي.' }) +
      '<section class="section">' +
        A.ui.sectionHead('الموارد المتاحة', list.length ? A.utils.counts.resources(list.length) : '') +
        A.ui.resourceList(list, A.ui.emptyState({ title: 'لا توجد موارد مشتركة بعد', text: 'ستظهر الموارد المشتركة هنا عند إضافتها.' })) +
      '</section>';
    A.ui.mount(html, 'الموارد المشتركة');
  };

  A.views.systems = function () {
    A.ui.renderShell({ authed: true, nav: 'systems' });
    const list = A.data.systems();
    const html =
      A.ui.crumbs({ fallback: '#/' }) +
      A.ui.hero({ eyebrow: 'AI CLUB · SYSTEMS', title: 'أنظمة النادي', lead: 'الوصول إلى أنظمة النادي المستقلة.' }) +
      '<section class="section">' +
        A.ui.sectionHead('الأنظمة المتاحة', '') +
        A.ui.resourceList(list, A.ui.emptyState({ icon: 'systems', title: 'لا توجد أنظمة مرتبطة بعد', text: 'ستظهر روابط أنظمة النادي هنا عند إضافتها.' })) +
      '</section>';
    A.ui.mount(html, 'أنظمة النادي');
  };
})(window.AIClub);
