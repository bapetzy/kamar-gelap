// Roll metadata. Files live in /public/frames/01.webp … 06.webp.
// Titles, exposure values and credit are placeholders until the real roll arrives.

export interface Frame {
  no: number;
  src: string;
  title: string;
  aperture: string;
  seconds: number;
  credit: string;
}

const CREDIT = 'Bryan Paulo';

const raw: Array<[string, string, number]> = [
  ['Jendela Pagi', 'f/8', 12],
  ['Pasar Subuh', 'f/5.6', 9],
  ['Tangga Rumah', 'f/11', 16],
  ['Hujan di Kaca', 'f/8', 14],
  ['Tangan Ibu', 'f/5.6', 10],
  ['Pelabuhan Sore', 'f/16', 20],
];

export const frames: Frame[] = raw.map(([title, aperture, seconds], i) => ({
  no: i + 1,
  src: `/frames/${String(i + 1).padStart(2, '0')}.webp`,
  title,
  aperture,
  seconds,
  credit: CREDIT,
}));

export const pad2 = (n: number) => String(n).padStart(2, '0');
