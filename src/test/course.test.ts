import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, db, ensureSeeded } from '../lib/db';
import { buildQueue } from '../lib/session';
import type { Entry } from '../lib/types';

function entry(it: string, extra: Partial<Entry> = {}): Entry {
  return { id: 'e:' + it, it, de: it, kind: 'word', topic: 'Test', source: 'seed', createdAt: 0, updatedAt: 0, ...extra };
}

describe('Unterricht', () => {
  it('neue Karten aus dem Unterricht kommen zuerst', () => {
    const entries = [entry('a', { rank: 0 }), entry('b', { rank: 1, course: true, lesson: 'L1' })];
    const { fresh } = buildQueue(entries, [], [], { ...DEFAULT_SETTINGS, newPerDay: 1, direction: 'de-it' });
    expect(fresh[0].entry.it).toBe('b');
  });

  it('Filter „nur Unterricht“ und Lektionen', () => {
    const entries = [entry('a'), entry('b', { course: true, lesson: 'L1' }), entry('c', { course: true, lesson: 'L2' })];
    const s = { ...DEFAULT_SETTINGS, newPerDay: 10, direction: 'de-it' as const, courseOnly: true };
    expect(buildQueue(entries, [], [], s).fresh.map((f) => f.entry.it)).toEqual(['b', 'c']);
    expect(buildQueue(entries, [], [], { ...s, lessons: ['L2'] }).fresh.map((f) => f.entry.it)).toEqual(['c']);
  });

  it('Update der Startdaten markiert vorhandene Einträge, eigene Änderungen bleiben', async () => {
    await db.meta.put({ key: 'seedVersion', value: 1 });
    await db.entries.put(entry('il cappuccino', { id: 'seed:il-cappuccino', de: 'mein eigener Text' }));
    await ensureSeeded();
    const cap = await db.entries.get('seed:il-cappuccino');
    expect(cap?.course).toBe(true);
    expect(cap?.lesson).toBe('Akt 11 · Im Café');
    expect(cap?.de).toBe('mein eigener Text');
    expect(await db.entries.get('seed:il-barista')).toBeTruthy();
  });
});
