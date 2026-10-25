import { cardId, newCard } from './srs';
import type { CardState, Direction, Entry, ExerciseType, ReviewLog, Settings } from './types';
import { MINUTE, dayKey, endOfLearningDay, pick } from './util';

export interface StudyItem {
  entry: Entry;
  direction: Direction;
  card: CardState;
}

export const LEARN_AHEAD = 20 * MINUTE;

export function directionsFor(setting: Settings['direction']): Direction[] {
  return setting === 'mix' ? ['it-de', 'de-it'] : [setting];
}

export function inTopics(entry: Entry, topics: string[]): boolean {
  return !topics.length || topics.includes(entry.topic);
}

export interface DayCounts {
  newDone: number;
  reviewsDone: number;
  total: number;
}

export function todayCounts(reviews: ReviewLog[], today = dayKey()): DayCounts {
  let newDone = 0;
  let reviewsDone = 0;
  let total = 0;
  for (const r of reviews) {
    if (r.day !== today) continue;
    total++;
    if (!r.srs) continue;
    if (r.prevPhase === 'new') newDone++;
    else if (r.prevPhase === 'review') reviewsDone++;
  }
  return { newDone, reviewsDone, total };
}

/** Reihenfolge neuer Einträge: eigene/importierte zuerst, dann Startdaten nach Häufigkeit */
export function newOrder(a: Entry, b: Entry): number {
  const own = (e: Entry) => (e.source === 'seed' ? 1 : 0);
  if (own(a) !== own(b)) return own(a) - own(b);
  if (own(a) === 0) return a.createdAt - b.createdAt;
  return (a.rank ?? 0) - (b.rank ?? 0);
}

/**
 * Stellt die heutige Lernsitzung zusammen (wie Anki):
 * fällige Lernkarten, fällige Wiederholungen (bis Limit) und neue Karten (bis Tageslimit).
 * Geschwisterkarten (gleicher Eintrag, andere Richtung) werden nicht am selben Tag gezeigt.
 */
export function buildQueue(
  entries: Entry[],
  cards: CardState[],
  reviews: ReviewLog[],
  settings: Settings,
  now = Date.now(),
): { due: StudyItem[]; fresh: StudyItem[] } {
  const dirs = directionsFor(settings.direction);
  const byId = new Map(entries.filter((e) => !e.deleted).map((e) => [e.id, e]));
  const cardMap = new Map(cards.map((c) => [c.id, c]));
  const counts = todayCounts(reviews, dayKey(now));
  const studiedToday = new Set(reviews.filter((r) => r.day === dayKey(now)).map((r) => r.entryId));
  const dayEnd = endOfLearningDay(now);

  const due: StudyItem[] = [];
  for (const c of cards) {
    if (c.phase === 'new' || !dirs.includes(c.direction)) continue;
    const entry = byId.get(c.entryId);
    if (!entry || !inTopics(entry, settings.topics)) continue;
    const isLearning = c.phase === 'learning' || c.phase === 'relearning';
    if (isLearning ? c.due <= now + LEARN_AHEAD : c.due < dayEnd) due.push({ entry, direction: c.direction, card: c });
  }
  due.sort((a, b) => a.card.due - b.card.due);

  const learningDue = due.filter((i) => i.card.phase !== 'review');
  const reviewDue = due
    .filter((i) => i.card.phase === 'review')
    .slice(0, Math.max(0, settings.maxReviewsPerDay - counts.reviewsDone));

  const used = new Set([...learningDue, ...reviewDue].map((i) => i.entry.id));
  const fresh: StudyItem[] = [];
  let budget = Math.max(0, settings.newPerDay - counts.newDone);
  if (budget > 0) {
    const pool = [...byId.values()].filter((e) => inTopics(e, settings.topics)).sort(newOrder);
    for (const entry of pool) {
      if (budget <= 0) break;
      if (used.has(entry.id)) continue;
      // Bei "gemischt" zuerst Wiedererkennen (it→de), die Gegenrichtung folgt an einem späteren Tag
      for (const direction of dirs) {
        const id = cardId(entry.id, direction);
        const existing = cardMap.get(id);
        if (existing && existing.phase !== 'new') continue;
        if (studiedToday.has(entry.id)) break;
        fresh.push({ entry, direction, card: existing ?? newCard(entry.id, direction, now) });
        used.add(entry.id);
        budget--;
        break;
      }
    }
  }

  return { due: [...learningDue, ...reviewDue], fresh };
}

/** Mischt neue Karten zwischen die Wiederholungen */
export function interleave(due: StudyItem[], fresh: StudyItem[]): StudyItem[] {
  if (!fresh.length) return due;
  if (!due.length) return fresh;
  const out: StudyItem[] = [];
  const every = Math.max(1, Math.round(due.length / fresh.length));
  let f = 0;
  due.forEach((item, i) => {
    out.push(item);
    if ((i + 1) % every === 0 && f < fresh.length) out.push(fresh[f++]);
  });
  while (f < fresh.length) out.push(fresh[f++]);
  return out;
}

export function exerciseOptions(item: StudyItem, enabled: ExerciseType[]): ExerciseType[] {
  const { entry, direction } = item;
  const opts: ExerciseType[] = [];
  for (const ex of enabled) {
    switch (ex) {
      case 'flip':
      case 'type':
      case 'choice':
        opts.push(ex);
        break;
      case 'cloze':
        if (direction === 'de-it' && ((entry.kind === 'word' && entry.exampleIt?.includes('*')) || (entry.kind === 'phrase' && entry.it.split(' ').length >= 3)))
          opts.push(ex);
        break;
      case 'order':
        if (direction === 'de-it' && entry.kind === 'phrase' && entry.it.split(' ').length >= 3) opts.push(ex);
        break;
      case 'listen':
        if (direction === 'it-de') opts.push(ex);
        break;
    }
  }
  return opts.length ? opts : ['flip'];
}

/** Wählt eine abwechslungsreiche Übung; neue Karten werden zuerst mit Karteikarte oder Auswahl eingeführt */
export function chooseExercise(item: StudyItem, enabled: ExerciseType[], rnd = Math.random): ExerciseType {
  const opts = exerciseOptions(item, enabled);
  if (item.card.phase === 'new') {
    const intro = opts.filter((o) => o === 'flip' || o === 'choice');
    if (intro.length) return pick(intro, rnd);
  }
  // Satzbau und Lücke bevorzugt für Sätze
  if (item.entry.kind === 'phrase') {
    const special = opts.filter((o) => o === 'order' || o === 'cloze');
    if (special.length && rnd() < 0.5) return pick(special, rnd);
  }
  return pick(opts, rnd);
}
