import { describe, expect, it } from 'vitest';
import { checkAnswer, splitArticle, suggestRating } from '../lib/check';
import { conjugateRegular, presentTense } from '../lib/conjugate';
import { newCard, schedule, mastery } from '../lib/srs';
import { buildHints, structureHint, clozeSentence } from '../lib/hints';
import { buildQueue, chooseExercise } from '../lib/session';
import { DEFAULT_SETTINGS } from '../lib/db';
import { extractJson, itemsFromJson, itemToEntry, parseSimpleList } from '../ai/schema';
import { streak, levelInfo } from '../lib/gamification';
import { DAY, MINUTE, addDays, dayKey } from '../lib/util';
import type { Entry, ReviewLog } from '../lib/types';

const T0 = new Date(2026, 9, 25, 12).getTime();

function entry(it: string, de: string, extra: Partial<Entry> = {}): Entry {
  return { id: 'e:' + it, it, de, kind: 'word', topic: 'Test', source: 'seed', createdAt: 0, updatedAt: 0, ...extra };
}

describe('Wiederholungsplan (Anki/SM-2)', () => {
  it('neue Karte: Gut → 10 Min, nochmal Gut → 1 Tag', () => {
    let c = newCard('a', 'de-it', T0);
    c = schedule(c, 3, T0);
    expect(c.phase).toBe('learning');
    expect(c.due - T0).toBe(10 * MINUTE);
    c = schedule(c, 3, T0 + 10 * MINUTE);
    expect(c.phase).toBe('review');
    expect(c.interval).toBe(1);
  });

  it('Leicht überspringt die Lernphase (4 Tage)', () => {
    const c = schedule(newCard('a', 'de-it', T0), 4, T0);
    expect(c.phase).toBe('review');
    expect(c.interval).toBe(4);
  });

  it('Intervalle wachsen, Vergessen führt zurück in die Lernphase', () => {
    let c = schedule(newCard('a', 'de-it', T0), 4, T0);
    let now = T0 + 4 * DAY;
    c = schedule(c, 3, now);
    expect(c.interval).toBe(10);
    now += 10 * DAY;
    c = schedule(c, 3, now);
    expect(c.interval).toBe(25);
    expect(mastery(c)).toBe('mature');
    c = schedule(c, 1, now + 25 * DAY);
    expect(c.phase).toBe('relearning');
    expect(c.lapses).toBe(1);
    expect(c.ease).toBeCloseTo(2.3);
  });

  it('Schwer wächst langsamer als Gut, Leicht schneller', () => {
    const base = { ...newCard('a', 'de-it', T0), phase: 'review' as const, interval: 10, lastReview: T0 - 10 * DAY };
    const hard = schedule(base, 2, T0).interval;
    const good = schedule(base, 3, T0).interval;
    const easy = schedule(base, 4, T0).interval;
    expect(hard).toBeLessThan(good);
    expect(good).toBeLessThan(easy);
  });
});

