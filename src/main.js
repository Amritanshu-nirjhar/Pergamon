import 'lenis/dist/lenis.css';
import './style.css';
import Lenis from 'lenis';
import gsap from 'gsap';
import {ScrollTrigger} from 'gsap/ScrollTrigger';
import {SplitText} from 'gsap/SplitText';
import {BOOKS, CHAPTERS} from './books.js';
import {FONTS} from './covers.js';
import {createScene, clamp, smooth} from './scene.js';
import {createReader} from './reader.js';
import {createShelf} from './shelf.js';
import {sfx} from './sound.js';
import {slug} from './catalog.js';
import {toast} from './toast.js';

gsap.registerPlugin(ScrollTrigger, SplitText);
const $ = s => document.querySelector(s);
const pad = n => String(n).padStart(2, '0');
// soften each book's colour toward paper so UI accents stay readable and calm
const mix = (a, b, t) => '#' + [1, 3, 5].map(k =>
  Math.round(parseInt(a.substr(k, 2), 16) * (1 - t) + parseInt(b.substr(k, 2), 16) * t).toString(16).padStart(2, '0')).join('');
const N = BOOKS.length;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
// phones get the lighter 3D (no shadows or bloom); ?lite / ?full override
const qp = new URLSearchParams(location.search);
const lite = qp.has('lite') || (!qp.has('full') && matchMedia('(pointer: coarse)').matches && innerWidth < 900);

// Timeline: hero → (chapter → its books)… → end. Every step is one viewport tall.
const STEPS = [{type: 'hero', f: 0, cloud: 1, c: 0}], bookStep = [];
CHAPTERS.forEach((ch, c) => {
  STEPS.push({type: 'chapter', f: ch.first, cloud: 1, c});
  for (let i = ch.first; i <= ch.last; i++) { bookStep[i] = STEPS.length; STEPS.push({type: 'book', f: i, cloud: 0, c}) }
});
STEPS.push({type: 'end', f: N - 1, cloud: 1, c: CHAPTERS.length - 1});
const S = STEPS.length;
const chapSteps = STEPS.flatMap((st, k) => st.type === 'chapter' ? [k] : []);

// ---------- DOM ----------
const PD = BOOKS.filter(b => b.pg).length;
for (const [sel, v] of [['[data-n]', N], ['[data-pd]', PD], ['[data-cr]', N - PD]]) document.querySelectorAll(sel).forEach(e => e.textContent = v);
$('#rooms').innerHTML = CHAPTERS.map(ch =>
  `<section class="chapter"><span class="numeral" aria-hidden="true">${ch.n}</span><div class="chap-in"><p class="kicker">Chapter ${ch.n} · ${ch.size} books</p><h2>${ch.t}</h2><p class="desc">${ch.d}</p></div></section>` +
  '<div class="spacer"></div>'.repeat(ch.size)).join('');
$('#ticks').innerHTML = CHAPTERS.map(ch => `<div class="tg"><span class="mono">${ch.n}</span>${
  BOOKS.slice(ch.first, ch.last + 1).map(b => `<button data-i="${b.i}" data-t="${b.t}" aria-label="${b.t}"></button>`).join('')}</div>`).join('');
const ticks = [...document.querySelectorAll('#ticks button')];
const panel = $('#panel'), tickNav = $('#ticks'), bignum = $('#bignum'), chapEl = $('#chap'), countEl = $('#count'), pTitle = $('#pTitle');
const openBtn = $('#openBtn'), readBtn = $('#readBtn'), cur = $('#cursor'), dot = $('#dot'), curLabel = cur.querySelector('span');
const loader = $('#loader'), root = document.documentElement, libEl = $('#library');

// ---------- smooth scroll ----------
const lenis = new Lenis({lerp: reduce ? 1 : .085, wheelMultiplier: .9, touchMultiplier: 1.4});
lenis.stop();
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add(time => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);
// cached: reading layout inside the frame loop forced a full-page reflow every tick
let VH = $('.hero').offsetHeight;
addEventListener('resize', () => VH = $('.hero').offsetHeight);
const vh = () => VH;
const easeOut = t => 1 - Math.pow(1 - t, 4);
const goBook = i => lenis.scrollTo(bookStep[i] * vh(), {duration: 1.8, easing: easeOut, immediate: reduce});

