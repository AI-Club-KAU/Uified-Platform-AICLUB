/* Boot: load content, register routes, wire global actions */
(function (A) {
  'use strict';

  const V = A.views;
  const { $ } = A.utils;

  function registerRoutes() {
    A.router
      .add('login', '/login', V.login)
      .add('home', '/', V.home)
      .add('departments', '/departments', V.departments)
      .add('department', '/departments/:id', V.department)
      .add('department-archive', '/departments/:id/archive', V.department)
      // Old links to a single archive section → the unified archive, filtered
      .add('archive-section', '/departments/:id/archive/:kind', (ctx) =>
        A.router.replace('#/departments/' + encodeURIComponent(ctx.params.id) + '/archive?section=' + encodeURIComponent(ctx.params.kind)))
      .add('shared', '/shared', V.shared)
      .add('systems', '/systems', V.systems)
      .add('search', '/search', V.search)
      .add('resource', '/resource/:id', V.resource)
      .otherwise((ctx) => V.notFound(ctx));

    // Everything except the ID screen needs a (preview) session
    A.router.setGuard((ctx) => {
      const signedIn = A.auth.isSignedIn();
      if (ctx.path === '/login') return signedIn ? '#/' : null;
      if (!signedIn) {
        const next = ctx.hash && ctx.hash !== '#/' ? '?next=' + encodeURIComponent(ctx.hash) : '';
        return '#/login' + next;
      }
      return null;
    });
  }

  function wireGlobalActions() {
    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-action]');
      if (!el) return;
      const action = el.dataset.action;
      if (action === 'back') {
        e.preventDefault();
        A.router.back(el.dataset.fallback);
      } else if (action === 'logout') {
        e.preventDefault();
        A.auth.signOut();
        A.data.reset(); // also forget the content remembered on this device
        A.router.replace('#/login');
        A.ui.toast('تم تسجيل الخروج');
      }
    });

    $('#skipLink').addEventListener('click', () => {
      const main = $('#main');
      main.focus();
      main.scrollIntoView();
    });
  }

  function start() {
    if (!booted) {
      booted = true;
      registerRoutes();
      wireGlobalActions();
      A.router.start();
    } else {
      A.router.replace(location.hash || '#/');
    }
  }

  // Fresh content arrived in the background → redraw the current page in place
  A.data.onUpdate = () => {
    const cur = A.router.current;
    if (!cur || cur.name === 'login' || cur.name === 'search') return; // don't disturb typing
    A.ui.redraw(cur.hash);
  };

  // The background check found the member removed (or everyone logged out)
  A.data.onAuthLost = () => {
    A.auth.signOut();
    A.data.reset();
    A.loginNotice = 'انتهت جلستك، سجّل دخولك مرة ثانية.';
    A.router.replace('#/login');
  };

  /**
   * Load the content, then show the app. Content needs a signed-in member, so when
   * nobody is signed in the app starts on the ID screen and loads after sign-in.
   */
  async function boot() {
    if (!A.auth.isSignedIn()) { start(); return; }
    $('#main').innerHTML = A.ui.loading('جارٍ تحميل موارد النادي…');
    try {
      await A.data.load();
    } catch (err) {
      if (err && err.code === 'auth') {
        // Removed from the member list, or everyone was logged out
        A.auth.signOut();
        A.data.reset();
        A.loginNotice = 'انتهت جلستك، سجّل دخولك مرة ثانية.';
        start(); // signed out → the route guard opens the ID screen, which shows the notice
        return;
      }
      if (window.console) console.error('[AIClub] content load failed', err);
      A.views.loadError(err, boot);
      return;
    }
    start();
  }

  /** Called by the ID screen after a successful sign-in. */
  A.loadAfterSignIn = async function () {
    if (A.data.loaded) return;
    await A.data.load();
  };

  let booted = false;
  boot();
})(window.AIClub);
