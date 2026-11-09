// Every cover is drawn in Canvas 2D. Ops marked as foil are also drawn white into a
// second canvas that becomes the metalnessMap, so gold titles actually glint in 3D.
export const W = 640, H = 920;
const F = {corm: '"Cormorant Garamond"', play: '"Playfair Display"', grot: '"Space Grotesk"', bebas: '"Bebas Neue"', unb: 'Unbounded', fr: '"Newsreader"', mono: '"JetBrains Mono"'};
export const FONTS = [`600 80px ${F.corm}`, `500 24px ${F.corm}`, `700 80px ${F.play}`, `italic 700 24px ${F.play}`,
  `700 80px ${F.grot}`, `500 24px ${F.grot}`, `80px ${F.bebas}`, `900 80px ${F.unb}`, `400 80px ${F.fr}`, `500 80px ${F.fr}`,
  `italic 400 80px ${F.fr}`, `italic 300 80px ${F.fr}`, `500 20px ${F.mono}`];

const pad = n => String(n).padStart(2, '0');
const rng = s => () => (s = s * 16807 % 2147483647) / 2147483647;
const shade = (hex, a) => {
  const n = parseInt(hex.slice(1), 16), to = a < 0 ? 0 : 255, k = Math.abs(a);
  const ch = s => Math.round(((n >> s) & 255) * (1 - k) + to * k);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
};
const track = (g, px) => { if ('letterSpacing' in g) g.letterSpacing = px + 'px' };
const block = (g, lines, x, y, lh) => lines.forEach((l, k) => g.fillText(l, x, y + k * lh));
function diamond(g, x, y, r) { g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r, y); g.lineTo(x, y + r); g.lineTo(x - r, y); g.closePath(); g.fill() }
const SC = 1.3; // supersample covers: designs are authored at W×H, rasterised at 1.3×
function canvas(w, h, sc = 1) {
  const c = document.createElement('canvas'); c.width = Math.round(w * sc); c.height = Math.round(h * sc);
  const g = c.getContext('2d'); g.scale(sc, sc);
  return [c, g];
}
function wrap(g, text, maxW) {
  const lines = []; let line = '';
  for (const w of text.split(' ')) {
    const test = line ? line + ' ' + w : w;
    if (line && g.measureText(test).width > maxW) { lines.push(line); line = w } else line = test;
  }
  lines.push(line);
  return lines;
}
const fits = (g, lines, n, maxW) => lines.length <= n && lines.every(l => g.measureText(l).width <= maxW);
// largest size that fits, then the narrowest measure that keeps the same line count (no orphaned last word)
function fit(g, text, font, maxW, maxLines, size, min = 10) {
  for (; size > min; size -= 2) {
    g.font = font(size);
    let lines = wrap(g, text, maxW);
    if (!fits(g, lines, maxLines, maxW)) continue;
    const n = lines.length;
    for (let lo = maxW * .4, hi = maxW, k = 0; n > 1 && k < 12; k++) {
      const mid = (lo + hi) / 2, l = wrap(g, text, mid);
      if (fits(g, l, n, maxW)) { lines = l; hi = mid } else lo = mid;
    }
    return {size, lines};
  }
  g.font = font(min);
  return {size: min, lines: [text]};
}

let NOISE;
function noise() {
  if (NOISE) return NOISE;
  const [c, g] = canvas(160, 160), img = g.createImageData(160, 160), r = rng(42);
  for (let i = 0; i < img.data.length; i += 4) { const v = 70 + r() * 120; img.data.set([v, v, v, 255], i) }
  g.putImageData(img, 0, 0);
  return NOISE = c;
}
// printed-paper grain, soft edge wear, and the hinge crease near the spine
function finish(g, b, w, h) {
  g.save();
  g.globalCompositeOperation = 'overlay'; g.globalAlpha = b.fx === 'gloss' ? .05 : .1;
  g.fillStyle = g.createPattern(noise(), 'repeat'); g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'multiply'; g.globalAlpha = 1;
  const v = g.createRadialGradient(w / 2, h / 2, h * .38, w / 2, h / 2, h * .78);
  v.addColorStop(0, '#fff'); v.addColorStop(1, '#cfc6b8');
  g.fillStyle = v; g.fillRect(0, 0, w, h);
  const hg = g.createLinearGradient(10, 0, 44, 0), deep = b.fmt === 'pb' ? '#e2dcd2' : '#a39a8e';
  hg.addColorStop(0, '#fff'); hg.addColorStop(.5, deep); hg.addColorStop(1, '#fff');
  g.fillStyle = hg; g.fillRect(10, 0, 34, h);
  g.restore();
}

