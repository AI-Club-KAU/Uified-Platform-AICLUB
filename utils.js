/* Small shared helpers */
(function (A) {
  'use strict';

  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

  /** Escape any value for safe insertion into HTML text or attributes. */
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ESC[c]);
  }

  // C0/C1 controls, DEL, zero-width, bidi overrides, line/paragraph separators, BOM.
  // Browsers strip some of these while parsing ("java\tscript:"), so any of them → reject.
  const UNSAFE_URL_CHARS = new RegExp('[' + [
    [0x0000, 0x001F], [0x007F, 0x009F], [0x00AD, 0x00AD], [0x200B, 0x200F],
    [0x2028, 0x202E], [0x2060, 0x2069], [0xFEFF, 0xFEFF]
  ].map(function (r) {
    var h = function (n) { return '\\u' + ('000' + n.toString(16)).slice(-4); };
    return h(r[0]) + (r[1] !== r[0] ? '-' + h(r[1]) : '');
  }).join('') + ']');

  /**
   * Accept only absolute http(s) URLs and relative paths that resolve inside this site.
   * Content may later come from a Google Sheet, so never trust it blindly.
   * The value is checked with the browser's own URL parser, so the protocol that is
   * tested is the one the browser would actually use.
   */
  function safeUrl(value) {
    const raw = String(value == null ? '' : value).trim();
    if (!raw || raw.length > 2048) return '';
    if (UNSAFE_URL_CHARS.test(raw) || raw.includes('\\')) return '';

    const base = (typeof location !== 'undefined' && location.href) || 'https://aiclub.invalid/';
    let parsed;
    try { parsed = new URL(raw, base); } catch (e) { return ''; }

    if (/^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.startsWith('//')) {
      // Absolute (or protocol-relative): only http(s) with a host and no embedded credentials
      if (!raw.startsWith('//') && (parsed.protocol === 'https:' || parsed.protocol === 'http:') &&
          parsed.hostname && !parsed.username && !parsed.password) {
        return parsed.href;
      }
      return '';
    }

    // Relative: must stay on this site (same protocol and host as the page)
    const here = new URL(base);
    if (parsed.protocol !== here.protocol || parsed.host !== here.host) return '';
    return raw;
  }

  function isExternal(url) {
    return /^https?:\/\//i.test(url);
  }

  /** Convert Arabic-Indic and Extended (Persian) digits to ASCII digits. */
  function toAsciiDigits(value) {
    return String(value == null ? '' : value)
      .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
      .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06F0));
  }

  /**
   * Arabic counted noun. forms = [one, two, few(3–10), many(11+)]
   * e.g. plural(3, ['مورد واحد', 'موردان', 'موارد', 'موردًا'])
   */
  function plural(n, forms) {
    if (n === 0) return forms[4] || ('0 ' + forms[2]);
    if (n === 1) return forms[0];
    if (n === 2) return forms[1];
    if (n >= 3 && n <= 10) return n + ' ' + forms[2];
    return n + ' ' + forms[3];
  }

  const counts = {
    resources: (n) => plural(n, ['مورد واحد', 'موردان', 'موارد', 'موردًا', 'لا توجد موارد']),
    results: (n) => plural(n, ['نتيجة واحدة', 'نتيجتان', 'نتائج', 'نتيجة', '0 نتيجة']),
    departments: (n) => plural(n, ['قسم واحد', 'قسمان', 'أقسام', 'قسمًا', 'لا توجد أقسام']),
    items: (n) => plural(n, ['عنصر واحد', 'عنصران', 'عناصر', 'عنصرًا', 'لا توجد عناصر']),
    works: (n) => plural(n, ['عمل واحد', 'عملان', 'أعمال', 'عملًا', 'لا توجد أعمال'])
  };

  /** "14 أكتوبر 2026"; short = "14 أكتوبر" */
  function formatDate(iso, short) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return String(iso);
    try {
      const opts = short ? { day: 'numeric', month: 'long' } : { day: 'numeric', month: 'long', year: 'numeric' };
      return new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', opts).format(d);
    } catch (e) {
      return d.toISOString().slice(0, 10);
    }
  }

  /** Google Drive / Docs file id from a link, or '' */
  function driveId(url) {
    const m = /^https:\/\/(?:drive|docs)\.google\.com\/(?:file|document|presentation|spreadsheets)\/d\/([\w-]+)/.exec(url || '');
    return m ? m[1] : '';
  }

  /** An image to show in an <img>: Drive files go through Google's thumbnail service */
  function imageSrc(url, width) {
    const id = driveId(url);
    return id ? 'https://drive.google.com/thumbnail?id=' + id + '&sz=w' + (width || 1200) : url;
  }

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

  A.utils = { esc, safeUrl, isExternal, toAsciiDigits, plural, counts, formatDate, driveId, imageSrc, $, $all };
})(window.AIClub);
