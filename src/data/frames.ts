// The found roll: one rainy night in Jakarta, 17:40 → 05:10.
// Photos: Unsplash License (free to use, credit given). Files in /public/frames/01–06.webp.
// index.html repeats titles/captions so the page reads without JS; keep both in sync.

export interface Frame {
  no: number;
  src: string;
  title: string;
  time: string; // when the frame was shot
  line: string; // one sentence of the night
  alt: string;
  aperture: string; // enlarger print exposure
  seconds: number;
  credit: string;
  w: number;
  h: number;
}

type Row = Omit<Frame, 'no' | 'src'>;

const rows: Row[] = [
  {
    title: 'Langit Menghitam',
    time: '17:40',
    line: 'Langit di atas kota menghitam sebelum jam pulang kantor.',
    alt: 'Gedung-gedung tinggi Jakarta di bawah awan mendung tebal',
    aperture: 'f/8',
    seconds: 12,
    credit: 'David Kristianto',
    w: 1600,
    h: 1067,
  },
  {
    title: 'Hujan di Kaca',
    time: '18:15',
    line: 'Tetes pertama menempel di kaca; jalan di luar berubah kabur.',
    alt: 'Jalan dan mobil terlihat kabur di balik kaca penuh tetes hujan',
    aperture: 'f/5.6',
    seconds: 9,
    credit: 'Muslim Atsary',
    w: 1200,
    h: 1600,
  },
  {
    title: 'Jas Hujan',
    time: '18:50',
    line: 'Jam pulang: jas hujan plastik, knalpot, dan aspal yang mengilap.',
    alt: 'Rombongan pengendara motor berjas hujan di jalan basah',
    aperture: 'f/8',
    seconds: 14,
    credit: 'shot ed',
    w: 1064,
    h: 1600,
  },
  {
    title: 'Roda Tiga',
    time: '19:30',
    line: 'Motor roda tiga menerobos genangan, terpal dagangannya basah kuyup.',
    alt: 'Pengendara motor roda tiga pengangkut barang melaju di jalan basah',
    aperture: 'f/11',
    seconds: 16,
    credit: 'Angga Pratama',
    w: 1600,
    h: 1071,
  },
  {
    title: 'Macet',
    time: '21:05',
    line: 'Lampu rem sepanjang jalan, seperti kalimat yang tidak selesai.',
    alt: 'Deretan mobil terjebak macet di jalan kota pada malam hari',
    aperture: 'f/5.6',
    seconds: 10,
    credit: 'Fahrul Razi',
    w: 1000,
    h: 1600,
  },
  {
    title: 'Genangan',
    time: '05:10',
    line: 'Subuh. Hujan reda, dan kota tertinggal terbalik di genangan.',
    alt: 'Rumah dan tiang listrik terpantul di genangan air',
    aperture: 'f/16',
    seconds: 20,
    credit: 'Johano Arkiang',
    w: 1600,
    h: 1200,
  },
];

export const pad2 = (n: number) => String(n).padStart(2, '0');

export const frames: Frame[] = rows.map((r, i) => ({
  ...r,
  no: i + 1,
  src: `/frames/${pad2(i + 1)}.webp`,
}));
