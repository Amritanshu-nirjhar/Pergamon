// The Reader: full public-domain texts, bundled in /public/books, read as one long scroll or as turning pages.
// Positions, bookmarks and highlights are saved per book.
import gsap from 'gsap';
import {toast} from './toast.js';

const $ = s => document.querySelector(s);
const esc = s => s.replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'})[c]);
const inline = s => esc(s).replace(/_([^_]+)_/g, '<em>$1</em>'); // Gutenberg marks italics with _underscores_
export const borrowUrl = b => `https://openlibrary.org/search?q=${encodeURIComponent(`${b.t} ${b.a}`)}`;
export const store = {
  get: (k, d) => { try { return JSON.parse(localStorage.getItem('pergamon:' + k)) ?? d } catch { return d } },
  set: (k, v) => { try { localStorage.setItem('pergamon:' + k, JSON.stringify(v)) } catch {} },
};
const WPM = 250;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const plain = s => s.replace(/_/g, '');

// Wrap the first case-insensitive occurrence of `text` inside `root` in a <mark>, even across <em> boundaries.
function markText(root, text, cls, id) {
  const nodes = [], walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let all = '';
  while (walk.nextNode()) { nodes.push([walk.currentNode, all.length]); all += walk.currentNode.data }
  const at = all.toLowerCase().indexOf(text.toLowerCase());
  if (at < 0 || !text) return null;
  const find = pos => { for (let k = nodes.length - 1; k >= 0; k--) if (nodes[k][1] <= pos) return [nodes[k][0], pos - nodes[k][1]] };
  const r = document.createRange();
  r.setStart(...find(at)); r.setEnd(...find(at + text.length));
  const m = document.createElement('mark');
  m.className = cls;
  if (id) m.dataset.h = id;
  m.appendChild(r.extractContents()); r.insertNode(m);
  return m;
}

