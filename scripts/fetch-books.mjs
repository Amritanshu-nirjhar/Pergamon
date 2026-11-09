// Downloads the public-domain books from Project Gutenberg, strips the Gutenberg
// header/footer, splits them into chapters and writes public/books/<id>.json for the reader.
// Run once: `npm run books` (output is committed, so the site never hits Gutenberg at runtime).
import {mkdir, writeFile, readFile} from 'node:fs/promises';
import {LIBRARY} from '../src/catalog.js';

// per-book quirks
const OPTS = {
  8800: {verse: true, cycle: ['Inferno', 'Purgatorio', 'Paradiso']}, // the three cantiche each restart at Canto I
  7164: {bare: true, roman: 'Introduction', num: 'Poem'},
  64317: {bare: true},
  4300: {episodes: true}, // Ulysses: [ 1 ] … [ 18 ]
  // verse and drama keep their line breaks
  ...Object.fromEntries([6130, 16328, 26, 2388, 246, 1524, 1322, 844].map(id => [id, {verse: true}])),
};
const CHAPTER = /^(CHAPTER|Chapter|BOOK|Book|CANTO|Canto|LETTER|Letter|EPILOGUE|Epilogue|SCENE|Scene)\b|^[IVXLC]+\. [A-Z][A-Z ,'’-]{3,}\.?$/;
const EPISODE = /^\[ *\d+ *\]$/;
const PART = /^(BOOK|PART|VOLUME|Volume|Part|ACT|Act)\s+([IVXLC]+|ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|FIFTEEN|\d+)\b|^— *[IVX]+ *—$/;
const BARE = /^([IVXLC]+|\d+)\.?$/;

const roman = w => /^[IVXLC]+[.:]?$/.test(w) && w.length < 10;
const title = s => s.replace(/[\].]+$/, '').toLowerCase().split(' ')
  .map((w, i) => roman(w.toUpperCase()) ? w.toUpperCase() : i === 0 || !/^(of|the|and|in|a|to|on|with|which|for|at|by)$/.test(w) ? w[0]?.toUpperCase() + w.slice(1) : w).join(' ')
  .replace(/([—-]|\. )(\p{L})/gu, (_, d, c) => d + c.toUpperCase());
function heading(s, o = {}) {
  let m;
  if ((m = s.match(/^(\d+)\.?$/))) return {t: `${o.num || 'Chapter'} ${m[1]}`};
  if ((m = s.match(/^([IVXLC]+)\.?$/))) return {t: `${o.roman || 'Chapter'} ${m[1]}`};
  if ((m = s.match(/^\[ *(\d+) *\]$/))) return {t: `Episode ${m[1]}`};
  if ((m = s.match(/^[IVXLC]+\.\s+(.+)$/))) return {t: title(m[1])};
  if ((m = s.match(/^— *([IVX]+) *—$/))) return {t: `Part ${m[1]}`};
  if ((m = s.match(/^(\w+)\s+([\w]+)[.:]?\s*(.*)$/)) && CHAPTER.test(s) && !/^(the|a)$/i.test(m[2])) return {t: title(`${m[1]} ${m[2]}`), s: m[3] ? title(m[3]) : ''};
  return {t: title(s)};
}