// mode: 'color' | 'metal' (foil white, rest black) | 'deboss' (only foil ops, pressed dark into the weave)
function paint(w, h, draw, foil, opts = {}) {
  const ops = [];
  draw({n: f => ops.push([0, f]), f: f => ops.push([1, f])});
  const run = (g, mode) => ops.forEach(([isFoil, f]) => {
    if (mode === 'deboss' && !isFoil) return;
    g.save();
    const c = x => mode === 'color' ? (isFoil ? foil : x) : mode === 'metal' ? (isFoil ? '#fff' : '#000') : '#2a2a2a';
    g.fillStyle = g.strokeStyle = c('#000');
    f(g, c);
    g.restore();
  });
  const hasFoil = ops.some(o => o[0]), out = {map: null, metal: null, bump: null};
  const [map, g] = canvas(w, h, opts.sc ?? SC); run(g, 'color'); opts.finish?.(g, w, h); out.map = map;
  if (opts.sc) return out; // thumbnails only need the colour map
  if (hasFoil) { const [c, m] = canvas(w, h, SC); m.fillStyle = '#000'; m.fillRect(0, 0, w, h); run(m, 'metal'); out.metal = c }
  if (opts.bump) {
    const [c, m] = canvas(w, h, SC);
    m.fillStyle = m.createPattern(weaveCanvas(), 'repeat'); m.fillRect(0, 0, w, h);
    if (hasFoil) run(m, 'deboss');
    out.bump = c;
  }
  return out;
}

