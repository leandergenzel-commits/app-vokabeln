import type { CardState, Entry, Rating, ReviewLog } from './types';
import { addDays, dayKey } from './util';
import { mastery } from './srs';

export function xpFor(rating: Rating, hints: number, srs: boolean): number {
  const base = { 1: 2, 2: 6, 3: 10, 4: 12 }[rating];
  const xp = Math.max(1, base - hints * 2);
  return srs ? xp : Math.ceil(xp / 2);
}

export const LEVELS = [
  { name: 'Turista', emoji: '🧳' },
  { name: 'Viaggiatore', emoji: '🗺️' },
  { name: 'Apprendista', emoji: '📖' },
  { name: 'Chiacchierone', emoji: '💬' },
  { name: 'Buongustaio', emoji: '🍕' },
  { name: 'Cittadino', emoji: '🏘️' },
  { name: 'Romano', emoji: '🏛️' },
  { name: 'Veneziano', emoji: '🛶' },
  { name: 'Fiorentino', emoji: '🎨' },
  { name: 'Maestro', emoji: '🎓' },
  { name: 'Poeta', emoji: '🪶' },
  { name: 'Dante', emoji: '👑' },
];

/** XP, die man insgesamt für Level n (ab 1) braucht */
export function xpForLevel(n: number): number {
  return 75 * (n - 1) * n;
}

export function levelInfo(totalXp: number) {
  let level = 1;
  while (totalXp >= xpForLevel(level + 1)) level++;
  const cur = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const meta = LEVELS[Math.min(level - 1, LEVELS.length - 1)];
  return { level, ...meta, xpInLevel: totalXp - cur, xpForNext: next - cur, progress: (totalXp - cur) / (next - cur) };
}

/** Lernserie: aufeinanderfolgende Tage mit mindestens einer Wiederholung (heute zählt, wenn schon gelernt) */
export function streak(days: Set<string>, today = dayKey()): { current: number; best: number } {
  let current = 0;
  let d = days.has(today) ? today : addDays(today, -1);
  while (days.has(d)) {
    current++;
    d = addDays(d, -1);
  }
  const sorted = [...days].sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const day of sorted) {
    run = prev && addDays(prev, 1) === day ? run + 1 : 1;
    best = Math.max(best, run);
    prev = day;
  }
  return { current, best: Math.max(best, current) };
}

export interface Badge {
  id: string;
  emoji: string;
  name: string;
  description: string;
  /** Fortschritt 0..1 */
  progress: number;
}

interface BadgeInput {
  reviews: ReviewLog[];
  cards: CardState[];
  entries: Entry[];
  streakBest: number;
}

export function computeBadges({ reviews, cards, entries, streakBest }: BadgeInput): Badge[] {
  const srsReviews = reviews.filter((r) => r.srs);
  const total = reviews.length;
  const learnedEntries = new Set(cards.filter((c) => c.phase !== 'new').map((c) => c.entryId));
  const learned = learnedEntries.size;
  const mature = cards.filter((c) => mastery(c) === 'mature').length;
  const byEntry = new Map(entries.map((e) => [e.id, e]));
  const hours = reviews.map((r) => new Date(r.ts).getHours());
  const exercises = new Set(reviews.map((r) => r.exercise));
  const noHintGood = srsReviews.filter((r) => r.rating >= 3 && r.hints === 0).length;

  const topicShare = (pred: (e: Entry) => boolean) => {
    const pool = entries.filter((e) => !e.deleted && pred(e));
    if (!pool.length) return 0;
    return pool.filter((e) => learnedEntries.has(e.id)).length / pool.length;
  };

  // Längste Folge ohne "Nochmal" an einem Tag
  let bestRun = 0;
  let run = 0;
  for (const r of srsReviews.slice().sort((a, b) => a.ts - b.ts)) {
    run = r.rating > 1 ? run + 1 : 0;
    bestRun = Math.max(bestRun, run);
  }

  const ratio = (n: number, goal: number) => Math.min(1, n / goal);
  const colloquialLearned = [...learnedEntries].filter((id) => byEntry.get(id)?.colloquial || byEntry.get(id)?.topic.includes('Umgangssprache')).length;

  return [
    { id: 'primo-passo', emoji: '👣', name: 'Primo passo', description: 'Die erste Karte gelernt', progress: ratio(total, 1) },
    { id: 'cento', emoji: '💯', name: 'Cento', description: '100 Wiederholungen', progress: ratio(total, 100) },
    { id: 'mille', emoji: '🏆', name: 'Mille', description: '1000 Wiederholungen', progress: ratio(total, 1000) },
    { id: 'settimana', emoji: '🔥', name: 'Una settimana', description: '7 Tage Lernserie', progress: ratio(streakBest, 7) },
    { id: 'mese', emoji: '🌋', name: 'Un mese', description: '30 Tage Lernserie', progress: ratio(streakBest, 30) },
    { id: 'parole-50', emoji: '🌱', name: 'Germoglio', description: '50 Einträge begonnen', progress: ratio(learned, 50) },
    { id: 'parole-250', emoji: '🌿', name: 'Alberello', description: '250 Einträge begonnen', progress: ratio(learned, 250) },
    { id: 'parole-1000', emoji: '🌳', name: 'Quercia', description: '1000 Einträge begonnen', progress: ratio(learned, 1000) },
    { id: 'maturi-100', emoji: '🧠', name: 'Memoria d’elefante', description: '100 Karten gemeistert (Intervall ≥ 21 Tage)', progress: ratio(mature, 100) },
    { id: 'serie-25', emoji: '🎯', name: 'Cecchino', description: '25 Karten am Stück ohne „Nochmal“', progress: ratio(bestRun, 25) },
    { id: 'senza-aiuto', emoji: '🦅', name: 'Senza aiuto', description: '200 Karten ohne Hilfe richtig', progress: ratio(noHintGood, 200) },
    { id: 'ristorante', emoji: '🍝', name: 'Buon appetito', description: 'Alle Restaurant-Sätze begonnen', progress: topicShare((e) => e.topic === 'Sätze: Restaurant') },
    { id: 'chiacchiere', emoji: '🤌', name: 'Come un italiano', description: '30 umgangssprachliche Einträge gelernt', progress: ratio(colloquialLearned, 30) },
    { id: 'tuttofare', emoji: '🧰', name: 'Tuttofare', description: '6 verschiedene Übungsarten genutzt', progress: ratio(exercises.size, 6) },
    { id: 'gufo', emoji: '🦉', name: 'Nottambulo', description: 'Nach 22 Uhr gelernt', progress: hours.some((h) => h >= 22 || h < 4) ? 1 : 0 },
    { id: 'gallo', emoji: '🐓', name: 'Mattiniero', description: 'Vor 7 Uhr gelernt', progress: hours.some((h) => h >= 4 && h < 7) ? 1 : 0 },
  ];
}
