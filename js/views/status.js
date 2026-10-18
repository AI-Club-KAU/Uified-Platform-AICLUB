/* Views: not found / content load error */
(function (A) {
  'use strict';

  const { esc } = A.utils;
  A.views = A.views || {};

  A.views.notFound = function (ctx, o) {
    const opts = o || {};
    A.ui.renderShell({ authed: true, nav: '' });
    const html =
      A.ui.crumbs({ fallback: opts.href || '#/' }) +
      '<h1 class="visually-hidden">الصفحة غير موجودة</h1>' +
      A.ui.emptyState({
        icon: 'alert',
        title: 'الصفحة غير موجودة',
        text: opts.text || 'الرابط الذي فتحته غير صحيح أو لم يعد متاحًا.',
        actions: '<a class="btn btn--primary" href="' + esc(opts.href || '#/') + '">' + esc(opts.label || 'العودة إلى الرئيسية') + '</a>'
      });
    A.ui.mount(html, 'غير موجود');
  };

  A.views.loadError = function (err, retry) {
    document.body.classList.remove('is-loading');
    document.body.classList.add('is-auth');
    const html =
      '<h1 class="visually-hidden">تعذّر تحميل المحتوى</h1>' +
      A.ui.emptyState({
        icon: 'alert',
        title: 'تعذّر تحميل محتوى المنصة',
        text: 'تحقق من الاتصال ثم أعد المحاولة. إن استمرت المشكلة فأبلغ قسم الدعم والتطوير.',
        actions: '<button type="button" class="btn btn--primary" data-retry>إعادة المحاولة</button>'
      });
    const view = A.ui.mount(html, 'خطأ في التحميل');
    view.querySelector('[data-retry]').addEventListener('click', retry);
  };
})(window.AIClub);
