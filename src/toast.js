// Small confirmations ("Link copied", "Bookmark added"): one at a time, bottom centre, announced to screen readers.
import gsap from 'gsap';

let el, timer;
export function toast(msg) {
  if (!el) {
    el = Object.assign(document.createElement('div'), {className: 'toast'});
    el.setAttribute('role', 'status');
    document.body.append(el);
  }
  el.textContent = msg;
  clearTimeout(timer);
  gsap.fromTo(el, {autoAlpha: 0, y: 16}, {autoAlpha: 1, y: 0, duration: .5, ease: 'expo.out', overwrite: true});
  timer = setTimeout(() => gsap.to(el, {autoAlpha: 0, y: 8, duration: .4, ease: 'power2.in'}), 2200);
}
