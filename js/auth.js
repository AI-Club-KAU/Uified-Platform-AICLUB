/*
 * Sign-in with the university ID.
 *
 * 1. The ID is checked for format here (7 digits, Arabic or Latin numerals).
 * 2. It is then checked against the platform's member list ON THE SERVER (Apps Script),
 *    which answers only "allowed / not allowed" plus a signed token — member records
 *    never reach the browser.
 *
 * The token is remembered on this device until "خروج". The server re-checks the member
 * on every content load, so removing someone from the member list locks them out at once.
 * With dataSource 'local' (building / preview) only step 1 runs.
 */
(function (A) {
  'use strict';

  const KEY = 'aiclub.session.v2';

  /**
   * @returns {{ok: true, value: string} | {ok: false, code: string, message: string}}
   */
  function validateStudentId(input) {
    const len = (A.config.auth && A.config.auth.studentIdLength) || 7;
    const value = A.utils.toAsciiDigits(input).replace(/[\s‏‎-]/g, '');
    if (!value) return { ok: false, code: 'empty', message: 'أدخل رقمك الجامعي.' };
    if (!/^\d+$/.test(value)) return { ok: false, code: 'not-digits', message: 'الرقم الجامعي أرقام فقط، بدون حروف أو رموز.' };
    if (value.length !== len) return { ok: false, code: 'length', message: 'الرقم الجامعي يتكوّن من ' + len + ' أرقام، تأكد منه.' };
    return { ok: true, value };
  }

  const MESSAGES = {
    'not-found': 'الرقم غير مسجّل في النادي، تأكد منه وحاول مرة ثانية.',
    error: 'تعذّر التحقق الآن، تحقق من الاتصال وحاول مرة ثانية.'
  };

  /** Server check against the member list → { allowed, token, name } */
  async function checkMembership(id) {
    if (A.config.dataSource !== 'apps-script') return { allowed: true, token: '', name: '' };
    const res = await A.data.post('verify', { id }, { noToken: true });
    if (!res.ok) throw new Error('verify failed: ' + (res.code || 'error'));
    return res.data;
  }

  let memorySession = null; // fallback when storage is blocked

  function read() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : memorySession;
    } catch (e) {
      return memorySession;
    }
  }

  function write(session) {
    memorySession = session;
    try {
      if (session) localStorage.setItem(KEY, JSON.stringify(session));
      else localStorage.removeItem(KEY);
    } catch (e) { /* storage blocked — memory fallback only */ }
  }

  A.auth = {
    validateStudentId,

    /**
     * Validate, then verify membership. The ID itself is not stored.
     * @returns {Promise<{ok: true} | {ok: false, code: string, message: string}>}
     */
    async signIn(input) {
      const v = validateStudentId(input);
      if (!v.ok) return v;
      let result;
      try {
        result = await checkMembership(v.value);
      } catch (e) {
        if (window.console) console.error('[AIClub] sign-in check failed', e);
        return { ok: false, code: 'error', message: MESSAGES.error };
      }
      if (!result || !result.allowed) return { ok: false, code: 'not-found', message: MESSAGES['not-found'] };
      write({ signedInAt: new Date().toISOString(), token: result.token || '', name: result.name || '' });
      return { ok: true };
    },

    isSignedIn() {
      const s = read();
      return !!(s && s.signedInAt);
    },

    /** Signed session token from the server ('' in local mode). */
    token() {
      const s = read();
      return (s && s.token) || '';
    },

    signOut() { write(null); }
  };
})(window.AIClub);
