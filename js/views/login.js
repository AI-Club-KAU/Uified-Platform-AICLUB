/* View: sign-in with the university ID */
(function (A) {
  'use strict';

  const { esc } = A.utils;
  const icon = A.icon;
  A.views = A.views || {};

  A.views.login = function (ctx) {
    A.ui.renderShell({ authed: false });

    const html =
      '<section class="login">' +
        '<div class="login-card">' +
          '<div class="login-card__top"><span class="eyebrow">AI CLUB · UNIFIED PLATFORM</span>' + A.ui.pixels() + '</div>' +
          '<h1 class="login-card__title">تسجيل الدخول</h1>' +
          '<p class="login-card__lead">أدخل رقمك الجامعي للدخول إلى المنصة</p>' +
          '<form class="login-form" id="loginForm" novalidate>' +
            '<div class="field">' +
              '<label class="field__label" for="studentId">الرقم الجامعي</label>' +
              '<input class="input" id="studentId" name="studentId" type="text" inputmode="numeric" autocomplete="off" ' +
                'spellcheck="false" maxlength="20" placeholder="مثال: 2412345" aria-describedby="studentIdError">' +
              '<p class="field__error" id="studentIdError" aria-live="polite" hidden></p>' +
            '</div>' +
            '<button class="btn btn--primary btn--block" type="submit" id="loginBtn">دخول</button>' +
          '</form>' +
        '</div>' +
      '</section>';

    const main = A.ui.mount(html, 'تسجيل الدخول', { noFocus: true });
    const form = main.querySelector('#loginForm');
    const input = main.querySelector('#studentId');
    const button = main.querySelector('#loginBtn');
    const errorEl = main.querySelector('#studentIdError');
    let touched = false;
    let busy = false;

    function showError(msg) {
      errorEl.innerHTML = icon('alert') + '<span>' + esc(msg) + '</span>';
      errorEl.hidden = false;
      input.setAttribute('aria-invalid', 'true');
    }
    function clearError() {
      errorEl.hidden = true;
      errorEl.textContent = '';
      input.removeAttribute('aria-invalid');
    }
    function setBusy(on, label) {
      busy = on;
      button.disabled = on;
      button.textContent = on ? (label || 'جارٍ التحقق…') : 'دخول';
    }

    // e.g. "انتهت جلستك…" after a member was removed — shown once
    if (A.loginNotice) { showError(A.loginNotice); A.loginNotice = ''; }

    input.addEventListener('input', () => {
      if (!touched) return;
      const r = A.auth.validateStudentId(input.value);
      if (r.ok) clearError(); else showError(r.message);
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (busy) return;
      touched = true;
      setBusy(true);
      const r = await A.auth.signIn(input.value);
      if (!main.isConnected) return;
      setBusy(false);
      if (!r.ok) {
        showError(r.message);
        input.focus();
        return;
      }
      clearError();
      input.value = ''; // the ID is not kept anywhere
      setBusy(true, 'جارٍ تحميل المنصة…');
      try {
        await A.loadAfterSignIn();
      } catch (err) {
        if (!main.isConnected) return;
        setBusy(false);
        A.auth.signOut(); // no content → stay on this screen and let them try again
        showError('تعذّر تحميل المنصة، حاول مرة ثانية.');
        return;
      }
      const next = ctx.query.next && ctx.query.next.startsWith('#/') && !ctx.query.next.startsWith('#/login') ? ctx.query.next : '#/';
      A.router.replace(next);
    });

    input.focus();
  };
})(window.AIClub);
