export const MINUTE = 60_000;
export const DAY = 86_400_000;

/** Tageswechsel um 4 Uhr nachts (wie Anki), damit spätes Lernen noch zum Vortag zählt */
const DAY_START_HOUR = 4;

export function dayKey(ts: number = Date.now()): string {
  const d = new Date(ts - DAY_START_HOUR * 3_600_000);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Beginn des nächsten Lerntages (ms) */
export function endOfLearningDay(ts: number = Date.now()): number {
  const d = new Date(ts - DAY_START_HOUR * 3_600_000);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 1);
  return d.getTime() + DAY_START_HOUR * 3_600_000;
}

export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d + n, 12);
  return dayKey(date.getTime() + DAY_START_HOUR * 3_600_000);
}

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function shuffle<T>(arr: T[], rnd: () => number = Math.random): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function pick<T>(arr: T[], rnd: () => number = Math.random): T {
  return arr[Math.floor(rnd() * arr.length)];
}

/** Entfernt die *Markierung* aus Beispielsätzen */
export function stripMarks(s: string): string {
  return s.replace(/\*/g, '');
}

export function formatInterval(ms: number): string {
  if (ms < MINUTE) return '<1 Min';
  if (ms < 60 * MINUTE) return `${Math.round(ms / MINUTE)} Min`;
  if (ms < DAY) return `${Math.round(ms / 3_600_000)} Std`;
  const days = ms / DAY;
  if (days < 30) return `${Math.round(days)} T`;
  if (days < 365) return `${Math.round(days / 30)} Mon`;
  return `${(days / 365).toFixed(1)} J`;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