// settle on the nearest step once scrolling stops
let snapT;
lenis.on('scroll', () => {
  clearTimeout(snapT);
  snapT = setTimeout(() => {
    const h = vh(), k = Math.round(lenis.scroll / h);
    if (k < S - 1 && Math.abs(lenis.scroll - k * h) > 2) lenis.scrollTo(k * h, {duration: 1.1, easing: easeOut});
  }, 260);
});

// ---------- build the library ----------
await Promise.all(FONTS.map(f => document.fonts.load(f))).catch(() => {});
// the loader's little shelf: one spine stands up for every book that's bound
const lstack = $('.l-stack');
const scene = await createScene($('#gl'), n => {
  const b = BOOKS[n - 1], sp = document.createElement('i');
  sp.style.cssText = `--c:${b.bg};--a:${b.acc};height:${36 + (n * 37 % 5) * 5}px`;
  lstack.append(sp);
  if (!reduce) gsap.from(sp, {yPercent: -120, opacity: 0, duration: .5, ease: 'bounce.out'});
  $('#ld').textContent = pad(n);
  loader.style.setProperty('--l', n / N);
}, {lite});
// while the reader is open the 3D scene pauses and the page stops scrolling
let paused = false, shelf;
const inLibrary = () => lenis.scroll > libEl.offsetTop - vh() * .5;
const setHash = h => history.replaceState(null, '', h || location.pathname + location.search);
const reader = createReader({
  onToggle: open => {
    paused = open;
    root.classList.toggle('locked', open);
    open ? lenis.stop() : lenis.start();
    if (!open) { shelf?.refresh(); setHash(inLibrary() ? '#/library' : '') }
  },
  onTurn: () => sfx.rustle(.6),
  onChapter: (b, ch) => setHash(`#/read/${slug(b)}/${ch + 1}`),
});
window.__reader = reader;
shelf = await createShelf({
  reader, lenis, reduce, sfx,
  onViewer: (open, toReader) => {
    root.classList.toggle('locked', open || toReader);
    open || toReader ? lenis.stop() : lenis.start();
  },
  onState: qs => setHash('#/library' + (qs ? '?' + qs : '')),
});
// long jumps go behind a curtain instead of whipping through every room at speed
const warp = $('#warp');
function warpTo(y, label, done) {
  if (reduce || Math.abs(y - lenis.scroll) < innerHeight * 2.5) return lenis.scrollTo(y, {duration: 1.6, easing: easeOut, onComplete: done});
  warp.querySelector('b').textContent = label;
  gsap.timeline()
    .set(warp, {visibility: 'visible'})
    .fromTo(warp, {clipPath: 'inset(100% 0 0 0)'}, {clipPath: 'inset(0% 0 0 0)', duration: .75, ease: 'expo.inOut'})
    .fromTo(warp.querySelector('b'), {yPercent: 100}, {yPercent: 0, duration: .7, ease: 'expo.out'}, '-=.3')
    .add(() => { lenis.scrollTo(y, {immediate: true, force: true}); ScrollTrigger.update() })
    .to(warp, {clipPath: 'inset(0 0 100% 0)', duration: .9, ease: 'expo.inOut'}, '+=.25')
    .set(warp, {visibility: 'hidden'})
    .add(() => done?.());
}
// keyboard users land in the search field
const toLibrary = (focus = false) => warpTo(libEl.offsetTop, 'The great library', () => focus && $('#bSearch').focus({preventScroll: true}));

