import { describe, expect, it } from 'vitest';
import { SEED_FILES, parseSeed, seedEntries } from '../data/seed';
import { splitArticle } from '../lib/check';
import { presentTense } from '../lib/conjugate';
import { slug } from '../lib/util';

describe('Startdaten', () => {
  const all = seedEntries();

  it('enthält rund 1000 Vokabeln und viele Alltagssätze', () => {
    const words = all.filter((e) => e.kind === 'word');
    const phrases = all.filter((e) => e.kind === 'phrase');
    expect(words.length).toBeGreaterThanOrEqual(1000);
    expect(phrases.length).toBeGreaterThanOrEqual(150);
  });

  it('hat keine doppelten IDs in den Dateien', () => {
    const seen = new Map<string, string>();
    const dups: string[] = [];
    for (const file of SEED_FILES) {
      for (const e of parseSeed(file)) {
        if (seen.has(e.id)) dups.push(`${e.it} (schon: ${seen.get(e.id)})`);
        seen.set(e.id, e.it);
      }
    }
    expect(dups).toEqual([]);
  });

  it('jede Zeile hat Italienisch, Deutsch und Wortart', () => {
    const bad = all.filter((e) => !e.it || !e.de || !e.pos);
    expect(bad.map((e) => e.it)).toEqual([]);
  });

  it('Nomen mit bestimmtem Artikel haben ein passendes Geschlecht', () => {
    const wrong: string[] = [];
    for (const e of all.filter((x) => x.pos === 'noun')) {
      const { article } = splitArticle(e.it);
      if (!article || article === "l'") continue;
      const masc = ['il', 'lo', 'i', 'gli'].includes(article);
      if (e.gender === 'mf') continue;
      if ((masc && e.gender !== 'm') || (!masc && e.gender !== 'f')) wrong.push(`${e.it} (${e.gender})`);
    }
    expect(wrong).toEqual([]);
  });

  it('Beispielsätze markieren das Zielwort genau einmal', () => {
    const bad = all.filter((e) => e.exampleIt && (e.exampleIt.match(/\*/g) ?? []).length !== 2);
    expect(bad.map((e) => e.exampleIt)).toEqual([]);
  });

  it('unregelmäßige Konjugationen haben sechs Formen', () => {
    const bad = all.filter((e) => e.conj && e.conj.length !== 6);
    expect(bad.map((e) => e.it)).toEqual([]);
  });

  it('fast alle Verben lassen sich konjugieren', () => {
    const verbs = all.filter((e) => e.pos === 'verb');
    const ok = verbs.filter((v) => presentTense(v));
    expect(ok.length / verbs.length).toBeGreaterThan(0.95);
  });

  it('IDs sind stabil (aus dem italienischen Text abgeleitet)', () => {
    expect(all[0].id).toBe('seed:' + slug(all[0].it));
  });
});