function split(text, o = {}) {
  const a = text.indexOf('\n', text.indexOf('*** START OF')), b = text.indexOf('*** END OF');
  const lines = text.slice(a, b).replace(/\r/g, '').split('\n');
  const isHead = (i, re) => {
    const s = lines[i].trim();
    return s && s.length < 70 && !lines[i - 1]?.trim() && re.test(s);
  };
  // bare numerals must stand alone on both sides, or a contents list (I / II / III…) reads as headings
  const isBare = i => isHead(i, BARE) && !lines[i + 1]?.trim();
  // pass 1: headings with any ALL-CAPS continuation lines (Don Quixote style)
  const heads = [];
  for (let i = 1; i < lines.length; i++) {
    const bare = o.bare && isBare(i), part = isHead(i, PART), ch = isHead(i, CHAPTER) || (o.episodes && isHead(i, EPISODE)) || bare;
    if (!part && !ch) continue;
    let s = lines[i].trim(), j = i + 1;
    while (ch && !bare && lines[j]?.trim() && lines[j].trim() === lines[j].trim().toUpperCase() && /[A-Z]/.test(lines[j]) && j - i < 4) s += ' ' + lines[j++].trim();
    heads.push({i, end: j, part, h: heading(s, o)});
  }
  // pass 2: bodies → paragraphs; tiny bodies are table-of-contents noise or part labels
  const out = [];
  let prefix = '', cyc = -1, tiny = 0;
  heads.forEach((hd, k) => {
    const body = lines.slice(hd.end, heads[k + 1]?.i ?? lines.length).join('\n');
    const paras = body.split(/\n\s*\n/).map(p => o.verse ? p.replace(/^\s+|\s+$/g, '') : p.replace(/\s*\n\s*/g, ' ').trim())
      .filter(p => p && !/^\[Illustration|^\[Copyright [^\]]*\]\]?$|\.jpg\b|^Full Size$/.test(p));
    const size = paras.join('').length;
    if (o.cycle && /^Canto I$/.test(hd.h.t)) cyc++;
    if (size < 160) { tiny++; if (hd.part && heads[k + 1] && !heads[k + 1].part) prefix = hd.h.t; return }
    // a contents list's last entry swallows the front matter: it follows a run of tiny entries (and not a part label
    // that introduces a real first chapter), or it shares the final chapter's title
    const tail = (tiny >= 3 && (!heads[k - 1]?.part || hd.part)) || hd.h.t === heads.at(-1).h.t;
    if (!out.length && tail) { out.push({part: '', t: 'Opening pages', s: '', p: paras}); prefix = ''; return }
    out.push({part: o.cycle ? o.cycle[cyc] : hd.part ? '' : prefix, t: hd.h.t, s: hd.h.s || '', p: paras});
  });
  return out;
}

await mkdir(new URL('../public/books/', import.meta.url), {recursive: true});
// books with no recognisable headings are cut into even sittings of ~3,500 words
function chunk(text, o = {}) {
  const a = text.indexOf('\n', text.indexOf('*** START OF')), b = text.indexOf('*** END OF');
  const paras = text.slice(a, b).replace(/\r/g, '').split(/\n\s*\n/)
    .map(p => o.verse ? p.replace(/^\s+|\s+$/g, '') : p.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
  const out = [];
  let cur = [], n = 0;
  for (const p of paras) {
    cur.push(p); n += p.split(/\s+/).length;
    if (n > 3500) { out.push({part: '', t: `Part ${out.length + 1}`, s: '', p: cur}); cur = []; n = 0 }
  }
  if (cur.length) out.push({part: '', t: `Part ${out.length + 1}`, s: '', p: cur});
  return out;
}

// PG_CACHE=<dir> reuses already-downloaded <id>.txt files
const getText = async id => {
  if (process.env.PG_CACHE) try { return await readFile(`${process.env.PG_CACHE}/${id}.txt`, 'utf8') } catch {}
  const res = await fetch(`https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`);
  if (!res.ok) throw new Error(`${id}: HTTP ${res.status}`);
  return res.text();
};

const index = {};
for (const b of LIBRARY.filter(b => b.pg)) {
  const text = await getText(b.pg);
  let chapters = split(text, OPTS[b.pg]);
  const fallback = chunk(text, OPTS[b.pg]), count = cs => cs.reduce((n, c) => n + c.p.join(' ').split(/\s+/).length, 0);
  // too few chapters, or a split that lost a big share of the text → even sittings instead
  if (chapters.length < 3 || count(chapters) < count(fallback) * .6 || count(chapters) / chapters.length > 15000) chapters = fallback;
  const json = {t: b.t, a: b.a, src: `https://www.gutenberg.org/ebooks/${b.pg}`, verse: !!OPTS[b.pg]?.verse, chapters};
  await writeFile(new URL(`../public/books/${b.pg}.json`, import.meta.url), JSON.stringify(json));
  const words = chapters.reduce((n, c) => n + c.p.join(' ').split(/\s+/).length, 0);
  index[b.pg] = {w: words, c: chapters.length};
  console.log(`${b.t.slice(0, 30).padEnd(31)} ${String(chapters.length).padStart(4)} ch  ${String(words).padStart(7)} words  first: ${chapters[0].part} ${chapters[0].t} | last: ${chapters.at(-1).t}`);
}
await writeFile(new URL('../public/books/index.json', import.meta.url), JSON.stringify(index));