// ---------- panel ----------
let idx = -1, chap = -1, opened = false, titleSplit, swap;
const ITEMS = '#pNum, #pAuthor, .facts, #pQuote, .actions';
function toggleOpen(v = !opened) {
  opened = v;
  if (v) { scene.ensurePage(idx); sfx.rustle() }
  openBtn.textContent = v ? 'Close the book' : 'Open the book';
}
function setChap(c) {
  chap = c;
  chapEl.textContent = `${CHAPTERS[c].n} · ${CHAPTERS[c].t}`;
}
function fill(b) {
  $('#pNum').textContent = `Nº ${pad(b.i + 1)} · Chapter ${CHAPTERS[b.c].n}`;
  pTitle.textContent = b.t;
  $('#pAuthor').textContent = b.a;
  $('#fY').textContent = b.y;
  $('#fP').textContent = `≈ ${b.p} pp.`;
  $('#fG').textContent = b.g;
  $('#pQuote').textContent = b.q;
  readBtn.querySelector('span').textContent = b.pg ? 'Read it here, free' : 'Borrow · Open Library';
  readBtn.querySelector('i').textContent = b.pg ? '→' : '↗';
}
function setBook(i) {
  const first = idx < 0, b = BOOKS[i];
  idx = i;
  if (opened) toggleOpen(false);
  bignum.textContent = pad(i + 1);
  $('#count').textContent = `${pad(i + 1)} / ${N}`;
  root.style.setProperty('--accent', mix(b.acc, '#f1ebe0', .22));
  ticks.forEach(t => t.classList.toggle('on', +t.dataset.i === i));
  swap?.kill();
  if (first || reduce) {
    fill(b);
    if (!reduce) titleSplit = new SplitText(pTitle, {type: 'words,lines', mask: 'lines'});
    return;
  }
  // old title exits upward, new one rises in, so the change reads as a page turning over
  swap = gsap.timeline()
    .to(titleSplit.words, {yPercent: -110, duration: .3, ease: 'power3.in', stagger: .012, overwrite: 'auto'})
    .to(ITEMS, {autoAlpha: 0, y: -8, duration: .26, ease: 'power2.in', stagger: .02, overwrite: 'auto'}, 0)
    .add(() => {
      titleSplit?.revert();
      fill(b);
      titleSplit = new SplitText(pTitle, {type: 'words,lines', mask: 'lines'});
      gsap.fromTo(titleSplit.words, {yPercent: 115, rotate: 4, transformOrigin: '0% 100%'},
        {yPercent: 0, rotate: 0, duration: 1.1, ease: 'expo.out', stagger: .045});
      gsap.fromTo(ITEMS, {autoAlpha: 0, y: 16}, {autoAlpha: 1, y: 0, duration: .9, ease: 'power3.out', stagger: .06, delay: .12, overwrite: 'auto'});
    });
}
openBtn.onclick = () => toggleOpen();
readBtn.onclick = () => reader.open(BOOKS[idx]);
addEventListener('keydown', e => e.key === 'Escape' && opened && !reader.isOpen() && toggleOpen(false));
document.addEventListener('click', e => {
  const t = e.target.closest('[data-i], [data-library]');
  if (!t) return;
  e.preventDefault();
  if (t.dataset.library !== undefined) toLibrary(e.detail === 0);
  else goBook(+t.dataset.i);
});

// ---------- sound ----------
const soundBtn = $('#soundBtn');
soundBtn.onclick = () => {
  const on = sfx.toggle();
  soundBtn.setAttribute('aria-pressed', on);
  soundBtn.setAttribute('aria-label', on ? 'Sound on — turn off' : 'Sound off — turn on');
};

// ---------- keyboard: step through the rooms one stop at a time ----------
addEventListener('keydown', e => {
  if (paused || shelf.viewer.isOpen() || e.metaKey || e.ctrlKey || e.altKey || e.target.closest?.('input, select, textarea')) return;
  if (inLibrary()) return; // the library scrolls normally
  const onControl = e.target.closest?.('button, a');
  const step = {ArrowDown: 1, PageDown: 1, j: 1, ' ': onControl ? 0 : 1, ArrowUp: -1, PageUp: -1, k: -1}[e.key];
  if (step) {
    e.preventDefault();
    const n = Math.round(lenis.scroll / vh()) + step;
    if (n >= S) toLibrary(true); else lenis.scrollTo(clamp(n, 0, S - 1) * vh(), {duration: 1.2, easing: easeOut});
  } else if (inBook && !onControl && e.key === 'Enter') toggleOpen();
  else if (inBook && e.key === 'r') reader.open(BOOKS[idx]);
});

