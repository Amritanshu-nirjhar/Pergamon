// The Great Library: the 29 shelf books plus more public-domain classics that live only in the library.
import {BOOKS} from './books.js';

export const KINDS = ['Epic & Myth', 'Novel', 'Romance', 'Gothic & Horror', 'Science Fiction', 'Fantasy & Fable', 'Adventure', 'Mystery', 'Philosophy', 'Poetry & Drama'];
const KIND = {
  'The Odyssey': 'Epic & Myth', 'The Divine Comedy': 'Epic & Myth', 'Don Quixote': 'Adventure', 'Moby-Dick': 'Adventure', 'War and Peace': 'Novel',
  'Gitanjali': 'Poetry & Drama', 'Pride and Prejudice': 'Romance', 'Jane Eyre': 'Romance', 'Wuthering Heights': 'Gothic & Horror', 'Frankenstein': 'Gothic & Horror',
  'Anna Karenina': 'Romance', 'The Great Gatsby': 'Novel', 'Beloved': 'Novel', '1984': 'Science Fiction', 'Brave New World': 'Science Fiction',
  'Fahrenheit 451': 'Science Fiction', 'Dune': 'Science Fiction', "The Hitchhiker's Guide to the Galaxy": 'Science Fiction', 'The Hobbit': 'Fantasy & Fable',
  'The Lord of the Rings': 'Fantasy & Fable', "Harry Potter and the Philosopher's Stone": 'Fantasy & Fable', 'The Little Prince': 'Fantasy & Fable',
  'The Alchemist': 'Fantasy & Fable', 'The Catcher in the Rye': 'Novel', 'To Kill a Mockingbird': 'Novel', 'One Hundred Years of Solitude': 'Novel',
  'Crime and Punishment': 'Novel', 'Things Fall Apart': 'Novel', 'Ulysses': 'Novel',
};

