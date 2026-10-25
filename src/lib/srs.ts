import type { CardState, Direction, Rating } from './types';
import { DAY, MINUTE } from './util';

/**
 * Wiederholungsplan nach dem Anki-Verfahren (SM-2 mit Lernschritten).
 * Neue Karten durchlaufen kurze Lernschritte (1 Min, 10 Min) und wandern dann
 * in die Wiederholung mit wachsenden Intervallen in Tagen.
 */
export const SRS = {
  learningSteps: [1 * MINUTE, 10 * MINUTE],
  relearningSteps: [10 * MINUTE],
  graduatingInterval: 1,
  easyInterval: 4,
  startEase: 2.5,
  minEase: 1.3,
  hardFactor: 1.2,
  easyBonus: 1.3,
  lapseFactor: 0.5,
  maxInterval: 365 * 3,
};

export function newCard(entryId: string, direction: Direction, now = Date.now()): CardState {
  return {
    id: cardId(entryId, direction),
    entryId,
    direction,
    phase: 'new',
    due: now,
    interval: 0,
    ease: SRS.startEase,
    step: 0,
    reps: 0,
    lapses: 0,
    updatedAt: now,
  };
}

export function cardId(entryId: string, direction: Direction): string {
  return `${entryId}|${direction}`;
}

function capInterval(days: number): number {
  return Math.min(SRS.maxInterval, Math.max(1, Math.round(days)));
}

export function schedule(card: CardState, rating: Rating, now = Date.now()): CardState {
  const c: CardState = { ...card, reps: card.reps + 1, lastReview: now, updatedAt: now };

  if (card.phase === 'new' || card.phase === 'learning') {
    const steps = SRS.learningSteps;
    const step = card.phase === 'new' ? 0 : card.step;
    if (rating === 4) return graduate(c, SRS.easyInterval, now);
    if (rating === 1) return { ...c, phase: 'learning', step: 0, due: now + steps[0] };
    if (rating === 2) {
      const cur = steps[step];
      const next = steps[step + 1] ?? cur * 1.5;
      const delay = step === 0 ? (cur + next) / 2 : cur;
      return { ...c, phase: 'learning', step, due: now + delay };
    }
    // Gut
    const nextStep = step + 1;
    if (nextStep >= steps.length) return graduate(c, SRS.graduatingInterval, now);
    return { ...c, phase: 'learning', step: nextStep, due: now + steps[nextStep] };
  }

  if (card.phase === 'relearning') {
    const steps = SRS.relearningSteps;
    if (rating === 1) return { ...c, step: 0, due: now + steps[0] };
    if (rating === 2) return { ...c, due: now + steps[card.step] };
    if (rating === 4) return { ...c, phase: 'review', step: 0, interval: capInterval(card.interval + 1), due: now + capInterval(card.interval + 1) * DAY };
    const nextStep = card.step + 1;
    if (nextStep >= steps.length) {
      return { ...c, phase: 'review', step: 0, due: now + card.interval * DAY };
    }
    return { ...c, step: nextStep, due: now + steps[nextStep] };
  }

  // review
  const elapsedDays = card.lastReview ? Math.max(0, (now - card.lastReview) / DAY) : card.interval;
  if (rating === 1) {
    const interval = capInterval(card.interval * SRS.lapseFactor);
    return {
      ...c,
      phase: 'relearning',
      step: 0,
      lapses: card.lapses + 1,
      ease: Math.max(SRS.minEase, card.ease - 0.2),
      interval,
      due: now + SRS.relearningSteps[0],
    };
  }
  let interval: number;
  let ease = card.ease;
  if (rating === 2) {
    interval = Math.max(card.interval + 1, card.interval * SRS.hardFactor);
    ease = Math.max(SRS.minEase, ease - 0.15);
  } else if (rating === 3) {
    const base = Math.max(card.interval, (card.interval + elapsedDays) / 2);
    interval = Math.max(card.interval + 1, base * ease);
  } else {
    const base = Math.max(card.interval, elapsedDays);
    interval = Math.max(card.interval + 2, base * ease * SRS.easyBonus);
    ease += 0.15;
  }
  interval = capInterval(interval);
  return { ...c, ease, interval, due: now + interval * DAY };
}

function graduate(c: CardState, days: number, now: number): CardState {
  return { ...c, phase: 'review', step: 0, interval: days, due: now + days * DAY };
}

/** Vorschau: wann käme die Karte bei jeder Bewertung wieder? */
export function previewIntervals(card: CardState, now = Date.now()): Record<Rating, number> {
  const out = {} as Record<Rating, number>;
  for (const r of [1, 2, 3, 4] as Rating[]) out[r] = schedule(card, r, now).due - now;
  return out;
}

export type Mastery = 'new' | 'learning' | 'young' | 'mature';

export function mastery(card?: CardState): Mastery {
  if (!card || card.phase === 'new') return 'new';
  if (card.phase !== 'review') return 'learning';
  return card.interval >= 21 ? 'mature' : 'young';
}

export const MASTERY_LABEL: Record<Mastery, string> = {
  new: 'Neu',
  learning: 'Lernend',
  young: 'Gefestigt',
  mature: 'Gemeistert',
};

export const RATING_LABEL: Record<Rating, string> = {
  1: 'Nochmal',
  2: 'Schwer',
  3: 'Gut',
  4: 'Leicht',
};