// ---------- scene motifs ----------
const MOTIF = {
  waves(g, c, b, r) {
    g.fillStyle = c(b.acc); g.beginPath(); g.arc(W * .72, 440, 54, 0, Math.PI * 2); g.fill();
    for (let k = 0; k < 7; k++) {
      const y0 = 530 + k * 58, ph = r() * 6, amp = 12 + k * 5, pts = [];
      for (let x = 0; x <= W; x += 8) pts.push([x, y0 + Math.sin(x * .018 + ph) * amp + Math.sin(x * .051 + ph * 2) * 5]);
      g.beginPath(); g.moveTo(0, H); pts.forEach(p => g.lineTo(...p)); g.lineTo(W, H); g.closePath();
      g.fillStyle = c(shade(b.bg, -.08 * k)); g.fill();
      g.beginPath(); pts.forEach(p => g.lineTo(...p));
      g.strokeStyle = c(b.ink); g.globalAlpha = .35; g.lineWidth = 2; g.stroke(); g.globalAlpha = 1;
    }
  },
  mountains(g, c, b, r) {
    g.fillStyle = c(b.acc); g.beginPath(); g.arc(W * .3, 480, 70, 0, Math.PI * 2); g.fill();
    for (let k = 0; k < 4; k++) {
      const base = 500 + k * 95;
      g.beginPath(); g.moveTo(-20, H); g.lineTo(-20, base);
      for (let x = -20, j = 0; x < W + 80; j++) { x += 50 + r() * 60; g.lineTo(x, base - (j % 2 ? r() * 50 : 80 + r() * 150)) }
      g.lineTo(W + 80, H); g.closePath(); g.fillStyle = c(shade(b.bg, .2 - .17 * k)); g.fill();
    }
  },
  moors(g, c, b, r) {
    g.strokeStyle = c(b.ink); g.lineWidth = 2; g.globalAlpha = .25;
    for (let j = 0; j < 8; j++) {
      const x = r() * W - 100, y = 260 + r() * 220;
      g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + 80, y - 22, x + 170, y + 22, x + 280, y - 8); g.stroke();
    }
    g.globalAlpha = 1;
    for (let k = 0; k < 5; k++) {
      const base = 540 + k * 80;
      g.beginPath(); g.moveTo(-10, H); g.lineTo(-10, base);
      for (let x = -10; x < W + 160; x += 160) g.quadraticCurveTo(x + 80, base - 30 - r() * 50, x + 160, base + r() * 20);
      g.lineTo(W + 160, H); g.closePath(); g.fillStyle = c(shade(b.bg, .1 - .14 * k)); g.fill();
    }
  },
  dunes(g, c, b, r) {
    g.fillStyle = c(b.acc); g.beginPath(); g.arc(W * .62, 520, 150, 0, Math.PI * 2); g.fill();
    for (let k = 0; k < 4; k++) {
      const base = 610 + k * 85;
      g.beginPath(); g.moveTo(-10, H); g.lineTo(-10, base);
      g.bezierCurveTo(W * .3, base - 60 - r() * 80, W * .6, base + 40, W + 10, base - 30 + r() * 60);
      g.lineTo(W + 10, H); g.closePath(); g.fillStyle = c(shade(b.bg, .06 - .15 * k)); g.fill();
    }
  },
  flames(g, c, b, r) {
    g.fillStyle = c(b.acc);
    for (let j = 0; j < 70; j++) { g.globalAlpha = r() * .8; g.fillRect(r() * W, 250 + r() * 500, 2, 2) }
    g.globalCompositeOperation = 'lighter';
    const cols = [b.acc, '#ffcf5a', '#e8401c'];
    for (let j = 0; j < 34; j++) {
      const x = r() * W, h = 220 + r() * 420, w = 50 + r() * 80;
      g.globalAlpha = .55; g.fillStyle = c(cols[j % 3]); g.beginPath();
      g.moveTo(x - w / 2, H); g.quadraticCurveTo(x - w, H - h * .5, x + (r() - .5) * 40, H - h);
      g.quadraticCurveTo(x + w, H - h * .5, x + w / 2, H); g.fill();
    }
  },
  stars(g, c, b, r) {
    g.fillStyle = c(b.ink);
    for (let j = 0; j < 260; j++) { g.globalAlpha = .3 + r() * .7; g.beginPath(); g.arc(r() * W, r() * H * .8, .4 + r() * 1.8, 0, Math.PI * 2); g.fill() }
    g.globalAlpha = 1;
    g.fillStyle = c(shade(b.acc, -.25)); g.beginPath(); g.arc(W * .78, 400, 34, 0, Math.PI * 2); g.fill();
    g.strokeStyle = c(b.ink); g.lineWidth = 2; g.beginPath(); g.ellipse(W * .78, 400, 62, 14, -.3, 0, Math.PI * 2); g.stroke();
    g.fillStyle = c(b.acc); g.beginPath(); g.arc(W / 2, H + 180, 330, 0, Math.PI * 2); g.fill();
    // a small figure on a small planet
    g.fillStyle = c(b.ink); g.beginPath(); g.arc(W / 2, H - 196, 9, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(W / 2, H - 188); g.lineTo(W / 2 - 15, H - 150); g.lineTo(W / 2 + 15, H - 150); g.fill();
    g.strokeStyle = c('#e8b04a'); g.lineWidth = 4; g.beginPath(); g.moveTo(W / 2, H - 184); g.quadraticCurveTo(W / 2 + 30, H - 196, W / 2 + 54, H - 178); g.stroke();
  },
};