// t, a, y, g (genre), k (kind), pg (Project Gutenberg id)
const EXTRA = [
  ['The Iliad', 'Homer', 'c. 750 BCE', 'Epic poem', 'Epic & Myth', 6130],
  ['Beowulf', 'Anonymous', 'c. 1000', 'Epic poem', 'Epic & Myth', 16328],
  ['Paradise Lost', 'John Milton', '1667', 'Epic poem', 'Epic & Myth', 26],
  ['The Bhagavad Gita', 'Vyasa · tr. Edwin Arnold', 'c. 200 BCE', 'Scripture', 'Philosophy', 2388],
  ['The Art of War', 'Sun Tzu', 'c. 500 BCE', 'Strategy', 'Philosophy', 132],
  ['The Republic', 'Plato', 'c. 375 BCE', 'Philosophy', 'Philosophy', 1497],
  ['Meditations', 'Marcus Aurelius', 'c. 180', 'Stoicism', 'Philosophy', 2680],
  ['The Prince', 'Niccolò Machiavelli', '1532', 'Politics', 'Philosophy', 1232],
  ['Walden', 'Henry David Thoreau', '1854', 'Essays', 'Philosophy', 205],
  ['The Rubaiyat of Omar Khayyam', 'Omar Khayyam', '1120', 'Poetry', 'Poetry & Drama', 246],
  ['Hamlet', 'William Shakespeare', '1603', 'Tragedy', 'Poetry & Drama', 1524],
  ['Leaves of Grass', 'Walt Whitman', '1855', 'Poetry', 'Poetry & Drama', 1322],
  ['The Importance of Being Earnest', 'Oscar Wilde', '1895', 'Comedy', 'Poetry & Drama', 844],
  ['Robinson Crusoe', 'Daniel Defoe', '1719', 'Adventure', 'Adventure', 521],
  ["Gulliver's Travels", 'Jonathan Swift', '1726', 'Satire', 'Adventure', 829],
  ['Candide', 'Voltaire', '1759', 'Satire', 'Novel', 19942],
  ['Sense and Sensibility', 'Jane Austen', '1811', 'Romance', 'Romance', 161],
  ['Emma', 'Jane Austen', '1815', 'Romance', 'Romance', 158],
  ['Persuasion', 'Jane Austen', '1817', 'Romance', 'Romance', 105],
  ['A Christmas Carol', 'Charles Dickens', '1843', 'Ghost story', 'Novel', 46],
  ['The Count of Monte Cristo', 'Alexandre Dumas', '1844', 'Adventure', 'Adventure', 1184],
  ['The Scarlet Letter', 'Nathaniel Hawthorne', '1850', 'Romance', 'Romance', 33],
  ['Madame Bovary', 'Gustave Flaubert', '1857', 'Realism', 'Romance', 2413],
  ['A Tale of Two Cities', 'Charles Dickens', '1859', 'Historical', 'Novel', 98],
  ['Great Expectations', 'Charles Dickens', '1861', 'Coming of age', 'Novel', 1400],
  ['Les Misérables', 'Victor Hugo', '1862', 'Historical', 'Novel', 135],
  ["Alice's Adventures in Wonderland", 'Lewis Carroll', '1865', 'Fantasy', 'Fantasy & Fable', 11],
  ['Little Women', 'Louisa May Alcott', '1868', 'Domestic', 'Novel', 514],
  ['Twenty Thousand Leagues under the Sea', 'Jules Verne', '1870', 'Science fiction', 'Science Fiction', 164],
  ['Middlemarch', 'George Eliot', '1871', 'Realism', 'Novel', 145],
  ['Around the World in Eighty Days', 'Jules Verne', '1872', 'Adventure', 'Adventure', 103],
  ['The Adventures of Tom Sawyer', 'Mark Twain', '1876', 'Adventure', 'Adventure', 74],
  ['The Brothers Karamazov', 'Fyodor Dostoevsky', '1880', 'Philosophical', 'Novel', 28054],
  ['Treasure Island', 'Robert Louis Stevenson', '1883', 'Adventure', 'Adventure', 120],
  ['Adventures of Huckleberry Finn', 'Mark Twain', '1884', 'Adventure', 'Adventure', 76],
  ['Strange Case of Dr Jekyll and Mr Hyde', 'Robert Louis Stevenson', '1886', 'Gothic', 'Gothic & Horror', 43],
  ['The Picture of Dorian Gray', 'Oscar Wilde', '1890', 'Gothic', 'Gothic & Horror', 174],
  ['The Adventures of Sherlock Holmes', 'Arthur Conan Doyle', '1892', 'Detective', 'Mystery', 1661],
  ['The Jungle Book', 'Rudyard Kipling', '1894', 'Fables', 'Fantasy & Fable', 236],
  ['The Time Machine', 'H. G. Wells', '1895', 'Science fiction', 'Science Fiction', 35],
  ['Dracula', 'Bram Stoker', '1897', 'Gothic horror', 'Gothic & Horror', 345],
  ['The War of the Worlds', 'H. G. Wells', '1898', 'Science fiction', 'Science Fiction', 36],
  ['Heart of Darkness', 'Joseph Conrad', '1899', 'Novella', 'Novel', 219],
  ['The Wonderful Wizard of Oz', 'L. Frank Baum', '1900', 'Fantasy', 'Fantasy & Fable', 55],
  ['Kim', 'Rudyard Kipling', '1901', 'Adventure', 'Adventure', 2226],
  ['The Hound of the Baskervilles', 'Arthur Conan Doyle', '1902', 'Detective', 'Mystery', 2852],
  ['The Call of the Wild', 'Jack London', '1903', 'Adventure', 'Adventure', 215],
  ['Anne of Green Gables', 'L. M. Montgomery', '1908', 'Coming of age', 'Novel', 45],
  ['Peter Pan', 'J. M. Barrie', '1911', 'Fantasy', 'Fantasy & Fable', 16],
  ['Metamorphosis', 'Franz Kafka', '1915', 'Absurdist', 'Novel', 5200],
  ['Siddhartha', 'Hermann Hesse', '1922', 'Spiritual', 'Novel', 2500],
  ['The Trial', 'Franz Kafka', '1925', 'Absurdist', 'Novel', 7849],
];

