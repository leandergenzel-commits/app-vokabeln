import { mastery, type Mastery } from './srs';
import type { CardState, Direction, Entry, ReviewLog } from './types';
import { DAY, addDays, dayKey, endOfLearningDay } from './util';

export function activityByDay(reviews: ReviewLog[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of reviews) m.set(r.day, (m.get(r.day) ?? 0) + 1);
  return m;
}

/** Lernstand gezählt je Karte (Eintrag × Richtung) */
export function masteryCounts(entries: Entry[], cards: CardState[], directions: Direction[]): Record<Mastery, number> {
  const out: Record<Mastery, number> = { new: 0, learning: 0, young: 0, mature: 0 };
  const map = new Map(cards.map((c) => [c.id, c]));
  for (const e of entries) {
    if (e.deleted) continue;
    for (const d of directions) out[mastery(map.get(`${e.id}|${d}`))]++;
  }
  return out;
}

export function masteryByTopic(entries: Entry[], cards: CardState[], directions: Direction[]) {
  const topics = new Map<string, Entry[]>();
  for (const e of entries) {
    if (e.deleted) continue;
    const list = topics.get(e.topic) ?? [];
    list.push(e);
    topics.set(e.topic, list);
  }
  return [...topics.entries()].map(([topic, list]) => ({ topic, total: list.length * directions.length, counts: masteryCounts(list, cards, directions) }));
}

/** Fälligkeiten der nächsten Tage */
export function forecast(cards: CardState[], days = 7, now = Date.now()): { day: string; count: number }[] {
  const today = dayKey(now);
  const out = Array.from({ length: days }, (_, i) => ({ day: addDays(today, i), count: 0 }));
  const end0 = endOfLearningDay(now);
  for (const c of cards) {
    if (c.phase === 'new') continue;
    const idx = c.due < end0 ? 0 : Math.floor((c.due - end0) / DAY) + 1;
    if (idx < days) out[idx].count++;
  }
  return out;
}

export function accuracy(reviews: ReviewLog[], direction?: Direction, sinceDays = 30, now = Date.now()) {
  const since = now - sinceDays * DAY;
  const rel = reviews.filter((r) => r.srs && r.ts >= since && (!direction || r.direction === direction) && r.prevPhase === 'review');
  if (!rel.length) return null;
  return rel.filter((r) => r.rating > 1).length / rel.length;
}

/** Schwierigste Einträge: viele Fehler und niedrige Leichtigkeit */
export function hardest(cards: CardState[], entries: Entry[], n = 8): { entry: Entry; card: CardState }[] {
  const byId = new Map(entries.map((e) => [e.id, e]));
  return cards
    .filter((c) => c.lapses > 0 || c.ease < 2.3)
    .sort((a, b) => b.lapses - a.lapses || a.ease - b.ease)
    .map((card) => ({ card, entry: byId.get(card.entryId)! }))
    .filter((x) => x.entry && !x.entry.deleted)
    .slice(0, n);
}
