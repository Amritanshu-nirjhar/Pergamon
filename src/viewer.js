// The book viewer: a CSS 3D book flies out of whatever you clicked in the library, turns to face you and opens.
import gsap from 'gsap';
import {SplitText} from 'gsap/SplitText';
import {paintCover, paintSpine, paintBack, paintTitlePage, H as CH_H} from './covers.js';
import {slug} from './catalog.js';
import {toast} from './toast.js';

const $ = (s, el = document) => el.querySelector(s);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function createViewer({reader, info, sfx, reduce, onToggle}) {
  const el = $('#viewer'), fly = $('.v-fly', el), tilt = $('.v-tilt', el), book = $('.v-book', el), cover = $('.v-cover', el);
  const shadow = $('.v-shadow', el), stage = $('.v-stage', el), readBtn = $('#vRead'), shareBtn = $('#vShare');
  const ITEMS = '#vKick, #vAuthor, #vQuote, .v-facts, .v-actions';
  let cur = null, src = null, open = false, split, tl;

  // loose leaves under the cover: the first carries the title page; drag across the book to riffle them
  const LEAVES = 7, LEAF_MAX = 148; // stop just short of the open cover
  book.insertAdjacentHTML('beforeend', Array.from({length: LEAVES}, (_, i) =>
    `<div class="v-leaf" style="--i:${i}"><div class="lf lf-front${i ? ' lines' : ''}"></div><div class="lf lf-back lines"></div></div>`).join(''));
  const leaves = [...el.querySelectorAll('.v-leaf')].reverse(); // top leaf first
  const riffle = {p: 0}, hint = $('.v-hint', el);
  let turned = 0;
  const setRiffle = () => {
    leaves.forEach((lf, i) => {
      const t = clamp((riffle.p * (LEAVES + 1.5) - i * 1.05), 0, 1);
      gsap.set(lf, {rotationY: -LEAF_MAX * (t * t * (3 - 2 * t))});
    });
    const n = Math.floor(riffle.p * (LEAVES + 1.5));
    if (n > turned) sfx.rustle(.35);
    turned = n;
  };
  let drag = null;
  stage.addEventListener('pointerdown', e => {
    if (!open || tl?.isActive()) return;
    drag = {x: e.clientX, p: riffle.p, moved: false};
    gsap.killTweensOf(riffle);
  });
  addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = drag.x - e.clientX;
    if (Math.abs(dx) > 6) drag.moved = true;
    riffle.p = clamp(drag.p + dx / 320, 0, 1);
    setRiffle();
  });
  addEventListener('pointerup', () => {
    if (!drag) return;
    const moved = drag.moved;
    drag = null;
    if (!moved) return;
    gsap.to(hint, {autoAlpha: 0, duration: .4});
    // let go and the pages fall back, one after another
    gsap.to(riffle, {p: 0, duration: reduce ? 0 : 1.1 + riffle.p * .6, ease: 'power2.inOut', onUpdate: setRiffle});
    stage.dataset.dragged = '1';
    setTimeout(() => delete stage.dataset.dragged);
  });

  const tx = gsap.quickTo(tilt, 'rotationY', {duration: .8, ease: 'power3'}), ty = gsap.quickTo(tilt, 'rotationX', {duration: .8, ease: 'power3'});
  el.addEventListener('pointermove', e => {
    if (reduce || !open) return;
    tx((e.clientX / innerWidth - .5) * 22); ty(-(e.clientY / innerHeight - .5) * 14);
    el.style.setProperty('--sheen', (e.clientX / innerWidth * 100).toFixed(1) + '%');
  });

  // build the faces for one book: real painted cover, spine, back and title page
  function build(b) {
    const bw = Math.min(300, innerWidth * (innerWidth > 900 ? .2 : .4)), bh = bw * CH_H / 640;
    const {words, hours, chapters} = info(b), d = Math.round(Math.min(.24, .07 + words / 2.4e6) * bw);
    el.style.setProperty('--bw', bw + 'px'); el.style.setProperty('--bh', bh + 'px'); el.style.setProperty('--d', d + 'px');
    el.style.setProperty('--vbg', b.bg); el.style.setProperty('--acc', b.acc);
    const put = (sel, canvas) => { const f = $(sel, el); f.replaceChildren(canvas) };
    put('.v-front', paintCover(b).map);
    put('.v-spine', paintSpine(b, Math.max(40, Math.round(d * 4))).map);
    put('.v-back', paintBack(b).map);
    leaves.forEach((lf, i) => gsap.set(lf, {z: d / 2 - 2.5 - i * .45, transformOrigin: '0% 50%'})); // stacked just under the cover
    leaves.at(0).querySelector('.lf-front').replaceChildren(paintTitlePage(b));
    riffle.p = 0; turned = 0; setRiffle();

    split?.revert();
    $('#vKick').textContent = `${b.k} · ${b.y}`;
    $('#vTitle').textContent = b.t;
    $('#vAuthor').textContent = b.a;
    $('#vQuote').textContent = b.q ? `“${b.q}”` : '';
    $('#vQuote').hidden = !b.q;
    $('#vFacts').innerHTML = [['Published', b.y], ['Genre', b.g], ['Reading time', `≈ ${hours} h`],
      [b.pg ? 'Chapters' : 'Length', b.pg ? chapters || '—' : `≈ ${b.p || Math.round(words / 280)} pp.`]]
      .map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
    $('span', readBtn).textContent = b.pg ? 'Start reading' : 'Borrow from Open Library';
    $('i', readBtn).textContent = b.pg ? '→' : '↗';
    shareBtn.textContent = 'Copy link';
    split = new SplitText('#vTitle', {type: 'words,lines', mask: 'lines'});
    return {bw, bh, d};
  }

  // where the clicked element sits relative to the stage, so the book can start exactly there
  function origin(bw, bh) {
    const s = stage.getBoundingClientRect(), r = src?.getBoundingClientRect();
    if (!r || !r.height || r.bottom < 0 || r.top > innerHeight) return null;
    const spine = r.width < r.height * .4;
    return {x: r.left + r.width / 2 - (s.left + s.width / 2), y: r.top + r.height / 2 - (s.top + s.height / 2), scale: r.height / bh, rotationY: spine ? 90 : 0};
  }

  function show(b, from) {
    cur = b; src = from; open = true;
    const {bw, bh, d} = build(b);
    el.hidden = false; onToggle(true);
    history.replaceState(null, '', '#/book/' + slug(b));
    tl?.kill();
    gsap.set(cover, {rotationY: 0, z: d / 2, transformOrigin: '0% 50%'}); // gsap owns the transform, so depth goes here too
    gsap.set(tilt, {rotationX: 0, rotationY: 0});
    if (reduce) {
      gsap.set(el, {autoAlpha: 1}); gsap.set(fly, {x: bw / 2, y: 0, scale: 1, rotationY: -20, rotationX: 13, autoAlpha: 1}); gsap.set(cover, {rotationY: -160});
      readBtn.focus({preventScroll: true});
      return;
    }
    const o = origin(bw, bh) ?? {x: 0, y: innerHeight * .4, scale: .3, rotationY: 0};
    tl = gsap.timeline()
      .fromTo(el, {autoAlpha: 0}, {autoAlpha: 1, duration: .45, ease: 'power2.out'})
      .fromTo(fly, {...o, rotationX: 0, autoAlpha: 1}, {x: 0, y: 0, scale: 1, rotationY: -28, rotationX: 8, duration: 1.15, ease: 'expo.out'}, 0)
      .fromTo(shadow, {opacity: 0, scale: .4}, {opacity: 1, scale: 1, duration: 1.1, ease: 'expo.out'}, .1)
      .call(() => sfx.thud(.6), null, .55)
      // the cover swings open and the book slides so the spread sits centred
      .to(cover, {rotationY: -162, duration: 1.5, ease: 'expo.inOut'}, .75)
      .call(() => sfx.rustle(), null, .9)
      .to(fly, {x: bw / 2, rotationY: -20, rotationX: 13, duration: 1.5, ease: 'expo.inOut'}, .75)
      .fromTo(hint, {autoAlpha: 0}, {autoAlpha: 1, duration: .8}, 2)
      .fromTo(split.lines, {yPercent: 110}, {yPercent: 0, duration: 1.1, ease: 'expo.out', stagger: .08}, .45)
      .fromTo(ITEMS, {autoAlpha: 0, y: 18}, {autoAlpha: 1, y: 0, duration: .9, ease: 'power3.out', stagger: .07}, .6)
      .call(() => readBtn.focus({preventScroll: true}), null, .8);
  }

  function hide({toReader = false} = {}) {
    if (!open) return;
    open = false;
    const b = cur, back = src;
    tl?.kill();
    const done = () => {
      el.hidden = true; onToggle(false, toReader);
      if (!toReader) { history.replaceState(null, '', '#/library'); back?.focus({preventScroll: true}) }
    };
    if (reduce) return done(), toReader && reader.open(b);
    if (toReader) {
      // dive into the open book while the reader rises over it
      tl = gsap.timeline({onComplete: done})
        .to(fly, {scale: 2.4, y: -40, autoAlpha: 0, duration: .8, ease: 'expo.in'})
        .to(el, {autoAlpha: 0, duration: .4}, .45)
        .call(() => reader.open(b), null, .35);
      return;
    }
    const o = origin(parseFloat(el.style.getPropertyValue('--bw')), parseFloat(el.style.getPropertyValue('--bh')));
    tl = gsap.timeline({onComplete: done})
      .to(ITEMS + ', #vTitle', {autoAlpha: 0, y: -10, duration: .3, ease: 'power2.in'})
      .to(cover, {rotationY: 0, duration: .7, ease: 'expo.inOut'}, 0)
      .to(fly, o ? {...o, rotationX: 0, duration: .9, ease: 'expo.inOut'} : {y: innerHeight * .6, rotationX: 30, autoAlpha: 0, duration: .8, ease: 'expo.in'}, .35)
      .to(shadow, {opacity: 0, duration: .5}, .35)
      .to(el, {autoAlpha: 0, duration: .35}, o ? .95 : .8)
      .set('#vTitle', {clearProps: 'all'});
  }

  el.addEventListener('click', e => {
    if (e.target.closest('[data-vclose]') || ((e.target === el || e.target === stage) && !stage.dataset.dragged)) hide();
  });
  readBtn.addEventListener('click', () => {
    if (!cur.pg) return reader.open(cur); // borrowing opens Open Library in a new tab
    hide({toReader: true});
  });
  shareBtn.addEventListener('click', async () => {
    const url = `${location.origin}${location.pathname}#/book/${slug(cur)}`;
    try { await navigator.clipboard.writeText(url); toast('Link copied — send it to someone') }
    catch { toast(url) }
  });
  addEventListener('keydown', e => { if (open && e.key === 'Escape' && !reader.isOpen()) hide() });

  return {open: show, close: hide, isOpen: () => open};
}