// ---------- cover designs ----------
const D = {
  classic(P, b) {
    P.n((g, c) => { g.fillStyle = c(b.bg); g.fillRect(0, 0, W, H) });
    P.f(g => {
      g.lineWidth = 5; g.strokeRect(36, 36, W - 72, H - 72); g.lineWidth = 1.5; g.strokeRect(52, 52, W - 104, H - 104);
      for (const [x, y] of [[52, 52], [W - 52, 52], [52, H - 52], [W - 52, H - 52]]) diamond(g, x, y, 10);
      g.textAlign = 'center';
      const {size, lines} = fit(g, b.t.toUpperCase(), s => `600 ${s}px ${F.corm}`, 440, 4, 92);
      const lh = size * 1.04, y0 = H * .44 - (lines.length - 1) * lh / 2 + size * .3;
      block(g, lines, W / 2, y0, lh);
      const oy = y0 + (lines.length - 1) * lh + 64;
      g.fillRect(W / 2 - 100, oy - 1, 76, 2); g.fillRect(W / 2 + 24, oy - 1, 76, 2); diamond(g, W / 2, oy, 8);
      track(g, 5); g.font = `500 24px ${F.corm}`; g.fillText(b.a.toUpperCase(), W / 2, H - 118);
    });
  },
  penguin(P, b) {
    P.n((g, c) => {
      g.fillStyle = c(b.bg); g.fillRect(0, 0, W, H);
      g.fillStyle = c('#f2ead8'); g.fillRect(0, 290, W, 370);
      g.fillStyle = c(b.ink); g.fillRect(0, 288, W, 3); g.fillRect(0, 659, W, 3);
      g.textAlign = 'center';
      const {size, lines} = fit(g, b.t, s => `700 ${s}px ${F.grot}`, 520, 3, 64);
      const lh = size * 1.06;
      block(g, lines, W / 2, 430 - (lines.length - 1) * lh / 2 + size * .32, lh);
      g.fillRect(W / 2 - 32, 556, 64, 3);
      g.font = `500 26px ${F.grot}`; g.fillText(b.a, W / 2, 606);
      g.lineWidth = 2.5; g.beginPath(); g.ellipse(W / 2, 150, 50, 66, 0, 0, Math.PI * 2); g.stroke();
      g.font = `500 22px ${F.mono}`; g.fillText(pad(b.i + 1), W / 2, 158);
      track(g, 3); g.font = `500 18px ${F.mono}`; g.fillText('PERGAMON CLASSICS', W / 2, H - 130);
    });
  },
  swiss(P, b) {
    P.n((g, c) => {
      const r = rng(b.i * 97 + 11);
      g.fillStyle = c(b.bg); g.fillRect(0, 0, W, H);
      track(g, -2);
      const {size, lines} = fit(g, b.t, s => `700 ${s}px ${F.grot}`, W - 96, 4, 96);
      const lh = size * .96, barY = 48 + size * .78 + (lines.length - 1) * lh + 36;
      const rad = 170 + r() * 80, cy = Math.max(H * (.6 + r() * .12), barY + rad + 50);
      g.fillStyle = c(b.acc); g.beginPath(); g.arc(W * (.5 + r() * .3), cy, rad, 0, Math.PI * 2); g.fill();
      g.fillStyle = c(b.ink);
      g.globalAlpha = .18; for (let k = 0; k <= 6; k++) g.fillRect(48 + k * (W - 96) / 6, 48, 1, H - 96); g.globalAlpha = 1;
      g.font = `700 ${size}px ${F.grot}`; block(g, lines, 48, 48 + size * .78, lh);
      g.fillRect(48, barY, W - 96, 8);
      track(g, 0); g.font = `500 24px ${F.grot}`; g.fillText(b.a, 48, H - 56);
      g.textAlign = 'right'; g.font = `500 20px ${F.mono}`; g.fillText(b.y, W - 48, H - 56);
    });
  },
  bauhaus(P, b) {
    P.n((g, c) => {
      const r = rng(b.i * 131 + 7), pal = [b.acc, b.ink, '#c8402e', '#2f5d9c'].map(x => c(x)), cell = W / 4;
      const a0 = [0, Math.PI / 2, -Math.PI / 2, Math.PI];
      g.fillStyle = c(b.bg); g.fillRect(0, 0, W, H);
      for (let gx = 0; gx < 4; gx++) for (let gy = 0; gy < 3; gy++) {
        if (r() < .3) continue;
        const x = gx * cell, y = 60 + gy * cell, k = Math.floor(r() * 4);
        g.fillStyle = pal[Math.floor(r() * 4)]; g.beginPath();
        if (k === 0) g.arc(x + cell / 2, y + cell / 2, cell / 2, 0, Math.PI * 2);
        else if (k === 1) {
          const q = Math.floor(r() * 4), cx = x + (q & 1) * cell, cy = y + (q >> 1) * cell;
          g.moveTo(cx, cy); g.arc(cx, cy, cell, a0[q], a0[q] + Math.PI / 2);
        } else if (k === 2) { g.moveTo(x, y + cell); g.lineTo(x + cell / 2, y); g.lineTo(x + cell, y + cell) }
        else g.rect(x + cell * .12, y + cell * .12, cell * .76, cell * .76);
        g.fill();
      }
      g.fillStyle = c(b.ink);
      const {size, lines} = fit(g, b.t.toUpperCase(), s => `900 ${s}px ${F.unb}`, W - 96, 3, 54);
      const lh = size * 1.05;
      block(g, lines, 48, H - 120 - (lines.length - 1) * lh, lh);
      g.font = `500 22px ${F.grot}`; g.fillText(b.a, 48, H - 62);
    });
  },
  deco(P, b) {
    const cx = W / 2, cy = H * .64;
    P.n((g, c) => { g.fillStyle = c(b.bg); g.fillRect(0, 0, W, H) });
    P.f(g => {
      g.lineWidth = 2;
      for (let k = 0; k <= 36; k++) {
        const a = Math.PI + k * Math.PI / 36;
        g.beginPath(); g.moveTo(cx + Math.cos(a) * 110, cy + Math.sin(a) * 110); g.lineTo(cx + Math.cos(a) * 1000, cy + Math.sin(a) * 1000); g.stroke();
      }
      for (const rr of [70, 84, 98]) { g.beginPath(); g.arc(cx, cy, rr, Math.PI, 0); g.stroke() }
      for (let y = cy + 24; y < H - 60; y += 20) g.fillRect(60, y, W - 120, 2);
      g.lineWidth = 4; g.strokeRect(28, 28, W - 56, H - 56);
    });
    P.n((g, c) => { g.fillStyle = c(b.bg); g.fillRect(72, 100, W - 144, 240); g.fillRect(150, H - 170, W - 300, 86) });
    P.f(g => {
      g.lineWidth = 2; g.strokeRect(84, 112, W - 168, 216); g.strokeRect(160, H - 160, W - 320, 66);
      g.textAlign = 'center';
      const {size, lines} = fit(g, b.t.toUpperCase(), s => `700 ${s}px ${F.play}`, W - 220, 2, 70);
      const lh = size * 1.05;
      block(g, lines, cx, 220 - (lines.length - 1) * lh / 2 + size * .34, lh);
      g.font = `italic 700 24px ${F.play}`; g.fillText(b.a, cx, H - 118);
    });
  },
  typo(P, b) {
    P.n((g, c) => {
      g.fillStyle = c(b.bg); g.fillRect(0, 0, W, H);
      const words = b.t.toUpperCase().split(' '), maxS = (H - 150) / words.length / .8;
      const sizes = words.map(w => { g.font = `100px ${F.bebas}`; return Math.min(100 * (W - 60) / g.measureText(w).width, maxS, 440) });
      let y = Math.max(36, H - 110 - sizes.reduce((a, s) => a + s * .8, 0));
      words.forEach((w, k) => {
        const s = sizes[k];
        g.font = `${s}px ${F.bebas}`; g.fillStyle = c(k % 2 ? b.acc : b.ink);
        y += s * .74; g.fillText(w, 30, y); y += s * .06;
      });
      g.fillStyle = c(b.acc); g.fillRect(0, H - 88, W, 88);
      g.fillStyle = c(b.bg); track(g, 3); g.font = `500 22px ${F.mono}`; g.fillText(b.a.toUpperCase(), 30, H - 36);
    });
  },
  scene(P, b) {
    P.n((g, c) => {
      const r = rng(b.i * 53 + 3), sky = g.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, c(shade(b.bg, -.45))); sky.addColorStop(.7, c(b.bg));
      g.fillStyle = sky; g.fillRect(0, 0, W, H);
      MOTIF[b.m](g, c, b, r);
    });
    P.n((g, c) => {
      g.fillStyle = c(b.ink);
      const {size, lines} = fit(g, b.t, s => `italic 400 ${s}px ${F.fr}`, W - 96, 3, 96);
      block(g, lines, 48, 64 + size * .8, size);
      track(g, 2); g.font = `500 18px ${F.mono}`;
      g.fillText(b.a.toUpperCase(), 50, 64 + size * .8 + (lines.length - 1) * size + 48);
    });
  },
  pulp(P, b) {
    P.n((g, c) => {
      g.fillStyle = c(b.bg); g.fillRect(0, 0, W, H);
      const st = Math.PI / 2 / 24;
      g.fillStyle = c(b.acc); g.globalAlpha = .16;
      for (let k = 0; k < 24; k += 2) { g.beginPath(); g.moveTo(W, H); g.arc(W, H, 1600, Math.PI + k * st, Math.PI + (k + 1) * st); g.fill() }
      g.globalAlpha = 1;
      const {size, lines} = fit(g, b.t.toUpperCase(), s => `900 ${s}px ${F.unb}`, W - 100, 5, 86);
      const lh = size * 1.02, y0 = 80 + size * .8;
      g.strokeStyle = c(b.acc); g.lineWidth = 2; lines.forEach((l, k) => g.strokeText(l, 55, y0 + k * lh + 7));
      block(g, lines, 48, y0, lh);
      g.save(); g.translate(W - 140, H - 220); g.rotate(-.25);
      g.beginPath(); g.arc(0, 0, 84, 0, Math.PI * 2); g.fill();
      g.fillStyle = c(b.bg); g.textAlign = 'center'; g.font = `900 20px ${F.unb}`;
      const bl = (b.badge || 'A NOVEL').split('\n');
      bl.forEach((l, k) => g.fillText(l, 0, (k - (bl.length - 1) / 2) * 26 + 7));
      g.restore();
      g.fillStyle = c(b.ink); g.font = `500 24px ${F.grot}`; g.fillText(b.a, 48, H - 56);
    });
  },
  minimal(P, b) {
    P.n((g, c) => {
      g.fillStyle = c(b.bg); g.fillRect(0, 0, W, H); g.fillStyle = c(b.ink); g.textAlign = 'center';
      if (b.big) {
        const {lines} = fit(g, b.t.toUpperCase(), s => `500 ${s}px ${F.fr}`, W - 90, 1, 190);
        g.fillText(lines[0], W / 2, H * .47);
        track(g, 4); g.font = `500 24px ${F.grot}`; g.fillText(('by ' + b.a).toUpperCase(), W / 2, H * .47 + 80);
      } else {
        g.fillStyle = c(b.acc); g.fillRect(W / 2 - 8, H * .34, 16, 16); g.fillStyle = c(b.ink);
        const {size, lines} = fit(g, b.t, s => `italic 400 ${s}px ${F.fr}`, W - 180, 3, 60);
        const lh = size * 1.08;
        block(g, lines, W / 2, H * .34 + 100, lh);
        track(g, 4); g.font = `500 18px ${F.grot}`; g.fillText(b.a.toUpperCase(), W / 2, H * .34 + 100 + (lines.length - 1) * lh + 70);
      }
      track(g, 0); g.font = `500 16px ${F.mono}`; g.fillText(b.y, W / 2, H - 60);
    });
  },
};