// ---------- share links: #/book/moby-dick · #/read/moby-dick/3 · #/room/dune · #/library?view=timeline ----------
function route() {
  const [path, qs = ''] = location.hash.slice(1).split('?'), [, kind, name, ch] = path.split('/'), b = shelf.bySlug[name];
  if (!kind) return;
  if (['book', 'read', 'room'].includes(kind) && !b) return toast('Couldn’t find that book — here’s the library'), lenis.scrollTo(libEl.offsetTop, {immediate: true, force: true});
  if (kind === 'room' && b && b.i < N) return lenis.scrollTo(bookStep[b.i] * vh(), {immediate: true, force: true});
  lenis.scrollTo(libEl.offsetTop, {immediate: true, force: true});
  if (kind === 'library') shelf.setFilters(qs);
  if (kind === 'book' && b) gsap.delayedCall(lenis.isStopped ? 1.6 : .2, () => shelf.show(b));
  if (kind === 'read' && b) gsap.delayedCall(lenis.isStopped ? 1.4 : .2, () => reader.open(b, ch ? {ch: ch - 1} : undefined));
}
addEventListener('hashchange', route);
$('#top').onclick = () => warpTo(0, 'The infinite shelf');
$('#brand').onclick = e => { e.preventDefault(); warpTo(0, 'The infinite shelf') };
$('[data-tour]').onclick = () => lenis.scrollTo(vh(), {duration: 1.8, easing: easeOut});

// ---------- cursor, magnetic links, picking books in 3D ----------
const UI = 'button, a, input, select, #panel, .biblio, header, #ticks, .overlay, .viewer';
const ndc = {x: 0, y: 0};
let mx = 0, my = 0, pointer = false, moved = false, overUI = false, hoverI = -1, inBook = false;
gsap.set([cur, dot], {xPercent: -50, yPercent: -50});
const ring = [gsap.quickTo(cur, 'x', {duration: .55, ease: 'power3'}), gsap.quickTo(cur, 'y', {duration: .55, ease: 'power3'})];
const pin = [gsap.quickTo(dot, 'x', {duration: .12}), gsap.quickTo(dot, 'y', {duration: .12})];
addEventListener('pointermove', e => {
  ring[0](e.clientX); ring[1](e.clientY); pin[0](e.clientX); pin[1](e.clientY);
  mx = e.clientX / innerWidth * 2 - 1; my = e.clientY / innerHeight * 2 - 1;
  ndc.x = mx; ndc.y = -my;
  overUI = !!e.target.closest?.(UI);
  cur.classList.toggle('hover', !!e.target.closest?.('a, button'));
  pointer = moved = true;
});
addEventListener('click', e => {
  if (hoverI < 0 || paused || e.target.closest(UI)) return;
  if (hoverI === idx && inBook) toggleOpen(); else goBook(hoverI);
});
if (!reduce) document.querySelectorAll('.link, .brand').forEach(el => {
  const x = gsap.quickTo(el, 'x', {duration: .5, ease: 'power3'}), y = gsap.quickTo(el, 'y', {duration: .5, ease: 'power3'});
  el.addEventListener('pointermove', e => {
    const r = el.getBoundingClientRect();
    x((e.clientX - r.left - r.width / 2) * .25); y((e.clientY - r.top - r.height / 2) * .4);
  });
  el.addEventListener('pointerleave', () => { x(0); y(0) });
});

// ---------- scroll-driven text ----------
const heroSplit = new SplitText('h1', {type: 'chars,lines', mask: 'lines'});
gsap.to('.hero-in', {y: () => -vh() * .25, autoAlpha: 0, ease: 'none', scrollTrigger: {trigger: '.hero', start: 'top top', end: 'bottom 30%', scrub: true}});
gsap.to('.cue', {autoAlpha: 0, scrollTrigger: {trigger: '.hero', start: 'top top', end: '20% top', scrub: true}});
document.querySelectorAll('.chapter').forEach(sec => {
  const el = sec.querySelector('.chap-in'), sp = new SplitText(el.querySelector('h2'), {type: 'words,lines', mask: 'lines'});
  gsap.timeline({scrollTrigger: {trigger: el, start: 'top 70%', toggleActions: 'play none none reverse'}})
    .from(sp.words, {yPercent: 110, rotate: 3, transformOrigin: '0% 100%', duration: 1.2, ease: 'expo.out', stagger: .06})
    .from(el.querySelectorAll('.kicker, .desc'), {autoAlpha: 0, y: 16, duration: .9, ease: 'power3.out', stagger: .1}, .2);
  gsap.fromTo(sec.querySelector('.numeral'), {yPercent: 35}, {yPercent: -35, ease: 'none', scrollTrigger: {trigger: sec, start: 'top bottom', end: 'bottom top', scrub: true}});
});

// the closing quote brightens word by word as it scrolls into view
const fq = new SplitText('.f-quote p', {type: 'words'});
if (!reduce) gsap.fromTo(fq.words, {opacity: .12}, {opacity: 1, ease: 'none', stagger: .1, scrollTrigger: {trigger: '.f-quote', start: 'top 85%', end: 'bottom 55%', scrub: true}});

