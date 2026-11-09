// pd = public domain, pg = Project Gutenberg ebook id (full text bundled for the reader), d = cover design, m = scene motif, fx = finish, fmt = physical format, p = approx. page count
export const CHAPTERS = [
  {n: 'I', t: 'Epics & Origins', d: 'Where stories learned to travel — gods, windmills, whales, and the long way home.', form: 'helix', mood: '#d8a45a', base: '#0d0b08', glow: '#35250f'},
  {n: 'II', t: 'Hearts & Houses', d: 'Love, class, and the houses that keep their secrets.', form: 'ring', mood: '#e07a8f', base: '#0e090b', glow: '#361520'},
  {n: 'III', t: 'Futures That Warned Us', d: 'Letters mailed from tomorrow. Most of them arrived.', form: 'tunnel', mood: '#5ac8e0', base: '#060a0c', glow: '#0e2c34'},
  {n: 'IV', t: 'Worlds Within', d: 'Hobbit holes, small planets, small towns — the worlds we carry around for life.', form: 'stack', mood: '#9fd8a8', base: '#080b08', glow: '#1b2f1f'},
];

const GROUPS = [
  [
    {t: 'The Odyssey', pd: true, pg: 1727, a: 'Homer', y: 'c. 700 BCE', g: 'Epic poem', p: 541, q: 'Sing to me of the man, Muse, the man of twists and turns.', d: 'classic', fx: 'foil', fmt: 'hc', bg: '#1c2740', ink: '#e9dfc7', acc: '#d8b45a'},
    {t: 'The Divine Comedy', pd: true, pg: 8800, a: 'Dante Alighieri', y: '1320', g: 'Epic poem', p: 798, q: 'Abandon all hope, ye who enter here.', d: 'classic', fx: 'foil', fmt: 'tall', bg: '#4a1414', ink: '#efe2c8', acc: '#e0b85c'},
    {t: 'Don Quixote', pd: true, pg: 996, a: 'Miguel de Cervantes', y: '1605', g: 'Satire', p: 1023, q: 'In a village of La Mancha, the name of which I have no desire to call to mind…', d: 'bauhaus', fx: 'matte', fmt: 'hc', bg: '#efe4cf', ink: '#1d1b18', acc: '#e0a526'},
    {t: 'Moby-Dick', pd: true, pg: 2701, a: 'Herman Melville', y: '1851', g: 'Adventure', p: 635, q: 'Call me Ishmael.', d: 'scene', m: 'waves', fx: 'gloss', fmt: 'hc', bg: '#0f2b46', ink: '#f1e9d8', acc: '#e9e2cf'},
    {t: 'War and Peace', pd: true, pg: 2600, a: 'Leo Tolstoy', y: '1869', g: 'Epic novel', p: 1225, q: 'Well, Prince, so Genoa and Lucca are now just family estates of the Buonapartes.', d: 'classic', fx: 'foil', fmt: 'hc', bg: '#1f3a2c', ink: '#efe6cf', acc: '#d8b45a'},
    {t: 'Gitanjali', pd: true, pg: 7164, a: 'Rabindranath Tagore', y: '1910', g: 'Poetry', p: 103, q: 'Where the mind is without fear and the head is held high…', d: 'minimal', fx: 'cloth', fmt: 'small', bg: '#e8a33d', ink: '#3a1d05', acc: '#ffd27a'},
  ],
  [
    {t: 'Pride and Prejudice', pd: true, pg: 1342, a: 'Jane Austen', y: '1813', g: 'Romance', p: 432, q: 'It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.', d: 'penguin', fx: 'matte', fmt: 'pb', bg: '#e07a5f', ink: '#1d1b18', acc: '#f2a48d'},
    {t: 'Jane Eyre', pd: true, pg: 1260, a: 'Charlotte Brontë', y: '1847', g: 'Gothic romance', p: 532, q: 'I am no bird; and no net ensnares me.', d: 'minimal', fx: 'cloth', fmt: 'hc', bg: '#3b2c4a', ink: '#e8dcf0', acc: '#c8a8e0'},
    {t: 'Wuthering Heights', pd: true, pg: 768, a: 'Emily Brontë', y: '1847', g: 'Gothic', p: 416, q: 'Whatever our souls are made of, his and mine are the same.', d: 'scene', m: 'moors', fx: 'matte', fmt: 'pb', bg: '#5d7389', ink: '#f3ede2', acc: '#a9c2d6'},
    {t: 'Frankenstein', pd: true, pg: 84, a: 'Mary Shelley', y: '1818', g: 'Gothic sci-fi', p: 280, q: 'Beware; for I am fearless, and therefore powerful.', d: 'swiss', fx: 'gloss', fmt: 'pb', bg: '#141414', ink: '#e9f5d0', acc: '#a6e22e'},
    {t: 'Anna Karenina', pd: true, pg: 1399, a: 'Leo Tolstoy', y: '1878', g: 'Realism', p: 864, q: 'Happy families are all alike; every unhappy family is unhappy in its own way.', d: 'typo', fx: 'gloss', fmt: 'tall', bg: '#b3202a', ink: '#f7efe6', acc: '#ffb3a7'},
    {t: 'The Great Gatsby', pd: true, pg: 64317, a: 'F. Scott Fitzgerald', y: '1925', g: 'Jazz Age', p: 180, q: 'So we beat on, boats against the current, borne back ceaselessly into the past.', d: 'deco', fx: 'foil', fmt: 'hc', bg: '#0d1b33', ink: '#f0e2b6', acc: '#e3c26a'},
    {t: 'Beloved', a: 'Toni Morrison', y: '1987', g: 'Historical', p: 324, q: 'Definitions belong to the definers, not the defined.', d: 'minimal', fx: 'matte', fmt: 'pb', bg: '#efe6da', ink: '#3a1d22', acc: '#d86a7a'},
  ],
  [
    {t: '1984', a: 'George Orwell', y: '1949', g: 'Dystopia', p: 328, q: 'Big Brother is watching you.', d: 'typo', fx: 'matte', fmt: 'pb', bg: '#111111', ink: '#f2f2f2', acc: '#e63946'},
    {t: 'Brave New World', a: 'Aldous Huxley', y: '1932', g: 'Dystopia', p: 288, q: 'Community, Identity, Stability.', d: 'pulp', fx: 'gloss', fmt: 'pb', bg: '#0e8f86', ink: '#0b1d1c', acc: '#7ff5e6'},
    {t: 'Fahrenheit 451', a: 'Ray Bradbury', y: '1953', g: 'Dystopia', p: 194, q: 'It was a pleasure to burn.', d: 'scene', m: 'flames', fx: 'gloss', fmt: 'pb', bg: '#1a0a05', ink: '#ffe8c2', acc: '#ff8a1c'},
    {t: 'Dune', a: 'Frank Herbert', y: '1965', g: 'Science fiction', p: 617, q: 'Fear is the mind-killer.', d: 'scene', m: 'dunes', fx: 'matte', fmt: 'tall', bg: '#d9783c', ink: '#2a1206', acc: '#ffc380'},
    {t: "The Hitchhiker's Guide to the Galaxy", a: 'Douglas Adams', y: '1979', g: 'Comic sci-fi', p: 216, q: "Don't Panic.", d: 'pulp', fx: 'gloss', fmt: 'pb', bg: '#1b1b1b', ink: '#d8ff5a', acc: '#d8ff5a', badge: "DON'T\nPANIC"},
  ],
  [
    {t: 'The Hobbit', a: 'J. R. R. Tolkien', y: '1937', g: 'Fantasy', p: 310, q: 'In a hole in the ground there lived a hobbit.', d: 'scene', m: 'mountains', fx: 'cloth', fmt: 'hc', bg: '#1f4a3a', ink: '#f0e6c8', acc: '#f2c46b'},
    {t: 'The Lord of the Rings', a: 'J. R. R. Tolkien', y: '1954', g: 'High fantasy', p: 1178, q: 'All that is gold does not glitter, not all those who wander are lost.', d: 'classic', fx: 'foil', fmt: 'hc', bg: '#151515', ink: '#eadbb5', acc: '#e2b955'},
    {t: "Harry Potter and the Philosopher's Stone", a: 'J. K. Rowling', y: '1997', g: 'Fantasy', p: 223, q: 'It does not do to dwell on dreams and forget to live.', d: 'swiss', fx: 'gloss', fmt: 'pb', bg: '#7a1a1a', ink: '#f6e3b0', acc: '#f6c84b'},
    {t: 'The Little Prince', a: 'Antoine de Saint-Exupéry', y: '1943', g: 'Fable', p: 96, q: 'It is only with the heart that one can see rightly; what is essential is invisible to the eye.', d: 'scene', m: 'stars', fx: 'matte', fmt: 'wide', bg: '#0e1d3a', ink: '#f6e7b4', acc: '#f6d36b'},
    {t: 'The Alchemist', a: 'Paulo Coelho', y: '1988', g: 'Fable', p: 197, q: 'When you want something, all the universe conspires in helping you to achieve it.', d: 'bauhaus', fx: 'gloss', fmt: 'pb', bg: '#f1d9a6', ink: '#2b1a07', acc: '#d9822b'},
    {t: 'The Catcher in the Rye', a: 'J. D. Salinger', y: '1951', g: 'Coming of age', p: 234, q: "Don't ever tell anybody anything. If you do, you start missing everybody.", d: 'minimal', fx: 'matte', fmt: 'pb', bg: '#6b1e22', ink: '#f5c84c', acc: '#f5c84c'},
    {t: 'To Kill a Mockingbird', a: 'Harper Lee', y: '1960', g: 'Southern Gothic', p: 281, q: 'You never really understand a person until you consider things from his point of view.', d: 'penguin', fx: 'matte', fmt: 'pb', bg: '#3d6b4f', ink: '#1d1b18', acc: '#9ccfa9'},
    {t: 'One Hundred Years of Solitude', a: 'Gabriel García Márquez', y: '1967', g: 'Magical realism', p: 417, q: 'Many years later, as he faced the firing squad, Colonel Aureliano Buendía was to remember that distant afternoon when his father took him to discover ice.', d: 'bauhaus', fx: 'matte', fmt: 'hc', bg: '#e9e1cf', ink: '#1b1b1b', acc: '#2fbf8f'},
    {t: 'Crime and Punishment', pd: true, pg: 2554, a: 'Fyodor Dostoevsky', y: '1866', g: 'Psychological', p: 671, q: 'Pain and suffering are always inevitable for a large intelligence and a deep heart.', d: 'typo', fx: 'matte', fmt: 'tall', bg: '#2a1840', ink: '#efe6ff', acc: '#b48cff'},
    {t: 'Things Fall Apart', a: 'Chinua Achebe', y: '1958', g: 'Postcolonial', p: 209, q: 'The white man is very clever. He came quietly and peaceably with his religion.', d: 'swiss', fx: 'matte', fmt: 'pb', bg: '#e9e1d0', ink: '#1b120c', acc: '#e0632a'},
    {t: 'Ulysses', pd: true, pg: 4300, a: 'James Joyce', y: '1922', g: 'Modernist', p: 730, q: 'yes I said yes I will Yes.', d: 'minimal', big: true, fx: 'matte', fmt: 'hc', bg: '#2c5ea8', ink: '#f4f1ea', acc: '#9cc0ff'},
  ],
];

export const BOOKS = GROUPS.flatMap((g, c) => g.map(b => ({...b, c}))).map((b, i) => ({...b, i}));

let k = 0;
CHAPTERS.forEach((ch, c) => { ch.size = GROUPS[c].length; ch.first = k; k += ch.size; ch.last = k - 1 });