const SPINE_FONT = {
  classic: s => `600 ${s}px ${F.corm}`, deco: s => `700 ${s}px ${F.play}`, typo: s => `${s}px ${F.bebas}`,
  swiss: s => `700 ${s}px ${F.grot}`, penguin: s => `700 ${s}px ${F.grot}`, pulp: s => `900 ${s}px ${F.unb}`,
  bauhaus: s => `900 ${s}px ${F.unb}`, scene: s => `italic 400 ${s}px ${F.fr}`, minimal: s => `italic 400 ${s}px ${F.fr}`,
};
function spine(P, b, sw) {
  P.n((g, c) => { g.fillStyle = c(b.bg); g.fillRect(0, 0, sw, H) });
  P[b.fx === 'foil' ? 'f' : 'n']((g, c) => {
    g.fillStyle = c(b.d === 'pulp' || b.d === 'swiss' ? b.acc : b.ink);
    g.fillRect(0, 46, sw, 3); g.fillRect(0, H - 49, sw, 3);
    g.translate(sw / 2, H / 2); g.rotate(Math.PI / 2); g.textAlign = 'center'; g.textBaseline = 'middle';
    const caps = ['classic', 'typo', 'pulp', 'bauhaus', 'deco'].includes(b.d);
    const {lines} = fit(g, caps ? b.t.toUpperCase() : b.t, SPINE_FONT[b.d], 560, 1, Math.min(sw * .5, 46), 8);
    g.fillText(lines[0], -50, 0);
    g.font = `500 ${Math.min(sw * .28, 18)}px ${F.mono}`; g.fillText(b.a.split(' ').pop().toUpperCase(), H / 2 - 110, 0);
  });
}

