// Personal marks ("favorite" / "made it"), kept on the device.
// Each mark is stored as id -> signed timestamp: positive = on (since then), negative = turned off (at that time).
// Keeping the timestamp means marks made while logged out can later be merged into an account without
// resurrecting things the person already un-marked on another device (latest change per recipe wins).
export type Kind = 'fav' | 'made';
export type Marks = Record<Kind, Record<string, number>>;

const KEY = 'thermo_marks_v1';

export function loadMarks(): Marks {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { fav: raw.fav || {}, made: raw.made || {} };
  } catch {
    return { fav: {}, made: {} };
  }
}

export function saveMarks(m: Marks): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(m));
  } catch {
    /* private mode or storage blocked: marks just won't persist */
  }
}

export const isOn = (m: Marks, k: Kind, id: string): boolean => (m[k][id] ?? 0) > 0;

export function setMark(m: Marks, k: Kind, id: string, on: boolean): void {
  m[k][id] = (on ? 1 : -1) * Date.now();
}

export const count = (m: Marks, k: Kind): number => Object.values(m[k]).filter((v) => v > 0).length;

// For the future account sync: per recipe, the most recent change wins.
export function mergeMarks(a: Marks, b: Marks): Marks {
  const out: Marks = { fav: {}, made: {} };
  for (const k of ['fav', 'made'] as Kind[]) {
    for (const src of [a[k], b[k]]) {
      for (const [id, v] of Object.entries(src)) {
        const cur = out[k][id];
        if (cur === undefined || Math.abs(v) > Math.abs(cur)) out[k][id] = v;
      }
    }
  }
  return out;
}