export function createReader({onToggle, onTurn, onChapter}) {
  const reader = $('#reader'), text = $('#rText'), toc = $('#rToc'), bar = reader.querySelector('.r-bar');
  const spread = $('#rSpread'), [L, R] = spread.querySelectorAll('.slot'), leaf = spread.querySelector('.r-leaf');
  const [front, back] = leaf.querySelectorAll('.r-face'), measure = $('#rMeasure .r-pc'), hlBtn = $('#rHl');
  let book, data, ch = 0, saveT, isOpen = false, total = 0;
  let pages = [], paraPage = [], pg = 0, per = 1, turning = null;

  const prefs = {size: 20, theme: 'night', mode: 'scroll', ...store.get('prefs', {})};
  const paged = () => prefs.mode === 'pages';
  const applyPrefs = () => {
    reader.dataset.theme = prefs.theme;
    reader.style.setProperty('--size', prefs.size + 'px');
    reader.classList.toggle('paged', paged());
    reader.querySelectorAll('[data-theme-set]').forEach(b => b.setAttribute('aria-pressed', b.dataset.themeSet === prefs.theme));
    reader.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', b.dataset.mode === prefs.mode));
    $('#rSizeVal').textContent = prefs.size;
    store.set('prefs', prefs);
  };
  applyPrefs();
  // any change that moves text around keeps the reader at the same point in the chapter
  function relayout(change) {
    turning?.progress(1); // land any page mid-flight before measuring where we are
    const y = data ? where() : 0;
    change?.();
    applyPrefs();
    if (!data) return;
    if (paged()) paginate();
    place({y});
  }

  function show() {
    if (isOpen) return;
    isOpen = true; reader.hidden = false; onToggle(true);
    gsap.fromTo(reader, {clipPath: 'inset(100% 0 0 0)'}, {clipPath: 'inset(0% 0 0 0)', duration: .9, ease: 'expo.inOut'});
    reader.querySelector('[data-close]').focus({preventScroll: true});
  }
  function hide() {
    isOpen = false;
    toggleToc(false); togglePrefs(false); hlBtn.hidden = true;
    gsap.to(reader, {clipPath: 'inset(0 0 100% 0)', duration: .7, ease: 'expo.inOut', onComplete: () => { reader.hidden = true; onToggle(false) }});
  }

  // ---------- rendering ----------
  const label = k => { const c = data.chapters[k]; return `${c.part ? c.part + ' · ' : ''}${c.t}` };
  const para = (i, t, cls = '') => `<p data-i="${i}"${cls ? ` class="${cls.trim()}"` : ''}>${inline(t)}</p>`;
  const pcClass = () => 'r-pc r-text' + (data.verse ? ' verse' : '');

  function render(k, pos = {y: 0}) {
    const prev = ch, had = !!text.querySelector('p[data-i]');
    ch = clamp(k, 0, data.chapters.length - 1);
    const c = data.chapters[ch], n = data.chapters.length;
    total = c.p.reduce((s, p) => s + p.split(/\s+/).length, 0);
    $('#rPart').textContent = c.part || data.t;
    $('#rHead').textContent = c.t;
    $('#rSub').textContent = c.s;
    $('#rSub').hidden = !c.s;
    $('#rChap').textContent = label(ch);
    $('#rPrev').disabled = ch === 0;
    $('#rNext').disabled = ch === n - 1;
    reader.querySelectorAll('[data-chap]').forEach(b => b.disabled = +b.dataset.chap < 0 ? ch === 0 : ch === n - 1);
    text.classList.toggle('verse', data.verse);
    text.innerHTML = c.p.map((p, i) => para(i, p, i === 0 && !data.verse ? 'dc' : '')).join('');
    decorate(text);
    $('#rTocList').querySelectorAll('button').forEach((b, i) => b.setAttribute('aria-current', i === ch));
    if (paged()) paginate();
    place(pos);
    gsap.fromTo(paged() ? spread : '#rArticle', {autoAlpha: 0, y: 24}, {autoAlpha: 1, y: 0, duration: .7, ease: 'expo.out'});
    if (had && prev !== ch) onTurn?.();
    onChapter?.(book, ch);
  }

  // jump to a position: {y} = fraction through the chapter, or {para, find} = a paragraph (and a phrase to flash)
  function place(pos) {
    turning?.progress(1);
    if (paged()) {
      const p = pos.para != null ? paraPage[pos.para] ?? 0 : Math.floor((pos.y || 0) * pages.length);
      pg = clamp(p - p % per, 0, Math.max(0, pages.length - 1 - (pages.length - 1) % per));
      showSpread();
      if (pos.find) spread.querySelectorAll(`.slot p[data-i="${pos.para}"]`).forEach(p => markText(p, pos.find, 'find'));
    } else if (pos.para != null) {
      const p = text.querySelector(`p[data-i="${pos.para}"]`);
      p?.scrollIntoView({block: 'center'});
      if (p && pos.find) markText(p, pos.find, 'find');
    } else reader.scrollTop = (pos.y || 0) * (reader.scrollHeight - reader.clientHeight);
    progress();
  }
  const where = () => paged() ? (pages.length ? pg / pages.length : 0)
    : (reader.scrollHeight > reader.clientHeight ? reader.scrollTop / (reader.scrollHeight - reader.clientHeight) : 0);

  function progress() {
    if (!data) return;
    const y = where(), n = data.chapters.length;
    const seen = paged() ? Math.min(1, (pg + per) / pages.length) : y;
    const min = Math.ceil(total * (1 - seen) / WPM);
    const left = min < 1 ? 'end of chapter' : `≈ ${min} min left in chapter`;
    reader.style.setProperty('--prog', (ch + y) / n);
    $('#rLeft').textContent = left;
    $('#rPos').textContent = `${ch + 1} / ${n} · ${left}`;
    spread.style.setProperty('--done', seen.toFixed(3));
    if (paged()) $('#rPStat').textContent = `Page ${pg + 1}${per === 2 && pg + 1 < pages.length ? '–' + (pg + 2) : ''} of ${pages.length} · ${left}`;
    clearTimeout(saveT);
    saveT = setTimeout(() => { store.set('pos:' + book.pg, {ch, y, n, t: Date.now()}); updateMark() }, 250);
  }
  reader.addEventListener('scroll', () => data && !paged() && progress(), {passive: true});

  // ---------- pages ----------
  // Fill a page-sized box paragraph by paragraph; a paragraph that overflows is split at the last word that fits.
  function paginate() {
    per = innerWidth > 900 ? 2 : 1;
    reader.style.setProperty('--barh', bar.offsetHeight + 'px');
    spread.style.setProperty('--per', per); reader.style.setProperty('--per', per);
    spread.classList.toggle('single', per === 1);
    R.hidden = per === 1;
    const c = data.chapters[ch];
    measure.className = pcClass();
    const H = measure.clientHeight, over = () => measure.scrollHeight > H + 1;
    pages = []; paraPage = [];
    let cur = `<header class="r-phead"><p class="kicker">${esc(c.part || data.t)}</p><h2>${esc(c.t)}</h2>${c.s ? `<p class="r-sub">${esc(c.s)}</p>` : ''}</header>`;
    measure.innerHTML = cur;
    const flush = () => { pages.push(cur); measure.innerHTML = cur = '' };
    c.p.forEach((p, i) => {
      let toks = p.split(' '), cont = false;
      paraPage[i] = pages.length;
      while (toks.length) {
        const cls = (cont ? ' pc-cont' : '') + (i === 0 && !cont && !data.verse ? ' dc' : '');
        const html = (n, cut) => para(i, toks.slice(0, n).join(' '), cls + (cut ? ' pc-cut' : ''));
        measure.insertAdjacentHTML('beforeend', html(toks.length));
        if (!over()) { cur += html(toks.length); break }
        measure.lastChild.remove();
        let lo = 0, hi = toks.length - 1;
        while (lo < hi) {
          const mid = (lo + hi + 1) >> 1;
          measure.insertAdjacentHTML('beforeend', html(mid, true));
          const ok = !over();
          measure.lastChild.remove();
          ok ? lo = mid : hi = mid - 1;
        }
        if (lo === 0 && cur) { flush(); if (!cont) paraPage[i] = pages.length; continue } // nothing fits: start a fresh page
        const n = Math.max(lo, 1);
        // an italic run cut by the page break is closed here and reopened on the next page
        if ((toks.slice(0, n).join(' ').match(/_/g) || []).length % 2) { toks[n - 1] += '_'; toks[n] = '_' + toks[n] }
        cur += html(n, true); flush();
        toks = toks.slice(n); cont = true;
      }
    });
    if (cur) pages.push(cur);
    measure.innerHTML = '';
  }
  function fill(el, k) {
    const pc = el.querySelector('.r-pc');
    pc.className = pcClass();
    pc.innerHTML = pages[k] ?? '';
    el.querySelector('.r-pn').textContent = pages[k] != null ? k + 1 : '';
    decorate(pc);
  }
  function showSpread() {
    fill(L, pg);
    if (per === 2) fill(R, pg + 1);
  }
  function turn(dir) {
    if (!data) return;
    turning?.progress(1);
    hlBtn.hidden = true;
    const to = pg + dir * per;
    if (to < 0) return ch > 0 && render(ch - 1, {y: 1});
    if (to >= pages.length) return ch < data.chapters.length - 1 && render(ch + 1);
    onTurn?.();
    if (reduce) { pg = to; showSpread(); progress(); return }
    // the leaf carries the outgoing page on its front and the incoming one on its back;
    // the pages it uncovers are swapped in underneath before it moves, the ones it lands on after
    let from = 0, end, origin = '0% 50%', left = '0%', land;
    if (dir > 0 && per === 2) { fill(front, pg + 1); fill(back, pg + 2); fill(R, pg + 3); left = '50%'; end = -180; land = L }
    else if (dir > 0) { fill(front, pg); fill(back, -1); fill(L, pg + 1); end = -180 }
    else if (per === 2) { fill(front, pg); fill(back, pg - 1); fill(L, pg - 2); origin = '100% 50%'; end = 180; land = R }
    else { fill(front, pg - 1); fill(back, -1); from = -180; end = 0; land = L }
    gsap.set(leaf, {display: 'block', left, transformOrigin: origin, rotateY: from, opacity: 1});
    turning = gsap.to(leaf, {
      rotateY: end, duration: .95, ease: 'power2.inOut',
      onUpdate() {
        const a = Math.abs(gsap.getProperty(leaf, 'rotateY')) / 180, s = Math.sin(a * Math.PI);
        spread.style.setProperty('--s', s.toFixed(3));
        if (per === 1) leaf.style.opacity = clamp(1 - (a - .5) * 2, 0, 1); // a single page lifts away rather than landing
      },
      onComplete() {
        pg = to;
        if (land) fill(land, land === L ? pg : pg + 1);
        gsap.set(leaf, {display: 'none'});
        spread.style.setProperty('--s', 0);
        turning = null;
        progress();
      },
    });
  }
  // click or tap the right half to go forward, left half to go back; swipe on touch
  let down;
  spread.addEventListener('pointerdown', e => down = e);
  spread.addEventListener('pointerup', e => {
    if (!down || e.target.closest('mark.hl, a, button')) return;
    const dx = e.clientX - down.clientX;
    if (e.pointerType === 'touch' && Math.abs(dx) > 40) return turn(dx < 0 ? 1 : -1);
    if (Math.abs(dx) > 6 || !getSelection().isCollapsed) return;
    const r = spread.getBoundingClientRect();
    turn(e.clientX > r.left + r.width / 2 ? 1 : -1);
  });

  // ---------- highlights ----------
  const hls = () => store.get('hl:' + book.pg, []);
  function decorate(root) {
    for (const h of hls()) if (h.ch === ch) root.querySelectorAll(`p[data-i="${h.i}"]`).forEach(p => markText(p, h.text, 'hl', h.id));
  }
  let pending;
  const pin = (r, label, mode) => {
    hlBtn.textContent = label; hlBtn.dataset.mode = mode; hlBtn.hidden = false;
    hlBtn.style.left = r.left + r.width / 2 + 'px'; hlBtn.style.top = r.top - 10 + 'px';
  };
  reader.addEventListener('pointerup', e => {
    if (e.target.closest('#rHl')) return;
    setTimeout(() => {
      const mark = e.target.closest('mark.hl'), sel = getSelection();
      if (mark && sel.isCollapsed) { pending = mark.dataset.h; return pin(mark.getBoundingClientRect(), 'Remove highlight', 'remove') }
      const node = n => n && (n.nodeType === 3 ? n.parentElement : n).closest('p[data-i]');
      const p = !sel.isCollapsed && node(sel.anchorNode);
      if (!p || p !== node(sel.focusNode) || !reader.contains(p)) return hlBtn.hidden = true;
      pending = {ch, i: +p.dataset.i, text: sel.toString().trim(), id: String(Date.now())};
      if (pending.text.length > 1) pin(sel.getRangeAt(0).getBoundingClientRect(), 'Highlight', 'add');
    });
  });
  hlBtn.addEventListener('mousedown', e => e.preventDefault()); // keep the selection alive
  hlBtn.addEventListener('click', () => {
    const list = hls();
    if (hlBtn.dataset.mode === 'add') {
      list.push(pending);
      reader.querySelectorAll(`.r-text p[data-i="${pending.i}"]`).forEach(p => markText(p, pending.text, 'hl', pending.id));
      getSelection().removeAllRanges();
      toast('Highlighted');
    } else {
      list.splice(list.findIndex(h => h.id === pending), 1);
      reader.querySelectorAll(`mark.hl[data-h="${pending}"]`).forEach(m => m.replaceWith(...m.childNodes));
      toast('Highlight removed');
    }
    store.set('hl:' + book.pg, list);
    hlBtn.hidden = true;
    renderMarks();
  });

  // ---------- bookmarks ----------
  const bms = () => store.get('bm:' + book.pg, []);
  const near = m => m.ch === ch && Math.abs(m.y - where()) < .03;
  const updateMark = () => $('#rMark').setAttribute('aria-pressed', bms().some(near));
  function snippet() {
    if (paged()) return L.querySelector('p')?.textContent ?? '';
    const top = bar.getBoundingClientRect().bottom;
    return [...text.children].find(p => p.getBoundingClientRect().bottom > top)?.textContent ?? '';
  }
  function toggleMark() {
    const list = bms(), at = list.findIndex(near);
    if (at >= 0) list.splice(at, 1);
    else list.push({ch, y: where(), s: snippet().slice(0, 110), t: Date.now()});
    toast(at >= 0 ? 'Bookmark removed' : 'Bookmark added');
    store.set('bm:' + book.pg, list.sort((a, b) => a.ch - b.ch || a.y - b.y));
    updateMark(); renderMarks();
  }
  function renderMarks() {
    const none = s => `<li class="r-none">${s}</li>`;
    $('#rBms').innerHTML = bms().map((m, k) => `<li class="r-li"><button data-go-ch="${m.ch}" data-go-y="${m.y}"><span class="mono">${esc(label(m.ch))} · ${Math.round(m.y * 100)}%</span>${esc(m.s)}…</button><button class="x" data-rm-bm="${k}" aria-label="Remove bookmark">×</button></li>`).join('')
      || none('No bookmarks yet. Use the ribbon in the top bar to keep your place.');
    $('#rHls').innerHTML = hls().sort((a, b) => a.ch - b.ch || a.i - b.i).map(h => `<li class="r-li"><button data-go-ch="${h.ch}" data-go-para="${h.i}"><span class="mono">${esc(label(h.ch))}</span><mark class="hl">${esc(h.text.slice(0, 160))}</mark></button><button class="x" data-rm-hl="${h.id}" aria-label="Remove highlight">×</button></li>`).join('')
      || none('Select any passage while reading to highlight it.');
  }

  // ---------- search inside the book ----------
  let findT;
  $('#rFind').addEventListener('input', e => { clearTimeout(findT); findT = setTimeout(() => find(e.target.value.trim()), 200) });
  function find(q) {
    const out = $('#rHits');
    if (!data || q.length < 3) return out.innerHTML = '';
    const ql = q.toLowerCase(), hits = [];
    // ponytail: linear scan of the whole book, fine for one book (~600k words); index it if this ever spans books
    scan: for (const [k, c] of data.chapters.entries()) for (const [i, p] of c.p.entries()) {
      const s = plain(p), at = s.toLowerCase().indexOf(ql);
      if (at >= 0) hits.push({k, i, s, at});
      if (hits.length >= 120) break scan;
    }
    out.innerHTML = `<p class="mono r-count">${hits.length >= 120 ? '120+' : hits.length || 'No'} match${hits.length === 1 ? '' : 'es'}</p><ol>` +
      hits.map(({k, i, s, at}) => `<li><button data-go-ch="${k}" data-go-para="${i}" data-go-find="${esc(q)}"><span class="mono">${esc(label(k))}</span>${at > 60 ? '…' : ''}${esc(s.slice(Math.max(0, at - 60), at))}<b>${esc(s.slice(at, at + q.length))}</b>${esc(s.slice(at + q.length, at + q.length + 90))}…</button></li>`).join('') + '</ol>';
  }
  const go = (k, pos) => k === ch ? place(pos) : render(k, pos);

  // ---------- open ----------
  async function open(b, opts = {}) {
    if (!b.pg) return window.open(borrowUrl(b), '_blank', 'noopener');
    book = b;
    reader.style.setProperty('--accent-r', b.acc);
    $('#rBook').textContent = b.t;
    text.innerHTML = '<p class="r-loading">Opening the book…</p>';
    L.querySelector('.r-pc').innerHTML = R.querySelector('.r-pc').innerHTML = '';
    $('#rPStat').textContent = 'Opening the book…';
    $('#rFind').value = ''; $('#rHits').innerHTML = '';
    show();
    data = null;
    try {
      data = await (await fetch(`${import.meta.env.BASE_URL}books/${b.pg}.json`)).json();
    } catch {
      text.innerHTML = L.querySelector('.r-pc').innerHTML = `<p class="r-loading">Couldn’t load this book. <a href="https://www.gutenberg.org/ebooks/${b.pg}" target="_blank" rel="noopener">Read it on Project Gutenberg ↗</a></p>`;
      return;
    }
    $('#rSrc').href = data.src;
    $('#rTocList').innerHTML = '<ol>' + data.chapters.map((c, i) =>
      `<li><button data-ch="${i}">${c.part && (i === 0 || data.chapters[i - 1].part !== c.part) ? `<span class="kicker">${esc(c.part)}</span>` : ''}${esc(c.t)}${c.s ? ` <em>${esc(c.s)}</em>` : ''}</button></li>`).join('') + '</ol>';
    renderMarks();
    // first visit starts at the story itself; prefaces stay one click away in Contents
    const start = Math.max(0, data.chapters.findIndex(c => c.t !== 'Opening pages'));
    const pos = opts.ch != null ? {ch: opts.ch, y: 0} : store.get('pos:' + b.pg, {ch: start, y: 0});
    requestAnimationFrame(() => render(pos.ch, {y: pos.y}));
  }

  // ---------- controls ----------
  reader.addEventListener('click', e => {
    const t = e.target.closest('button');
    if (!t || t.id === 'rHl') return;
    const d = t.dataset;
    if (d.close !== undefined) hide();
    else if (d.ch) { render(+d.ch); toggleToc(false) }
    else if (d.goCh) { go(+d.goCh, d.goPara ? {para: +d.goPara, find: d.goFind} : {y: +d.goY}); toggleToc(false) }
    else if (d.rmBm) { const l = bms(); l.splice(+d.rmBm, 1); store.set('bm:' + book.pg, l); renderMarks(); updateMark(); toast('Bookmark removed') }
    else if (d.rmHl) { pending = d.rmHl; hlBtn.dataset.mode = 'remove'; hlBtn.click() }
    else if (d.tab) {
      toc.querySelectorAll('[data-tab]').forEach(b => b.setAttribute('aria-selected', b === t));
      toc.querySelectorAll('[data-pane]').forEach(p => p.hidden = p.dataset.pane !== d.tab);
      if (d.tab === 'search') $('#rFind').focus();
    }
    else if (d.chap) render(ch + +d.chap);
    else if (d.mode) relayout(() => prefs.mode = d.mode);
    else if (t.id === 'rMark') toggleMark();
    else if (t.id === 'rPrev') render(ch - 1);
    else if (t.id === 'rNext') render(ch + 1);
    else if (t.id === 'rTocBtn') toggleToc();
    else if (t.id === 'rAa') togglePrefs();
    else if (t.id === 'rSmaller') relayout(() => prefs.size = Math.max(16, prefs.size - 1));
    else if (t.id === 'rBigger') relayout(() => prefs.size = Math.min(28, prefs.size + 1));
    else if (d.themeSet) relayout(() => prefs.theme = d.themeSet);
  });
  // reading settings live in one small popover under the "Aa" button
  const prefsEl = $('#rPrefs'), aa = $('#rAa');
  function togglePrefs(v = prefsEl.hidden) {
    if (v === !prefsEl.hidden) return;
    aa.setAttribute('aria-expanded', v);
    if (v) {
      prefsEl.hidden = false;
      gsap.fromTo(prefsEl, {autoAlpha: 0, scale: .92, y: -6}, {autoAlpha: 1, scale: 1, y: 0, duration: reduce ? 0 : .35, ease: 'expo.out'});
      prefsEl.querySelector('[aria-pressed="true"]')?.focus({preventScroll: true});
    } else gsap.to(prefsEl, {autoAlpha: 0, scale: .96, duration: reduce ? 0 : .18, ease: 'power2.in', onComplete: () => prefsEl.hidden = true});
  }
  addEventListener('pointerdown', e => !prefsEl.hidden && !e.target.closest('.r-aa-wrap') && togglePrefs(false));
  function toggleToc(v = toc.hidden) {
    toc.hidden = !v;
    $('#rTocBtn').setAttribute('aria-expanded', v);
    if (v) toc.querySelector('[aria-current="true"]')?.scrollIntoView({block: 'center'});
  }
  addEventListener('keydown', e => {
    if (!isOpen) return;
    if (e.key === 'Escape') { if (!prefsEl.hidden) { togglePrefs(false); aa.focus() } else if (!hlBtn.hidden) hlBtn.hidden = true; else if (!toc.hidden) toggleToc(false); else hide() }
    if (!data || e.target.closest?.('input') || !/^Arrow(Left|Right)$/.test(e.key)) return;
    const dir = e.key === 'ArrowRight' ? 1 : -1;
    if (paged()) turn(dir);
    else if (ch + dir >= 0 && ch + dir < data.chapters.length) render(ch + dir);
  });
  let rzT;
  addEventListener('resize', () => { clearTimeout(rzT); rzT = setTimeout(() => isOpen && data && paged() && relayout(), 200) });

  return {open, isOpen: () => isOpen};
}
