import type { Direction, Entry } from './types';
import { shuffle } from './util';

/** Falsche Antwortmöglichkeiten: gleiche Art, möglichst gleiche Wortart und gleiches Thema */
export function distractors(entry: Entry, pool: Entry[], direction: Direction, n = 3, rnd = Math.random): string[] {
  const field = direction === 'de-it' ? 'it' : 'de';
  const answer = entry[field].toLowerCase();
  const candidates = pool.filter((e) => e.id !== entry.id && !e.deleted && e.kind === entry.kind && e[field].toLowerCase() !== answer);
  const score = (e: Entry) => (e.pos === entry.pos ? 2 : 0) + (e.topic === entry.topic ? 1 : 0) + (e.gender === entry.gender ? 0.5 : 0);
  const ranked = shuffle(candidates, rnd).sort((a, b) => score(b) - score(a));
  const out: string[] = [];
  for (const e of ranked.slice(0, n * 6)) {
    const text = e[field];
    if (!out.includes(text)) out.push(text);
  }
  return shuffle(out, rnd).slice(0, n);
}