describe('Antwortprüfung', () => {
  it('akzeptiert exakte Antworten und Alternativen', () => {
    expect(checkAnswer('das Fenster', 'das Fenster', { lang: 'de', isWord: true }).verdict).toBe('correct');
    expect(checkAnswer('Fenster', 'das Fenster', { lang: 'de', isWord: true }).verdict).toBe('correct');
    expect(checkAnswer('tschüss', 'hallo; tschüss', { lang: 'de', isWord: true }).verdict).toBe('correct');
    expect(checkAnswer('bella', 'bello/bella', { lang: 'it', isWord: true }).verdict).toBe('correct');
  });

  it('Tippfehler → fast richtig', () => {
    const r = checkAnswer('la finesta', 'la finestra', { lang: 'it', isWord: true });
    expect(r.verdict).toBe('almost');
  });

  it('fehlende oder falsche Artikel werden erkannt', () => {
    const missing = checkAnswer('finestra', 'la finestra', { lang: 'it', isWord: true });
    expect(missing.verdict).toBe('almost');
    expect(missing.notes.join()).toContain('Artikel');
    const wrong = checkAnswer('il finestra', 'la finestra', { lang: 'it', isWord: true });
    expect(wrong.verdict).toBe('almost');
    expect(wrong.notes.join()).toContain('Falscher Artikel');
    expect(checkAnswer("l'acqua", "l'acqua", { lang: 'it', isWord: true }).verdict).toBe('correct');
  });

  it('Akzente: Hinweis, im strengen Modus nur fast richtig', () => {
    expect(checkAnswer('citta', 'la città', { lang: 'it', isWord: false }).verdict).toBe('wrong');
    const lax = checkAnswer('la citta', 'la città', { lang: 'it', isWord: true });
    expect(lax.verdict).toBe('correct');
    expect(lax.notes.join()).toContain('Akzent');
    expect(checkAnswer('la citta', 'la città', { lang: 'it', isWord: true, strictAccents: true }).verdict).toBe('almost');
  });

  it('Satzzeichen und Großschreibung sind egal', () => {
    expect(checkAnswer('il conto per favore', 'Il conto, per favore.', { lang: 'it', isWord: false }).verdict).toBe('correct');
  });

  it('Bewertungsvorschlag berücksichtigt Hilfen', () => {
    expect(suggestRating('correct', 0)).toBe(3);
    expect(suggestRating('correct', 2)).toBe(2);
    expect(suggestRating('wrong', 0)).toBe(1);
  });

  it('Artikel werden zerlegt', () => {
    expect(splitArticle("l'uomo")).toEqual({ article: "l'", rest: 'uomo' });
    expect(splitArticle('gli occhiali')).toEqual({ article: 'gli', rest: 'occhiali' });
    expect(splitArticle('ciao').article).toBeNull();
  });
});

describe('Konjugation', () => {
  it('regelmäßige Verben', () => {
    expect(conjugateRegular('parlare')).toEqual(['parlo', 'parli', 'parla', 'parliamo', 'parlate', 'parlano']);
    expect(conjugateRegular('cercare')).toEqual(['cerco', 'cerchi', 'cerca', 'cerchiamo', 'cercate', 'cercano']);
    expect(conjugateRegular('mangiare')).toEqual(['mangio', 'mangi', 'mangia', 'mangiamo', 'mangiate', 'mangiano']);
    expect(conjugateRegular('studiare')).toEqual(['studio', 'studi', 'studia', 'studiamo', 'studiate', 'studiano']);
    expect(conjugateRegular('vendere')).toEqual(['vendo', 'vendi', 'vende', 'vendiamo', 'vendete', 'vendono']);
    expect(conjugateRegular('dormire')).toEqual(['dormo', 'dormi', 'dorme', 'dormiamo', 'dormite', 'dormono']);
    expect(conjugateRegular('capire', true)).toEqual(['capisco', 'capisci', 'capisce', 'capiamo', 'capite', 'capiscono']);
    expect(conjugateRegular('chiamarsi')?.[0]).toBe('mi chiamo');
    expect(conjugateRegular('vestirsi')?.[3]).toBe('ci vestiamo');
  });

  it('unregelmäßige Formen kommen aus den Daten', () => {
    expect(presentTense({ it: 'andare', conj: ['vado', 'vai', 'va', 'andiamo', 'andate', 'vanno'] })?.[0]).toBe('vado');
    expect(presentTense({ it: 'avere bisogno di' })).toBeNull();
  });
});

describe('Hilfen', () => {
  const e = entry('la finestra', 'das Fenster', {
    pos: 'noun',
    gender: 'f',
    emoji: '🪟',
    mnemonic: 'finster',
    related: 'lat. fenestra',
    exampleIt: 'Apri la *finestra*!',
    exampleDe: 'Mach das Fenster auf!',
  });

  it('Hilfeleiter: Form → Bild → Verwandte → Beispiel', () => {
    const h = buildHints(e, 'de-it');
    expect(h.map((x) => x.title)).toEqual(['Form', 'Bild & Eselsbrücke', 'Verwandte Wörter', 'Beispielsatz']);
    expect(h[0].text).toContain('la f_______');
    expect(h[0].text).toContain('feminin');
    expect(h[3].text).toContain('_____');
  });

  it('Form-Hilfe für deutsche Antworten behält den Artikel', () => {
    expect(structureHint('das Fenster', 'de')).toBe('das  F______');
  });

  it('Lückensatz', () => {
    expect(clozeSentence('Apri la *finestra*!')).toEqual({ text: 'Apri la _____!', answer: 'finestra' });
  });
});