const clothy = b => b.fx === 'cloth' || b.fx === 'foil';
export const paintCover = b => paint(W, H, P => D[b.d](P, b), b.acc, {finish: (g, w, h) => finish(g, b, w, h), bump: clothy(b)});
// small 2D cover for the library grid (≈ 320px wide)
export const paintThumb = b => paint(W, H, P => D[b.d](P, b), b.acc, {finish: (g, w, h) => finish(g, b, w, h), sc: .5}).map;
export const paintSpine = (b, sw) => paint(sw, H, P => spine(P, b, sw), b.acc, {bump: clothy(b)});

export function paintBack(b) {
  const w = 512, h = 736, r = rng(b.i * 7 + 99);
  const out = paint(w, h, P => {
    P.n((g, c) => { g.fillStyle = c(b.bg); g.fillRect(0, 0, w, h) });
    P[b.fx === 'foil' ? 'f' : 'n']((g, c) => {
      g.fillStyle = c(b.ink);
      g.textAlign = 'center';
      const {size, lines} = fit(g, b.q ? `“${b.q}”` : b.t, s => `italic 400 ${s}px ${F.fr}`, w - 130, 7, 36);
      const lh = size * 1.32, y0 = 230 - (lines.length - 1) * lh / 2;
      block(g, lines, w / 2, y0, lh);
      track(g, 3); g.font = `500 15px ${F.grot}`;
      g.fillText(b.a.toUpperCase(), w / 2, y0 + (lines.length - 1) * lh + 56);
      track(g, 0); g.textAlign = 'left'; g.font = `italic 400 30px ${F.fr}`; g.fillText('Pergamon', 44, h - 62);
    });
    P.n(g => {
      g.fillStyle = '#f4efe6'; g.fillRect(w - 186, h - 132, 142, 86);
      g.fillStyle = '#141414';
      for (let x = w - 176; x < w - 56;) { const bw = 1 + Math.floor(r() * 3); g.fillRect(x, h - 124, bw, 54); x += bw + 1 + Math.floor(r() * 3) }
      g.font = `500 10px ${F.mono}`; g.fillText(`978 0 ${String(1e5 + b.i * 3571).slice(0, 5)} ${pad(b.i + 1)}`, w - 176, h - 56);
    });
  }, b.acc, {finish: (g, w2, h2) => finish(g, {...b, fmt: 'pb'}, w2, h2), bump: clothy(b)});
  return out;
}

