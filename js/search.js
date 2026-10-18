/* Arabic-aware client-side search */
(function (A) {
  'use strict';

  /**
   * Normalise Arabic text so common spelling variants match:
   * diacritics and tatweel removed, alef forms → ا, ة → ه, ى → ي, ؤ → و, ئ → ي,
   * Arabic digits → ASCII, case folded.
   */
  function normalize(text) {
    return A.utils.toAsciiDigits(text)
      .toLowerCase()
      .replace(/[ً-ٰٟۖ-ۭ]/g, '') // harakat & Quranic marks
      .replace(/ـ/g, '')                            // tatweel
      .replace(/[إأآٱ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/ؤ/g, 'و')
      .replace(/ئ/g, 'ي')
      .replace(/[_\-–—·•/\\|،,]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function tokens(q) {
    return normalize(q).split(' ').filter(Boolean);
  }

  /** Strip the definite article so "القوالب" also matches "قوالب". */
  function stripAl(t) {
    return t.length > 3 && t.startsWith('ال') ? t.slice(2) : t;
  }

  function haystack(r) {
    const d = A.data;
    return normalize([
      r.title, r.description, r.format, r.tags, r.owner, r.year,
      d.typeLabel(r.type), d.typeSingular(r.type),
      d.locationLabel(r),
      d.categoryLabel(r),
      d.archiveLabel(r)
    ].join(' '));
  }

  /** Does `word` start somewhere in `text` (at a word start, with or without "ال")? */
  function startsWord(text, word) {
    return (' ' + text).includes(' ' + word) || (' ' + text).includes(' ال' + word);
  }

  /**
   * Relevance: matches in the title beat matches elsewhere, and a word that starts
   * with what was typed beats a match in the middle of a word.
   */
  function score(r, q) {
    const title = normalize(r.title);
    let s = 0;
    q.forEach((t) => {
      const w = stripAl(t);
      if (title.startsWith(t) || title.startsWith(w)) s += 8;
      else if (startsWord(title, t) || startsWord(title, w)) s += 6;
      else if (title.includes(t) || title.includes(w)) s += 4;
      else s += 1;
    });
    return s;
  }

  /**
   * @param {{q?: string, type?: string, dept?: string, sort?: string}} params
   *   type: resource type id or '' (all)
   *   dept: department id, '__shared', '__systems', or '' (all)
   *   sort: 'newest' | 'oldest' | 'az' | '' (relevance when there is a query)
   */
  function run(params) {
    const q = tokens(params.q || '');
    const type = params.type || '';
    const dept = params.dept || '';
    const list = A.data.all().filter((r) => {
      if (type && r.type !== type) return false;
      if (dept === '__shared' && r.section !== 'shared') return false;
      if (dept === '__systems' && r.section !== 'system') return false;
      if (dept && dept[0] !== '_' && r.departmentId !== dept) return false;
      if (!q.length) return true;
      const h = haystack(r);
      return q.every((t) => h.includes(t) || h.includes(stripAl(t)));
    });
    if (params.sort && A.data.isSort(params.sort)) return A.data.sort(list, params.sort);
    if (!q.length) return A.data.sort(list, 'newest');
    // Stable relevance order: ties keep the newest first
    return A.data.sort(list, 'newest')
      .map((r, i) => ({ r, i, s: score(r, q) }))
      .sort((a, b) => b.s - a.s || a.i - b.i)
      .map((x) => x.r);
  }

  /**
   * Top matches while typing (live suggestions). Stricter than the results page:
   * every typed word must be the start of a word, so "خط" suggests "خطاب" and "خطة"
   * but not resources that merely sit under "التخطيط".
   */
  function suggest(q, n) {
    const t = tokens(q);
    if (!t.length) return [];
    return run({ q })
      .filter((r) => { const h = haystack(r); return t.every((w) => startsWord(h, w) || startsWord(h, stripAl(w))); })
      .slice(0, n || 5);
  }

  A.search = { normalize, run, suggest };
})(window.AIClub);