describe('Lernsitzung', () => {
  const entries = [entry('uno', 'eins', { rank: 0 }), entry('due', 'zwei', { rank: 1 }), entry('tre', 'drei', { rank: 2 })];

  it('neue Karten bis zum Tageslimit, bei "gemischt" erst it→de', () => {
    const { due, fresh } = buildQueue(entries, [], [], { ...DEFAULT_SETTINGS, newPerDay: 2, direction: 'mix' }, T0);
    expect(due).toHaveLength(0);
    expect(fresh.map((f) => f.entry.it)).toEqual(['uno', 'due']);
    expect(fresh.every((f) => f.direction === 'it-de')).toBe(true);
  });

  it('heute schon gelernte neue Karten zählen gegen das Limit', () => {
    const log: ReviewLog = {
      id: 'r1', cardId: 'e:uno|de-it', entryId: 'e:uno', direction: 'de-it', rating: 3, exercise: 'flip',
      hints: 0, srs: true, xp: 10, ts: T0, day: dayKey(T0), prevPhase: 'new',
    };
    const { fresh } = buildQueue(entries, [], [log], { ...DEFAULT_SETTINGS, newPerDay: 2, direction: 'de-it' }, T0);
    expect(fresh.map((f) => f.entry.it)).toEqual(['due']);
  });

  it('fällige Wiederholungen werden gefunden', () => {
    const card = { ...schedule(newCard('e:tre', 'de-it', T0 - 5 * DAY), 4, T0 - 5 * DAY) };
    const { due } = buildQueue(entries, [card], [], { ...DEFAULT_SETTINGS, newPerDay: 0, direction: 'de-it' }, T0);
    expect(due.map((d) => d.entry.it)).toEqual(['tre']);
  });

  it('neue Karten starten mit Karteikarte oder Auswahl', () => {
    const item = { entry: entries[0], direction: 'de-it' as const, card: newCard('e:uno', 'de-it', T0) };
    for (let i = 0; i < 20; i++) expect(['flip', 'choice']).toContain(chooseExercise(item, DEFAULT_SETTINGS.exercises));
  });
});

describe('KI-Import', () => {
  it('liest JSON auch aus Codeblöcken', () => {
    const text = 'Hier ist das Ergebnis:\n```json\n{"entries":[{"it":"il gatto","de":"die Katze","pos":"noun","gender":"m","example_it":"Il gatto dorme.","topic":"Tiere"}]}\n```';
    const items = itemsFromJson(extractJson(text));
    expect(items).toHaveLength(1);
    const e = itemToEntry(items[0], 'Mein Kurs');
    expect(e.pos).toBe('noun');
    expect(e.gender).toBe('m');
    expect(e.topic).toBe('Tiere');
    expect(e.exampleIt).toBe('Il *gatto* dorme.');
  });

  it('einfache Liste ohne KI', () => {
    const list = parseSimpleList('la finestra - das Fenster\nandare = gehen\n• il conto; die Rechnung; m\n\nquatsch', 'Kurs');
    expect(list.map((e) => [e.it, e.de])).toEqual([
      ['la finestra', 'das Fenster'],
      ['andare', 'gehen'],
      ['il conto', 'die Rechnung'],
    ]);
    expect(list[2].gender).toBe('m');
  });
});

describe('Gamification', () => {
  it('Lernserie zählt aufeinanderfolgende Tage', () => {
    const today = dayKey(T0);
    const days = new Set([today, addDays(today, -1), addDays(today, -2), addDays(today, -5)]);
    expect(streak(days, today)).toEqual({ current: 3, best: 3 });
    // Heute noch nicht gelernt: Serie von gestern zählt weiter
    expect(streak(new Set([addDays(today, -1)]), today).current).toBe(1);
  });

  it('Level steigen mit XP', () => {
    expect(levelInfo(0).level).toBe(1);
    expect(levelInfo(150).level).toBe(2);
    expect(levelInfo(150).name).toBe('Viaggiatore');
  });
});