export function paintTitlePage(b) {
  const [c, g] = canvas(W, H, SC), r = rng(b.i + 5);
  g.fillStyle = '#f4ecdc'; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(120,90,50,.06)'; for (let k = 0; k < 1400; k++) g.fillRect(r() * W, r() * H, 1 + r() * 2, 1);
  g.fillStyle = '#2b241b'; g.textAlign = 'center';
  track(g, 3); g.font = `500 16px ${F.mono}`; g.fillText(`Nº ${pad(b.i + 1)}  ·  ${b.y.toUpperCase()}`, W / 2, 104); track(g, 0);
  let {size, lines} = fit(g, b.t, s => `400 ${s}px ${F.fr}`, W - 140, 3, 66), lh = size * 1.05, y = 210;
  block(g, lines, W / 2, y, lh); y += (lines.length - 1) * lh + 56;
  g.font = `italic 300 30px ${F.fr}`; g.fillText(b.a, W / 2, y); y += 52;
  g.fillRect(W / 2 - 28, y, 56, 1.5); y += 84;
  if (b.q) {
    ({size, lines} = fit(g, `“${b.q}”`, s => `italic 300 ${s}px ${F.fr}`, W - 170, 9, 36));
    block(g, lines, W / 2, y, size * 1.4);
  }
  g.fillStyle = '#8a7d68'; track(g, 3); g.font = `500 14px ${F.mono}`; g.fillText('PERGAMON — THE INFINITE SHELF', W / 2, H - 72);
  return c;
}

export function edgeCanvas() {
  // individual page edges: neutral so each book's material colour can age it
  const [c, g] = canvas(256, 256), r = rng(9);
  g.fillStyle = '#f2eee6'; g.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 2) { g.fillStyle = `rgba(110,100,85,${.08 + r() * .3})`; g.fillRect(x, 0, 1, 256) }
  return c;
}
export function weaveCanvas() {
  const [c, g] = canvas(64, 64);
  g.fillStyle = '#808080'; g.fillRect(0, 0, 64, 64);
  for (let y = 0; y < 64; y += 2) { g.fillStyle = y % 4 ? '#9a9a9a' : '#666'; g.fillRect(0, y, 64, 1) }
  for (let x = 0; x < 64; x += 2) { g.fillStyle = x % 4 ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.18)'; g.fillRect(x, 0, 1, 64) }
  return c;
}
export function endpaperCanvas() {
  const [c, g] = canvas(128, 128);
  g.fillStyle = '#ececec'; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = '#c4c4c4'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(64, 0); g.lineTo(128, 64); g.lineTo(64, 128); g.lineTo(0, 64); g.closePath(); g.stroke();
  g.fillStyle = '#c4c4c4'; diamond(g, 64, 64, 6);
  return c;
}
