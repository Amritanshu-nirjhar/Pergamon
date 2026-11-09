// The Great Library at the end of the page: search, filter, sort, three ways to browse.
import gsap from 'gsap';
import {Flip} from 'gsap/Flip';
import {ScrollTrigger} from 'gsap/ScrollTrigger';
import {SplitText} from 'gsap/SplitText';
import {LIBRARY, KINDS, ERAS, COLLECTIONS, yearOf, slug} from './catalog.js';
import {paintThumb} from './covers.js';
import {store} from './reader.js';
import {createViewer} from './viewer.js';

gsap.registerPlugin(Flip);
const $ = (s, el = document) => el.querySelector(s);
const pad = n => String(n).padStart(2, '0');
const esc = s => s.replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'})[c]);
const sortKey = t => t.replace(/^(The|A|An) /, '');
const lastName = a => a.split('·')[0].trim().split(' ').pop();
const R = gsap.utils.random, clamp = gsap.utils.clamp;

export async function createShelf({reader, lenis, reduce, sfx, onViewer, onState}) {
  const list = $('#bItems'), count = $('#bCount'), empty = $('#bEmpty'), search = $('#bSearch'), sort = $('#bSort');
  const stats = await fetch(`${import.meta.env.BASE_URL}books/index.json`).then(r => r.json()).catch(() => ({}));
  const words = b => stats[b.pg]?.w ?? (b.p ? b.p * 280 : 90000);
  const hours = b => Math.max(1, Math.round(words(b) / 250 / 60));
  const state = {q: '', avail: 'all', kind: 'all', era: 'all', col: '', sort: 'curated', view: store.get('view', 'shelf')};
  const viewer = createViewer({reader, sfx, reduce, onToggle: onViewer,
    info: b => ({words: words(b), hours: hours(b), chapters: stats[b.pg]?.c})});

  // ---------- controls ----------
  const chips = (group, opts) => $(`[data-group="${group}"]`).innerHTML = opts.map(([v, label], i) =>
    `<button data-v="${v}" aria-pressed="${i === 0}">${label}</button>`).join('');
  chips('avail', [['all', 'Everything'], ['read', 'Read here, free'], ['borrow', 'Borrow']]);
  chips('kind', [['all', 'All kinds'], ...KINDS.map(k => [k, k])]);
  chips('era', [['all', 'All eras'], ...ERAS.map(([e]) => [e, e])]);
  document.querySelectorAll('[data-group="view"] button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === state.view));
  // collections: each card fans out a few of its spines
  $('#bCols').innerHTML = COLLECTIONS.map(c => {
    const books = LIBRARY.filter(b => c.has(b, hours(b)));
    return `<button class="col" data-col="${c.id}" aria-pressed="false">
      <span class="col-fan" aria-hidden="true">${books.slice(0, 5).map((b, k) => `<i style="--c:${b.bg};--a:${b.acc};--k:${k}"></i>`).join('')}</span>
      <span class="col-t">${c.t}</span><span class="col-d">${c.d}</span><span class="col-n mono">${books.length} books</span>
    </button>`;
  }).join('');

  // ---------- items: one element per book, styled three ways ----------
  list.innerHTML = LIBRARY.map(b => {
    const h = 214 + (b.i * 37 % 5) * 12 + (b.fmt === 'tall' ? 22 : 0), w = Math.round(Math.min(74, Math.max(30, 20 + words(b) / 9000)));
    return `<li class="item" data-id="${b.i}" data-year="${b.y}" data-kind="${b.pg ? 'read' : 'borrow'}" style="--bg:${b.bg};--ink:${b.ink};--acc:${b.acc};--h:${h}px;--w:${w}px">
      <button class="bk" data-lib="${b.i}" aria-label="${b.pg ? 'Read' : 'Borrow'} ${esc(b.t)} by ${esc(b.a)}">
        <span class="spine${b.fx === 'foil' ? ' foil' : ''}" aria-hidden="true"><span class="sp-t${b.t.length > 22 ? ' long' : ''}">${esc(b.t)}</span><span class="sp-a">${esc(lastName(b.a))}</span></span>
        <span class="cover" aria-hidden="true"><img alt=""></span>
        <span class="meta">
          <span class="m-n mono">${pad(b.i + 1)}</span>
          <span class="m-t">${esc(b.t)}</span>
          <span class="m-a">${esc(b.a)}</span>
          <span class="m-y mono">${b.y}</span>
          <span class="m-k mono">${b.k}</span>
          <span class="m-h mono">≈ ${hours(b)} h</span>
          <span class="m-act mono">${b.pg ? 'Read →' : 'Borrow ↗'}</span>
        </span>
      </button>
    </li>`;
  }).join('');
  const items = [...list.children], byId = Object.fromEntries(items.map(el => [el.dataset.id, el]));

  // covers are painted only when they scroll near the viewport, one per frame so scrolling never stalls
  const queue = [];
  const drain = () => {
    const img = queue.shift();
    if (!img) return;
    img.src = paintThumb(LIBRARY[+img.closest('.item').dataset.id]).toDataURL('image/jpeg', .85);
    requestAnimationFrame(drain);
  };
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    io.unobserve(e.target);
    if (queue.push(e.target) === 1) requestAnimationFrame(drain);
  }), {rootMargin: '600px'});
  const watchCovers = () => state.view === 'covers' && items.forEach(el => { const img = $('img', el); if (!img.src) io.observe(img) });

  // ---------- filter + sort, animated with Flip ----------
  const era = b => { const y = yearOf(b); return ERAS.find(([, a, z]) => y >= a && y < z)[0] };
  const match = b => (state.avail === 'all' || (state.avail === 'read') === !!b.pg)
    && (state.kind === 'all' || b.k === state.kind) && (state.era === 'all' || era(b) === state.era)
    && (!state.col || COLLECTIONS.find(c => c.id === state.col).has(b, hours(b)))
    && (!state.q || `${b.t} ${b.a} ${b.g} ${b.k}`.toLowerCase().includes(state.q));
  const SORTS = {
    curated: (a, b) => a.i - b.i, title: (a, b) => sortKey(a.t).localeCompare(sortKey(b.t)),
    author: (a, b) => lastName(a.a).localeCompare(lastName(b.a)), oldest: (a, b) => yearOf(a) - yearOf(b),
    newest: (a, b) => yearOf(b) - yearOf(a), shortest: (a, b) => words(a) - words(b), longest: (a, b) => words(b) - words(a),
  };
  function apply(animate = true) {
    const tl = state.view === 'timeline';
    const shown = LIBRARY.filter(match).sort(tl ? SORTS.oldest : SORTS[state.sort]);
    sort.disabled = tl;
    // timeline: the gap between neighbours grows with the years between them, and each era is labelled where it begins
    let prevY, prevEra;
    shown.forEach(b => {
      const el = byId[b.i], y = yearOf(b), e = era(b);
      el.style.setProperty('--gap', tl && prevY !== undefined ? Math.round(4 + Math.min(150, Math.sqrt(y - prevY) * 7)) + 'px' : '0px');
      if (tl && e !== prevEra) el.dataset.era = e; else delete el.dataset.era;
      prevY = y; prevEra = e;
    });
    const flip = animate && !reduce ? Flip.getState(items) : null;
    const keep = new Set(shown.map(b => String(b.i)));
    items.forEach(el => el.hidden = !keep.has(el.dataset.id));
    shown.forEach(b => list.appendChild(byId[b.i]));
    const readable = shown.filter(b => b.pg).length;
    const col = COLLECTIONS.find(c => c.id === state.col);
    count.textContent = `${shown.length} of ${LIBRARY.length} books · ${readable} readable here${col ? ` · in “${col.t}”` : ''}`;
    empty.hidden = shown.length > 0;
    const active = ['avail', 'kind', 'era', 'col'].filter(k => state[k] && state[k] !== 'all').length;
    $('#bFilterN').textContent = active ? `· ${active}` : '';
    scrub();
    watchCovers();
    if (flip) Flip.from(flip, {
      duration: .75, ease: 'power3.inOut', absolute: true, stagger: .006,
      onEnter: els => gsap.fromTo(els, {opacity: 0, scale: .6, y: 30}, {opacity: 1, scale: 1, y: 0, duration: .6, ease: 'back.out(1.7)', stagger: .01}),
      onLeave: els => gsap.to(els, {opacity: 0, scale: .6, duration: .35, ease: 'power2.in'}),
    });
  }

  // each view arrives with its own motion: books drop onto shelves, covers swing open, catalogue rows wipe in
  function enter() {
    if (reduce) return;
    const vis = items.filter(el => !el.hidden).slice(0, state.view === 'timeline' ? 30 : 60);
    if (state.view === 'shelf') gsap.fromTo(vis.map(el => $('.spine', el)), {yPercent: -140, rotate: () => R(-14, 14), opacity: 0},
      {yPercent: 0, rotate: 0, opacity: 1, duration: 1, ease: 'bounce.out', clearProps: 'transform',
        stagger: {each: .018, from: 'random', onStart: () => gsap.delayedCall(.36, () => sfx.thud(.3))}});
    if (state.view === 'timeline') gsap.fromTo(vis.map(el => $('.spine', el)), {scaleY: 0, transformOrigin: '50% 100%'},
      {scaleY: 1, duration: 1.2, ease: 'expo.out', stagger: .03, clearProps: 'transform'});
    if (state.view === 'covers') gsap.fromTo(vis.map(el => $('.cover', el)), {rotateY: -100, opacity: 0, transformOrigin: '0% 50%', transformPerspective: 900},
      {rotateY: 0, opacity: 1, duration: 1.1, ease: 'expo.out', stagger: .025, clearProps: 'transform'});
    if (state.view === 'catalogue') gsap.fromTo(vis.map(el => $('.bk', el)), {clipPath: 'inset(0 100% 0 0)'},
      {clipPath: 'inset(0 0% 0 0)', duration: .9, ease: 'expo.out', stagger: .012, clearProps: 'clipPath'});
  }
  function setView(v) {
    state.view = v; store.set('view', v);
    document.querySelectorAll('[data-group="view"] button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === v));
    gsap.to(list, {opacity: 0, duration: reduce ? 0 : .25, onComplete: () => {
      list.dataset.view = v; list.scrollLeft = 0; apply(false); gsap.set(list, {opacity: 1}); enter();
    }});
  }
  list.dataset.view = state.view;

  document.querySelector('.b-controls').addEventListener('click', e => {
    const b = e.target.closest('button[data-v]');
    if (!b) return;
    const group = b.parentElement.dataset.group;
    if (group === 'view') return setView(b.dataset.v), emit();
    b.parentElement.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b));
    state[group] = b.dataset.v;
    apply(); emit(); toList();
  });
  $('#bCols').addEventListener('click', e => {
    const b = e.target.closest('[data-col]');
    if (!b) return;
    state.col = state.col === b.dataset.col ? '' : b.dataset.col;
    syncControls(); apply(); emit();
    lenis.scrollTo('.b-meta', {offset: -120, duration: 1.2});
  });
  // ---------- the toolbar: sticks (compact) while browsing; filters live in a panel ----------
  const controls = $('.b-controls'), fBtn = $('#bFilterBtn'), fPanel = $('#bFilters');
  ScrollTrigger.create({trigger: controls, start: 'top 78px', endTrigger: list, end: 'bottom 200px', toggleClass: 'stuck'});
  const toList = () => controls.classList.contains('stuck') && lenis.scrollTo(list, {offset: -controls.offsetHeight - 100, duration: .9});
  fBtn.addEventListener('click', () => {
    const open = fPanel.hidden;
    fBtn.setAttribute('aria-expanded', open);
    if (open) {
      fPanel.hidden = false;
      if (!reduce) gsap.fromTo(fPanel, {height: 0, opacity: 0}, {height: 'auto', opacity: 1, duration: .6, ease: 'expo.out', clearProps: 'height'});
    } else if (reduce) fPanel.hidden = true;
    else gsap.to(fPanel, {height: 0, opacity: 0, duration: .4, ease: 'power3.inOut', onComplete: () => { fPanel.hidden = true; gsap.set(fPanel, {clearProps: 'all'}) }});
  });

  // ---------- timeline scrubber: where you are, and a jump to each era ----------
  const scrubEl = $('#tlScrub'), thumb = $('.tl-thumb', scrubEl), erasEl = $('.tl-eras', scrubEl);
  function scrub() {
    scrubEl.hidden = state.view !== 'timeline';
    if (scrubEl.hidden) return;
    requestAnimationFrame(() => {
      const W = list.scrollWidth || 1;
      erasEl.innerHTML = items.filter(el => !el.hidden && el.dataset.era).map(el =>
        `<button data-to="${el.dataset.id}" style="left:${(el.offsetLeft / W * 100).toFixed(2)}%">${el.dataset.era}</button>`).join('');
      moveThumb();
    });
  }
  const moveThumb = () => {
    const W = list.scrollWidth || 1;
    thumb.style.left = (list.scrollLeft / W * 100) + '%';
    thumb.style.width = (list.clientWidth / W * 100) + '%';
  };
  list.addEventListener('scroll', () => state.view === 'timeline' && moveThumb(), {passive: true});
  addEventListener('resize', scrub);
  scrubEl.addEventListener('click', e => {
    const era = e.target.closest('[data-to]'), W = list.scrollWidth;
    const x = era ? byId[era.dataset.to].offsetLeft - 60
      : (e.clientX - $('.tl-track', scrubEl).getBoundingClientRect().left) / $('.tl-track', scrubEl).offsetWidth * W - list.clientWidth / 2;
    gsap.to(list, {scrollLeft: clamp(0, W - list.clientWidth, x), duration: reduce ? 0 : 1.1, ease: 'expo.inOut', overwrite: true});
  });

  // the filters as a query string, for share links
  const DEF = {q: '', avail: 'all', kind: 'all', era: 'all', col: '', sort: 'curated'};
  const emit = () => onState?.(new URLSearchParams(Object.entries({...state}).filter(([k, v]) => k !== 'view' ? v !== DEF[k] : true)).toString());
  function syncControls() {
    for (const g of ['avail', 'kind', 'era']) $(`[data-group="${g}"]`).querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x.dataset.v === state[g]));
    document.querySelectorAll('[data-col]').forEach(x => x.setAttribute('aria-pressed', x.dataset.col === state.col));
    search.value = state.q; sort.value = state.sort;
  }
  let qT;
  search.addEventListener('input', () => { clearTimeout(qT); qT = setTimeout(() => { state.q = search.value.trim().toLowerCase(); apply(); emit() }, 160) });
  sort.addEventListener('change', () => { state.sort = sort.value; apply(); emit() });
  $('#bReset').addEventListener('click', () => {
    Object.assign(state, {q: '', avail: 'all', kind: 'all', era: 'all', col: ''});
    syncControls(); apply(); emit();
  });

  // open a book from any view
  const face = el => state.view === 'covers' ? $('.cover', el) : state.view === 'catalogue' ? $('.bk', el) : $('.spine', el);
  list.addEventListener('click', e => {
    const b = e.target.closest('[data-lib]');
    if (!b || dragged) return;
    viewer.open(LIBRARY[+b.dataset.lib], face(b.closest('.item')));
  });

  // timeline: the wheel scrolls sideways (smoothly) until either end, then hands back to the page; mice can drag it
  let tlX = 0, tlTween, dragged = false;
  list.addEventListener('wheel', e => {
    if (state.view !== 'timeline' || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    if (!tlTween?.isActive()) tlX = list.scrollLeft;
    const next = clamp(0, list.scrollWidth - list.clientWidth, tlX + e.deltaY * 1.4);
    if (Math.abs(next - tlX) < 1) return;
    e.preventDefault(); e.stopPropagation();
    tlX = next;
    tlTween = gsap.to(list, {scrollLeft: tlX, duration: reduce ? 0 : .8, ease: 'power3.out', overwrite: true});
  }, {passive: false});
  list.addEventListener('pointerdown', e => {
    if (state.view !== 'timeline' || e.pointerType !== 'mouse') return;
    const x0 = e.clientX, s0 = list.scrollLeft;
    dragged = false;
    const move = m => { if (Math.abs(m.clientX - x0) > 5) dragged = true; list.scrollLeft = s0 - (m.clientX - x0) };
    const up = () => { removeEventListener('pointermove', move); setTimeout(() => dragged = false) };
    addEventListener('pointermove', move); addEventListener('pointerup', up, {once: true});
  });

  // covers lean toward the cursor
  let tilted;
  const untilt = el => el && gsap.to($('.cover', el), {rotateX: 0, rotateY: 0, duration: .6, ease: 'power3.out'});
  list.addEventListener('pointermove', e => {
    if (state.view !== 'covers' || reduce) return;
    const el = e.target.closest('.item');
    if (el !== tilted) { untilt(tilted); tilted = el }
    if (!el) return;
    const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
    gsap.to($('.cover', el), {rotateY: x * 24, rotateX: -y * 18, transformPerspective: 700, duration: .4, ease: 'power2.out'});
  });
  list.addEventListener('pointerleave', () => { untilt(tilted); tilted = null });

  // ✦ Surprise me: a roulette runs across the readable books on show, slows down, then opens the winner
  $('#bSurprise').addEventListener('click', () => {
    const pool = items.filter(el => !el.hidden && el.dataset.kind === 'read');
    if (!pool.length) return;
    const win = pool[Math.floor(Math.random() * pool.length)];
    const seq = [...Array(16)].map(() => pool[Math.floor(Math.random() * pool.length)]).concat(win);
    const tl = gsap.timeline();
    let t = 0;
    seq.forEach((el, k) => { t += .045 + k * k * .0018; tl.call(() => { items.forEach(x => x.classList.remove('pick')); el.classList.add('pick') }, null, t) });
    tl.call(() => lenis.scrollTo(win, {offset: -innerHeight / 2 + 150, duration: 1.1}), null, t + .1)
      .call(() => { win.classList.remove('pick'); viewer.open(LIBRARY[+win.dataset.id], face(win)) }, null, t + 1.4);
  });

  // ---------- continue reading ----------
  function refresh() {
    const rows = LIBRARY.filter(b => b.pg).map(b => ({b, p: store.get('pos:' + b.pg, null)})).filter(r => r.p?.n)
      .sort((a, z) => (z.p.t || 0) - (a.p.t || 0)).slice(0, 4);
    $('#bContinue').hidden = $('#fContinue').hidden = !rows.length;
    $('#bContinue .b-cont-row').innerHTML = $('#fContinue .b-cont-row').innerHTML = rows.map(({b, p}) => {
      const pct = Math.round((p.ch + p.y) / p.n * 100);
      return `<button class="cont" data-lib="${b.i}" style="--pct:${pct}%">
        <span class="c-t">${esc(b.t)}</span><span class="mono">Chapter ${p.ch + 1} of ${p.n} · ${pct}%</span><i></i></button>`;
    }).join('');
  }
  for (const row of ['#bContinue', '#fContinue']) $(row).addEventListener('click', e => { const b = e.target.closest('[data-lib]'); if (b) reader.open(LIBRARY[+b.dataset.lib]) });
  $('#fSurprise').addEventListener('click', () => lenis.scrollTo(list, {offset: -240, duration: 1.2, onComplete: () => $('#bSurprise').click()}));
  refresh();

  // ---------- scroll choreography ----------
  // the title's letters drift in from scattered positions and settle as you scroll
  const title = new SplitText('.b-title', {type: 'chars,words', mask: 'words'});
  if (!reduce) gsap.from(title.chars, {
    yPercent: () => R(-180, 180), rotate: () => R(-35, 35), opacity: 0, ease: 'none', stagger: {each: .02, from: 'random'},
    scrollTrigger: {trigger: '.b-title', start: 'top 95%', end: 'top 40%', scrub: 1},
  });
  // numbers count up the first time the stats come into view
  const totals = {
    books: LIBRARY.length, readable: LIBRARY.filter(b => b.pg).length,
    words: LIBRARY.filter(b => b.pg).reduce((n, b) => n + words(b), 0), hours: LIBRARY.filter(b => b.pg).reduce((n, b) => n + hours(b), 0),
  };
  const fmt = (k, v) => k === 'words' ? `${(v / 1e6).toFixed(1)}M` : Math.round(v).toLocaleString();
  document.querySelectorAll('[data-count]').forEach(dd => {
    const k = dd.dataset.count, o = {v: 0};
    dd.textContent = fmt(k, reduce ? totals[k] : 0);
    if (!reduce) gsap.to(o, {v: totals[k], duration: 2.2, ease: 'expo.out', onUpdate: () => dd.textContent = fmt(k, o.v), scrollTrigger: {trigger: dd, start: 'top 90%', once: true}});
  });
  gsap.timeline({scrollTrigger: {trigger: list, start: 'top 85%', once: true}}).add(enter);

  document.querySelectorAll('[data-pdall]').forEach(e => e.textContent = totals.readable);
  document.querySelectorAll('[data-libtotal]').forEach(e => e.textContent = LIBRARY.length);
  apply(false);
  const bySlug = Object.fromEntries(LIBRARY.map(b => [slug(b), b]));
  return {
    refresh, viewer, bySlug,
    show: b => viewer.open(b, face(byId[b.i])),
    // restore filters from a share link like ?view=timeline&kind=Mystery
    setFilters(qs) {
      const p = new URLSearchParams(qs);
      for (const k of Object.keys(DEF)) if (p.has(k)) state[k] = p.get(k);
      if (state.col && !COLLECTIONS.some(c => c.id === state.col)) state.col = '';
      if (!['shelf', 'covers', 'catalogue', 'timeline'].includes(p.get('view'))) p.delete('view');
      syncControls();
      if (p.has('view') && p.get('view') !== state.view) setView(p.get('view')); else apply(false);
    },
  };
}