// curated cover palettes [bg, ink, accent] and a cover style per kind, so library-only books look designed too
const PAL = [
  ['#1c2740', '#e9dfc7', '#d8b45a'], ['#4a1414', '#efe2c8', '#e0b85c'], ['#1f3a2c', '#efe6cf', '#d8b45a'], ['#efe4cf', '#1d1b18', '#c8402e'],
  ['#0f2b46', '#f1e9d8', '#e9e2cf'], ['#e07a5f', '#1d1b18', '#f2a48d'], ['#3b2c4a', '#e8dcf0', '#c8a8e0'], ['#141414', '#e9f5d0', '#a6e22e'],
  ['#b3202a', '#f7efe6', '#ffb3a7'], ['#0d1b33', '#f0e2b6', '#e3c26a'], ['#efe6da', '#3a1d22', '#d86a7a'], ['#0e8f86', '#0b1d1c', '#7ff5e6'],
  ['#d9783c', '#2a1206', '#ffc380'], ['#1f4a3a', '#f0e6c8', '#f2c46b'], ['#2a1840', '#efe6ff', '#b48cff'], ['#2c5ea8', '#f4f1ea', '#9cc0ff'],
  ['#6b1e22', '#f5c84c', '#f5c84c'], ['#e9e1d0', '#1b120c', '#e0632a'],
];
const STYLE = {
  'Epic & Myth': [['classic', 'foil']], 'Philosophy': [['minimal', 'cloth'], ['classic', 'foil']], 'Poetry & Drama': [['deco', 'foil'], ['minimal', 'cloth']],
  'Romance': [['penguin', 'matte'], ['minimal', 'cloth']], 'Gothic & Horror': [['scene', 'gloss', 'moors'], ['typo', 'matte']],
  'Science Fiction': [['pulp', 'gloss'], ['swiss', 'gloss']], 'Fantasy & Fable': [['scene', 'matte', 'stars'], ['bauhaus', 'gloss']],
  'Adventure': [['scene', 'matte', 'waves'], ['scene', 'matte', 'mountains']], 'Mystery': [['typo', 'matte'], ['swiss', 'matte']],
  'Novel': [['penguin', 'matte'], ['swiss', 'matte'], ['typo', 'gloss'], ['minimal', 'cloth']],
};

export const LIBRARY = [
  ...BOOKS.map(b => ({...b, k: KIND[b.t]})),
  ...EXTRA.map(([t, a, y, g, k, pg], j) => {
    const [bg, ink, acc] = PAL[(j * 7) % PAL.length], styles = STYLE[k], [d, fx, m] = styles[j % styles.length];
    return {t, a, y, g, k, pg, pd: true, d, fx, m, bg, ink, acc, fmt: 'pb', extra: true, i: BOOKS.length + j};
  }),
];

// sortable year: "c. 750 BCE" → -750
export const yearOf = b => { const n = parseInt(b.y.replace(/^\D+/, '')); return b.y.includes('BCE') ? -n : n };
export const ERAS = [['Antiquity', -Infinity, 500], ['Medieval & Renaissance', 500, 1700], ['1700s', 1700, 1800], ['1800s', 1800, 1900], ['1900–1945', 1900, 1946], ['Modern', 1946, Infinity]];

// url-safe name for share links: "Alice's Adventures in Wonderland" → "alices-adventures-in-wonderland"
export const slug = b => b.t.toLowerCase().normalize('NFD').replace(/[̀-ͯ']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// curated rows above the shelf; `has(b, hours)` decides membership
const named = list => b => list.includes(b.t);
export const COLLECTIONS = [
  {id: 'start', t: 'Start here', d: 'Short, vivid, impossible to put down', has: named(['Pride and Prejudice', 'The Great Gatsby', 'Frankenstein', 'The Little Prince', 'A Christmas Carol', 'Metamorphosis', 'The Adventures of Sherlock Holmes', 'The Time Machine', 'Siddhartha', 'Heart of Darkness'])},
  {id: 'short', t: 'Under three hours', d: 'Finish one tonight', has: (b, h) => h <= 3},
  {id: 'banned', t: 'Once banned', d: 'Books someone tried to take away', has: named(['Ulysses', 'Madame Bovary', '1984', 'Brave New World', 'Fahrenheit 451', 'The Catcher in the Rye', 'To Kill a Mockingbird', 'Beloved', 'Adventures of Huckleberry Finn', 'Leaves of Grass', 'The Picture of Dorian Gray', 'Candide', 'The Prince', 'The Great Gatsby'])},
  {id: 'gothic', t: 'A gothic night', d: 'Candles, storms, things in the dark', has: b => b.k === 'Gothic & Horror' || b.t === 'The Hound of the Baskervilles'},
  {id: 'dune', t: 'If you liked Dune', d: 'Other worlds, built whole', has: named(['The Lord of the Rings', 'The Time Machine', 'The War of the Worlds', 'Twenty Thousand Leagues under the Sea', 'Brave New World', '1984', "The Hitchhiker's Guide to the Galaxy", 'The Odyssey', 'Fahrenheit 451'])},
  {id: 'journeys', t: 'Long journeys', d: 'Oceans, rivers, the edge of the map', has: named(['The Odyssey', 'Moby-Dick', 'Around the World in Eighty Days', "Gulliver's Travels", 'Robinson Crusoe', 'Treasure Island', 'Adventures of Huckleberry Finn', 'Heart of Darkness', 'Kim', 'The Call of the Wild', 'Don Quixote'])},
];