// ---------- intro: curtain lifts, the galaxy of books flies in from deep space ----------
const intro = {v: reduce ? 1 : 0};
gsap.timeline({delay: .25})
  .to(loader, {clipPath: 'inset(0% 0% 100% 0%)', duration: 1.3, ease: 'expo.inOut'})
  .to(intro, {v: 1, duration: 3.2, ease: 'expo.out'}, '<.15')
  .from(heroSplit.chars, {yPercent: 110, duration: 1.3, ease: 'expo.out', stagger: .028}, '<.35')
  .from('.hero-in .kicker, .hero-actions, .hero-note, .cue, header', {autoAlpha: 0, y: 10, duration: .9, stagger: .08}, '<.5')
  .add(() => { lenis.start(); loader.remove() }, 1.3);
route();

// ---------- frame ----------
// The scene follows scroll through a light spring, so motion carries momentum across steps
// instead of stopping dead at each one, and settles with a hint of overshoot.
let vel = 0, sp = 0, sv = 0, lastT = 0;
const bar = $('.bar');
let zone = 0;
const fade = (el, v) => {
  v = Math.round(v * 100) / 100;
  if (el._v === v) return; // only touch the DOM when something changed
  el._v = v; el.style.opacity = v; el.style.visibility = v < .02 ? 'hidden' : 'visible';
};
ScrollTrigger.create({trigger: libEl, start: 'top 90px', end: 'max', toggleClass: {targets: 'body > header', className: 'solid'}});
gsap.ticker.add(time => {
  if (paused) return;
  const dt = Math.min(time - (lastT || time), 1 / 30); lastT = time;
  const target = clamp(lenis.scroll / vh(), 0, S - 1);
  if (reduce || Math.abs(target - sp) > 2.5) { sp = target; sv = 0 } // curtain jumps land instantly
  else { sv += ((target - sp) * 140 - sv * 19) * dt; sp += sv * dt }
  const s = clamp(sp, 0, S - 1), k = Math.min(Math.floor(s), S - 2), u = s - k;
  const A = STEPS[k], B = STEPS[k + 1];
  const f = A.f + (B.f - A.f) * u, cloud = A.cloud + (B.cloud - A.cloud) * smooth(u), c = (u < .5 ? A : B).c;
  if (Math.round(f) !== idx) setBook(Math.round(f));
  if (c !== chap) setChap(c);
  const z = inLibrary() ? 4 : c;
  if (z !== zone) sfx.room(zone = z);
  // each room has its own way in: strongest halfway between the galaxy and the room
  const K = chapSteps.find(k => Math.abs(s - k) < 1) ?? -1, ph = K < 0 ? 0 : s - K;
  inBook = STEPS[Math.round(s)].type === 'book';
  if (opened && !inBook) toggleOpen(false);

  const vis = clamp(1 - cloud * 2.4, 0, 1);
  for (const el of [panel, tickNav, bignum]) fade(el, vis);
  fade(chapEl, s < .6 || s > S - 1.5 ? 0 : 1);
  fade(countEl, s > S - 1.5 ? 0 : 1);
  bar.style.setProperty('--p', (s / (S - 1)).toFixed(4));
  vel += (Math.min(Math.abs(sv) / 5, 1) - vel) * .12;

  if (pointer && !inLibrary() && (moved || Math.abs(sv) > .02)) {
    moved = false;
    hoverI = overUI ? -1 : scene.pick(ndc);
    cur.classList.toggle('label', hoverI >= 0);
    curLabel.textContent = hoverI === idx && inBook ? (opened ? 'Close' : 'Open') : 'View';
  }
  // once the library covers the screen the 3D scene stops rendering
  if (lenis.scroll > libEl.offsetTop + innerHeight * .8) return;
  scene.update({now: time, t: reduce ? 0 : time, f, cloud, chap: c, idx, open: opened, mx, my, vel, spin: clamp(sv, -4, 4), room: K < 0 ? 0 : STEPS[K].c, ph, tr: K < 0 || reduce ? 0 : Math.sin(Math.PI * Math.abs(ph)), hero: clamp(1 - s, 0, 1), intro: intro.v, w: innerWidth, h: innerHeight, reduce});
});
