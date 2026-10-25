import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { DEFAULT_SETTINGS, db, getSettings } from './db';
import type { CardState, Entry, ReviewLog, Settings } from './types';
import { topicEmoji } from '../data/topics';

export function useSettings(): Settings {
  return useLiveQuery(getSettings, [], DEFAULT_SETTINGS);
}

export function useEntries(): Entry[] | undefined {
  return useLiveQuery(async () => (await db.entries.toArray()).filter((e) => !e.deleted), []);
}

export function useCards(): CardState[] | undefined {
  return useLiveQuery(() => db.cards.toArray(), []);
}

export function useReviews(): ReviewLog[] | undefined {
  return useLiveQuery(() => db.reviews.toArray(), []);
}

export function useTopics(entries: Entry[] | undefined) {
  return useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of entries ?? []) counts.set(e.topic, (counts.get(e.topic) ?? 0) + 1);
    const rankOf = new Map<string, number>();
    for (const e of entries ?? []) rankOf.set(e.topic, Math.min(rankOf.get(e.topic) ?? Infinity, e.source === 'seed' ? (e.rank ?? 0) : -1));
    return [...counts.entries()]
      .sort((a, b) => (rankOf.get(a[0])! - rankOf.get(b[0])!) || a[0].localeCompare(b[0]))
      .map(([name, count]) => ({ name, count, emoji: topicEmoji(name) }));
  }, [entries]);
}
