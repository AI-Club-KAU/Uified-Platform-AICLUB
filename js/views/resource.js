/*
 * View: resource details.
 * Order on phones: title + description → preview → buttons → details.
 * On desktop: details and buttons on the right, a larger preview on the left.
 * Files normally live on Google Drive: Google renders the preview, and heavy files
 * (videos, or more than HEAVY_MB) open in a new window instead.
 */
(function (A) {
  'use strict';

  const { esc, isExternal } = A.utils;
  const icon = A.icon;
  A.views = A.views || {};

  const MISSING = 'تواصل مع قسم الدعم والتطوير.';
  const HEAVY_MB = 15;
  const VIDEO = /^(MP4|MOV|M4V|WEBM|AVI|MKV)$/;

  /** Videos and big files are not previewed inside the page */
  function isHeavy(r) {
    return r.sizeMb > HEAVY_MB || VIDEO.test(String(r.format).toUpperCase()) ||
      r.files.some((f) => VIDEO.test(String(f.format).toUpperCase()));
  }

  function fileName(url) {
    const clean = url.split(/[?#]/)[0];
    return clean.substring(clean.lastIndexOf('/') + 1) || 'file';
  }

  function linkAttrs(url) {
    return 'href="' + esc(url) + '" target="_blank" rel="noopener noreferrer"';
  }

  /**
   * Google file links → what the page can do with them:
   *   preview  shown inside the page        copy  "make a copy" link (Docs/Sheets/Slides/Forms)
   */
  function googleFile(url) {
    let m = /^https:\/\/docs\.google\.com\/(document|spreadsheets|presentation|forms)\/d\/([\w-]+)/.exec(url || '');
    if (m) {
      const base = 'https://docs.google.com/' + m[1] + '/d/' + m[2];
      const exportAs = { document: '/export?format=docx', spreadsheets: '/export?format=xlsx', presentation: '/export/pptx' };
      return {
        isForm: m[1] === 'forms',
        preview: m[1] === 'forms' ? base + '/viewform?embedded=true' : base + '/preview',
        open: m[1] === 'forms' ? base + '/viewform' : base + '/view',
        download: exportAs[m[1]] ? base + exportAs[m[1]] : '',
        copy: base + '/copy'
      };
    }
    m = /^https:\/\/drive\.google\.com\/file\/d\/([\w-]+)/.exec(url || '');
    if (m) {
      const base = 'https://drive.google.com/file/d/' + m[1];
      return {
        isForm: false, preview: base + '/preview', open: base + '/view', copy: '',
        download: 'https://drive.google.com/uc?export=download&id=' + m[1]
      };
    }
    return null;
  }

  /** Google files open in their viewer; anything else as is */
  function openUrl(url) {
    const g = googleFile(url);
    return g ? g.open : url;
  }

  function googleCopyUrl(url) {
    const g = googleFile(url);
    return g ? g.copy : '';
  }

  function btn(cls, iconName, label, attrs) {
    return '<a class="btn ' + cls + '" ' + attrs + '>' + icon(iconName) + '<span>' + label + '</span></a>';
  }

  function downloadBtn(f, cls) {
    const g = googleFile(f.url);
    if (g && g.download) return btn(cls, 'download', 'تنزيل', 'href="' + esc(g.download) + '" rel="noopener noreferrer"');
    // Other external files cannot be force-downloaded cross-origin; open them instead.
    if (isExternal(f.url)) return btn(cls, 'external', 'فتح الملف', linkAttrs(f.url));
    return btn(cls, 'download', 'تنزيل', 'href="' + esc(f.url) + '" download="' + esc(fileName(f.url)) + '"');
  }

  function unavailable(title) {
    return '<div class="unavailable" role="note">' + icon('lock') + '<div><strong>' + esc(title) + '</strong>' + esc(MISSING) + '</div></div>';
  }

  /**
   * Main actions. Returns { bar } for the buttons (fixed at the bottom on phones),
   * or { block } for content that doesn't fit a button bar (file list, unavailable notice).
   */
  function actions(r) {
    if (r.action === 'external' || r.action === 'open') {
      if (!r.url) return { block: unavailable('الرابط غير متوفر حاليًا') };
      const g = googleFile(r.url);
      if (g && g.copy && !r.archive) {
        return {
          bar: [
            btn('btn--primary', 'copy', 'إنشاء نسخة لي', linkAttrs(g.copy)),
            btn('btn--ghost', 'external', 'فتح في نافذة جديدة', linkAttrs(g.open))
          ],
          note: g.isForm ? 'للنسخ والتعديل فقط، لا ترسل ردودك هنا.' : ''
        };
      }
      return { bar: [btn('btn--primary', 'external', r.section === 'system' ? 'فتح النظام' : g ? 'فتح في نافذة جديدة' : 'فتح الرابط', linkAttrs(g ? g.open : r.url))] };
    }
    if (r.action === 'text') {
      if (!r.text) return { block: unavailable('النص غير متوفر حاليًا') };
      return { bar: ['<button type="button" class="btn btn--primary" data-action="copy-text">' + icon('copy') + '<span>نسخ النص</span></button>'] };
    }
    if (!r.files.length) return { block: unavailable(r.archive ? 'العمل غير متوفر حاليًا' : 'الملف غير متوفر حاليًا') };

    if (r.files.length > 1) {
      // Several files: one row each. Archive works are view-only (no download).
      return {
        block: '<div class="file-list">' + r.files.map((f) =>
          '<div class="file-row">' +
            '<span class="file-row__name">' + esc(f.label) + ' <span class="file-row__fmt latin">' + esc(f.format) + '</span></span>' +
            '<span class="file-row__actions">' +
              (f.openable || isExternal(f.url) ? '<a class="btn btn--ghost" ' + linkAttrs(openUrl(f.url)) + ' aria-label="فتح ' + esc(f.label) + ' في نافذة جديدة">' + icon('external') + '</a>' : '') +
              (r.archive ? '' : downloadBtn(f, 'btn--primary')) +
            '</span>' +
          '</div>').join('') + '</div>'
      };
    }

    const f = r.files[0];
    const g = googleFile(f.url);
    const out = [];
    if (r.archive) {
      out.push(btn('btn--primary', 'external', 'فتح في نافذة جديدة', linkAttrs(openUrl(f.url))));
    } else {
      out.push(downloadBtn(f, 'btn--primary'));
      if (g || f.openable && !isExternal(f.url)) out.push(btn('btn--ghost', 'external', 'فتح في نافذة جديدة', linkAttrs(openUrl(f.url))));
    }
    const copy = googleCopyUrl(f.url);
    if (copy && !r.archive) out.push(btn('btn--outline', 'copy', 'إنشاء نسخة لي', linkAttrs(copy)));
    return out.length ? { bar: out } : {};
  }

  function imagesHtml(images) {
    return '<div class="preview__images' + (images.length === 1 ? ' preview__images--single' : '') + '">' + images.map((f) =>
      '<figure class="preview__img' + (f.preview === 'light' ? ' preview__img--light' : '') + '">' +
        '<img src="' + esc(A.utils.imageSrc(f.url)) + '" alt="' + esc(f.label) + '" loading="lazy"></figure>').join('') +
    '</div>';
  }

  function previewHtml(r) {
    if (r.action === 'text' && r.text) {
      return '<div class="preview preview--text"><div class="text-box" tabindex="0" aria-label="نص المورد">' + esc(r.text) + '</div></div>';
    }

    if (isHeavy(r) && r.files.length) {
      return '<div class="preview">' +
        '<span class="preview__icon">' + icon(A.ui.resourceIcon(r)) + '</span>' +
        (r.format ? '<p class="preview__label latin">' + esc(r.format) + '</p>' : '') +
        '<p class="preview__note">الملف كبير، افتحه في نافذة جديدة لعرضه.</p>' +
      '</div>';
    }

    // Images (also on Drive) are shown as plain images — no Google frame
    const imgs = r.files.filter((f) => f.isImage);
    if (imgs.length) return '<div class="preview preview--view">' + imagesHtml(r.archive ? imgs : imgs.slice(0, 4)) + '</div>';

    // Google Docs / Sheets / Slides / Forms / Drive files: Google renders them
    const g = googleFile(r.url) || (r.files.length === 1 ? googleFile(r.files[0].url) : null);
    if (g) {
      return '<div class="preview preview--pdf' + (g.isForm ? ' preview--form' : '') + '">' +
        '<iframe class="pdf-frame" src="' + esc(g.preview) + '" title="معاينة ' + esc(r.title) + '" loading="lazy"></iframe>' +
      '</div>';
    }

    const images = r.files.filter((f) => f.isImage);
    if (images.length) return '<div class="preview preview--view">' + imagesHtml(r.archive ? images : images.slice(0, 4)) + '</div>';

    const pdf = r.files.find((f) => f.format === 'PDF' && !isExternal(f.url));
    if (pdf) {
      return '<div class="preview preview--pdf">' +
        '<iframe class="pdf-frame" src="' + esc(pdf.url) + '#toolbar=0&navpanes=0" title="معاينة ' + esc(pdf.label) + '" loading="lazy"></iframe>' +
      '</div>';
    }

    const available = A.data.isAvailable(r);
    let note;
    if (r.section === 'system') note = available ? 'يفتح النظام في نافذة جديدة.' : 'رابط النظام غير متوفر حاليًا.';
    else if (!available) note = 'الملف غير متوفر حاليًا.';
    else if (r.action === 'external' || r.action === 'open') note = 'يفتح الرابط في نافذة جديدة.';
    else note = 'المعاينة غير متاحة لهذه الصيغة، نزّل الملف لعرض محتواه.';
    return '<div class="preview">' +
      '<span class="preview__icon">' + icon(A.ui.resourceIcon(r)) + '</span>' +
      (r.format ? '<p class="preview__label latin">' + esc(r.format) + '</p>' : '') +
      '<p class="preview__note">' + esc(note) + '</p>' +
    '</div>';
  }

  /* ---------- Member note on a resource (bottom sheet) ---------- */
  const FEEDBACK_MAX = 1000;

  function openFeedback(r, returnFocus) {
    A.ui.openSheet({
      title: 'ملاحظة على المورد',
      returnFocus,
      body:
        '<form class="feedback-form" novalidate>' +
          '<div class="field">' +
            '<label class="field__label" for="fbText">ملاحظتك على «' + esc(r.title) + '»</label>' +
            '<textarea class="input textarea" id="fbText" rows="5" maxlength="' + FEEDBACK_MAX + '" data-autofocus ' +
              'aria-describedby="fbHint fbError"></textarea>' +
            '<p class="field__hint" id="fbHint">يصل اسمك مع الملاحظة إلى قائد القسم وقسم الدعم والتطوير.</p>' +
            '<p class="field__error" id="fbError" aria-live="polite" hidden></p>' +
          '</div>' +
          '<button type="submit" class="btn btn--primary btn--block">إرسال</button>' +
        '</form>',
      onOpen(sheet) {
        const form = sheet.querySelector('.feedback-form');
        const input = sheet.querySelector('#fbText');
        const err = sheet.querySelector('#fbError');
        const submit = form.querySelector('[type="submit"]');
        const showError = (msg) => { err.innerHTML = icon('alert') + '<span>' + esc(msg) + '</span>'; err.hidden = false; };
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const text = input.value.trim();
          if (!text) { showError('اكتب ملاحظتك أولًا.'); input.focus(); return; }
          err.hidden = true;
          submit.disabled = true;
          submit.textContent = 'جارٍ الإرسال…';
          const res = await A.data.sendFeedback(r.id, text);
          submit.disabled = false;
          submit.textContent = 'إرسال';
          if (res.ok) { A.ui.closeSheet(); A.ui.toast('وصلت ملاحظتك، شكرًا لك'); return; }
          showError(res.code === 'not-connected'
            ? 'الإرسال يتفعّل بعد ربط المنصة بالشيت.'
            : 'تعذّر الإرسال، حاول مرة ثانية.');
        });
      }
    });
  }

  A.views.resource = function (ctx) {
    const d = A.data;
    const r = d.resource(ctx.params.id);
    if (!r) return A.views.notFound(ctx, { text: 'هذا المورد غير موجود أو أُزيل من المنصة.', href: '#/search', label: 'البحث في الموارد' });

    const nav = r.section === 'department' ? 'departments' : r.section === 'shared' ? 'shared' : 'systems';
    A.ui.renderShell({ authed: true, nav });

    const parent = d.parentRoute(r);
    const trail = [];
    if (r.section === 'department') {
      const dep = d.department(r.departmentId);
      trail.push({ label: dep.name, href: '#/departments/' + encodeURIComponent(dep.id) });
      if (r.archive) trail.push({ label: 'الأرشيف', href: parent });
    } else {
      trail.push({ label: d.section(r.section).label, href: parent });
    }
    trail.push({ label: r.archive ? 'تفاصيل العمل' : 'تفاصيل المورد' });

    const metaRows = [
      ['النوع', d.typeSingular(r.type)],
      ['الصيغة', r.format],
      [r.section === 'department' ? 'القسم' : 'المجموعة', d.locationLabel(r)],
      ['التصنيف', r.archive ? d.archiveLabel(r) : d.categoryLabel(r)],
      ['صاحب العمل', r.owner],
      ['السنة', r.year],
      ['تاريخ الإضافة', A.utils.formatDate(r.createdAt)],
      ['آخر تحديث', A.utils.formatDate(r.updatedAt)]
    ].filter((row) => row[1]);

    const act = actions(r);

    const html =
      A.ui.crumbs({ fallback: parent, trail }) +
      '<div class="detail' + (act.bar ? ' has-action-bar' : '') + '">' +
        '<header class="detail__head">' +
          '<span class="eyebrow">' + (r.archive ? 'AI CLUB · ARCHIVE' : 'AI CLUB · RESOURCE') + '</span>' +
          '<div class="detail__title-row">' +
            '<h1 class="detail__title">' + esc(r.title) + '</h1>' +
            '<button type="button" class="icon-btn" data-action="copy-link" aria-label="نسخ رابط المورد" title="نسخ رابط المورد">' + icon('link') + '</button>' +
          '</div>' +
          '<div class="tag-list">' +
            [d.locationLabel(r), d.typeLabel(r.type), r.format].filter(Boolean).map((t) => '<span class="tag">' + esc(t) + '</span>').join('') +
            (r.archive ? '<span class="badge badge--muted">' + icon('eye') + 'للمشاهدة فقط</span>' : '') +
          '</div>' +
          (r.description ? '<p class="detail__desc">' + esc(r.description) + '</p>' : '') +
        '</header>' +
        '<div class="detail__preview">' + previewHtml(r) + '</div>' +
        '<section class="detail__info" aria-label="تفاصيل">' +
          '<dl class="meta-list">' + metaRows.map((m) => '<div><dt>' + esc(m[0]) + '</dt><dd>' +
            // a year range like "2025 – 2026" must read left to right
            (m[0] === 'السنة' ? '<bdi dir="ltr">' + esc(m[1]) + '</bdi>' : esc(m[1])) + '</dd></div>').join('') + '</dl>' +
          (act.block ? '<div class="detail__block">' + act.block + '</div>' : '') +
        '</section>' +
        (act.bar
          ? '<div class="action-bar">' + act.bar.join('') +
              (act.note ? '<p class="action-bar__note">' + icon('info') + esc(act.note) + '</p>' : '') +
            '</div>'
          : '') +
        '<div class="detail__feedback">' +
          '<button type="button" class="link-btn" data-action="feedback">' + icon('message') + '<span>عندك ملاحظة على هذا المورد؟</span></button>' +
        '</div>' +
      '</div>';

    const view = A.ui.mount(html, r.title);
    view.addEventListener('click', async (e) => {
      if (e.target.closest('[data-action="feedback"]')) { openFeedback(r, e.target.closest('[data-action="feedback"]')); return; }
      const b = e.target.closest('[data-action="copy-link"], [data-action="copy-text"]');
      if (!b) return;
      const isText = b.dataset.action === 'copy-text';
      const ok = await A.ui.copyText(isText ? r.text : location.href);
      A.ui.toast(ok ? (isText ? 'تم نسخ النص' : 'تم نسخ رابط المورد') : 'تعذّر النسخ، حاول مرة ثانية');
    });
  };
})(window.AIClub);
