import Dexie, { type Table } from 'dexie';
import { SEED_VERSION, seedEntries } from '../data/seed';
import { cardId, newCard, schedule } from './srs';
import type { CardState, Direction, Entry, ExerciseType, Meta, Rating, ReviewLog, Settings } from './types';
import { dayKey, uid } from './util';
import { xpFor } from './gamification';

class VokabelDB extends Dexie {
  entries!: Table<Entry, string>;
  cards!: Table<CardState, string>;
  reviews!: Table<ReviewLog, string>;
  meta!: Table<Meta, string>;

  constructor(name = 'parliamo') {
    super(name);
    this.version(1).stores({
      entries: 'id, topic, kind, pos, updatedAt, source',
      cards: 'id, entryId, direction, due, phase, updatedAt',
      reviews: 'id, cardId, entryId, day, ts',
      meta: 'key',
    });
  }
}

export const db = new VokabelDB();

export const DEFAULT_SETTINGS: Settings = {
  direction: 'mix',
  newPerDay: 15,
  maxReviewsPerDay: 200,
  dailyGoal: 30,
  topics: [],
  exercises: ['flip', 'type', 'choice', 'cloze', 'order', 'listen'],
  strictAccents: false,
  autoSpeak: true,
  speechRate: 0.9,
  theme: 'auto',
  ai: {
    engine: 'webllm',
    webllmModel: 'Qwen2.5-3B-Instruct-q4f16_1-MLC',
    ollamaUrl: 'http://localhost:11434',
    ollamaModel: 'qwen2.5:7b',
  },
};

export async function getSettings(): Promise<Settings> {
  const row = await db.meta.get('settings');
  const s = (row?.value ?? {}) as Partial<Settings>;
  return { ...DEFAULT_SETTINGS, ...s, ai: { ...DEFAULT_SETTINGS.ai, ...(s.ai ?? {}) } };
}

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  const cur = await getSettings();
  await db.meta.put({ key: 'settings', value: { ...cur, ...patch } });
}

export async function getMeta<T>(key: string, fallback: T): Promise<T> {
  const row = await db.meta.get(key);
  return (row?.value as T) ?? fallback;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}

/** Geräte-ID – Vorbereitung für einen späteren Abgleich zwischen Handy und Tablet */
export async function deviceId(): Promise<string> {
  let id = await getMeta<string | null>('deviceId', null);
  if (!id) {
    id = uid();
    await setMeta('deviceId', id);
  }
  return id;
}

/** Lädt die Startdaten beim ersten Start; neue Versionen ergänzen nur fehlende Einträge */
export async function ensureSeeded(): Promise<void> {
  const version = await getMeta<number>('seedVersion', 0);
  if (version >= SEED_VERSION) return;
  const seeds = seedEntries();
  await db.transaction('rw', db.entries, db.meta, async () => {
    const existing = new Set(await db.entries.toCollection().primaryKeys());
    const missing = seeds.filter((e) => !existing.has(e.id));
    await db.entries.bulkAdd(missing);
    await db.meta.put({ key: 'seedVersion', value: SEED_VERSION });
  });
  await deviceId();
}

export async function recordReview(params: {
  entryId: string;
  direction: Direction;
  rating: Rating;
  exercise: ExerciseType;
  hints: number;
  srs: boolean;
  now?: number;
}): Promise<{ card: CardState; log: ReviewLog }> {
  const now = params.now ?? Date.now();
  const id = cardId(params.entryId, params.direction);
  return db.transaction('rw', db.cards, db.reviews, async () => {
    const before = (await db.cards.get(id)) ?? newCard(params.entryId, params.direction, now);
    const card = params.srs ? schedule(before, params.rating, now) : before;
    if (params.srs) await db.cards.put(card);
    const log: ReviewLog = {
      id: uid(),
      cardId: id,
      entryId: params.entryId,
      direction: params.direction,
      rating: params.rating,
      exercise: params.exercise,
      hints: params.hints,
      srs: params.srs,
      xp: xpFor(params.rating, params.hints, params.srs),
      ts: now,
      day: dayKey(now),
      prevPhase: before.phase,
    };
    await db.reviews.add(log);
    return { card, log };
  });
}

export async function saveEntry(entry: Entry): Promise<void> {
  await db.entries.put({ ...entry, updatedAt: Date.now() });
}

/** Weiches Löschen (für späteren Abgleich), Lernstand wird entfernt */
export async function deleteEntry(id: string): Promise<void> {
  await db.transaction('rw', db.entries, db.cards, async () => {
    const e = await db.entries.get(id);
    if (e) await db.entries.put({ ...e, deleted: true, updatedAt: Date.now() });
    await db.cards.where('entryId').equals(id).delete();
  });
}

export async function resetProgress(entryId: string): Promise<void> {
  await db.cards.where('entryId').equals(entryId).delete();
}

export interface Backup {
  app: 'parliamo';
  version: 1;
  exportedAt: string;
  deviceId: string;
  entries: Entry[];
  cards: CardState[];
  reviews: ReviewLog[];
  meta: Meta[];
}

export async function exportBackup(): Promise<Backup> {
  return {
    app: 'parliamo',
    version: 1,
    exportedAt: new Date().toISOString(),
    deviceId: await deviceId(),
    entries: await db.entries.toArray(),
    cards: await db.cards.toArray(),
    reviews: await db.reviews.toArray(),
    meta: (await db.meta.toArray()).filter((m) => m.key !== 'deviceId'),
  };
}

/**
 * Spielt eine Sicherung ein. Zusammenführen nach "neuester Stand gewinnt" (updatedAt),
 * Lernprotokolle werden vereinigt – so lassen sich zwei Geräte per Datei abgleichen.
 */
export async function importBackup(b: Backup): Promise<{ entries: number; cards: number; reviews: number }> {
  if (b.app !== 'parliamo') throw new Error('Das ist keine Parliamo-Sicherung.');
  let entries = 0;
  let cards = 0;
  let reviews = 0;
  await db.transaction('rw', db.entries, db.cards, db.reviews, db.meta, async () => {
    for (const e of b.entries) {
      const cur = await db.entries.get(e.id);
      if (!cur || cur.updatedAt < e.updatedAt) {
        await db.entries.put(e);
        entries++;
      }
    }
    for (const c of b.cards) {
      const cur = await db.cards.get(c.id);
      if (!cur || cur.updatedAt < c.updatedAt) {
        await db.cards.put(c);
        cards++;
      }
    }
    const known = new Set(await db.reviews.toCollection().primaryKeys());
    const fresh = b.reviews.filter((r) => !known.has(r.id));
    await db.reviews.bulkAdd(fresh);
    reviews = fresh.length;
    for (const m of b.meta) {
      if (m.key === 'settings' || m.key === 'badges') await db.meta.put(m);
    }
  });
  return { entries, cards, reviews };
}

export async function wipeAll(): Promise<void> {
  await db.transaction('rw', db.entries, db.cards, db.reviews, db.meta, async () => {
    await Promise.all([db.entries.clear(), db.cards.clear(), db.reviews.clear(), db.meta.clear()]);
  });
  await ensureSeeded();
}
