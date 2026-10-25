import type { Entry, Gender, Pos } from '../lib/types';
import { slug } from '../lib/util';

import basics from './seed/01-grundlagen.txt?raw';
import people from './seed/02-menschen.txt?raw';
import numbers from './seed/03-zahlen-zeit.txt?raw';
import food from './seed/04-essen.txt?raw';
import shopping from './seed/05-einkaufen-reisen.txt?raw';
import city from './seed/06-stadt-haus.txt?raw';
import body from './seed/07-koerper-kleidung.txt?raw';
import nature from './seed/08-natur-arbeit-freizeit.txt?raw';
import verbs from './seed/09-verben.txt?raw';
import verbs2 from './seed/10-verben-2.txt?raw';
import adjectives from './seed/11-adjektive.txt?raw';
import small from './seed/12-kleine-woerter.txt?raw';
import slang from './seed/13-umgangssprache.txt?raw';
import phrases from './seed/20-saetze.txt?raw';

/** Version der Startdaten – bei Erhöhung werden neue Einträge ergänzt (eigene Änderungen bleiben) */
export const SEED_VERSION = 1;

export const SEED_FILES = [basics, people, numbers, food, shopping, city, body, nature, verbs, verbs2, adjectives, small, slang, phrases];

const POS_CODES: Record<string, Pos> = {
  v: 'verb',
  adj: 'adj',
  adv: 'adv',
  pron: 'pron',
  prep: 'prep',
  konj: 'conj',
  num: 'num',
  int: 'interj',
  expr: 'expr',
  ph: 'phrase',
};

/**
 * Zeilenformat der Startdaten (Felder mit " | " getrennt):
 *   italienisch | deutsch | grammatik | emoji | eselsbrücke | verwandt | beispiel_it | beispiel_de
 * "# Thema" setzt das Thema der folgenden Zeilen, "//" sind Kommentare.
 * Grammatik: m / f / mf (Nomen), v, adj, adv, pron, prep, konj, num, int, expr, ph
 *   Zusätze mit ";": pl (nur Plural), pl=…, isc, conj=io,tu,…, ugs (umgangssprachlich)
 */
export function parseSeed(text: string, startRank = 0, now = Date.now()): Entry[] {
  const out: Entry[] = [];
  let topic = 'Allgemein';
  let rank = startRank;
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('//')) continue;
    if (line.startsWith('#')) {
      topic = line.replace(/^#+/, '').trim();
      continue;
    }
    const f = line.split('|').map((s) => s.trim());
    if (f.length < 3) continue;
    const [it, de, gram, emoji, mnemonic, related, exIt, exDe] = f;
    const entry: Entry = {
      id: 'seed:' + slug(it),
      it,
      de,
      kind: 'word',
      topic,
      source: 'seed',
      rank: rank++,
      createdAt: now,
      updatedAt: now,
    };
    applyGrammar(entry, gram);
    if (emoji) entry.emoji = emoji;
    if (mnemonic) entry.mnemonic = mnemonic;
    if (related) entry.related = related;
    if (exIt) entry.exampleIt = exIt;
    if (exDe) entry.exampleDe = exDe;
    out.push(entry);
  }
  return out;
}

export function applyGrammar(entry: Entry, gram: string | undefined): void {
  if (!gram) return;
  const parts = gram.split(';').map((s) => s.trim()).filter(Boolean);
  const head = parts.shift() ?? '';
  if (head === 'm' || head === 'f' || head === 'mf') {
    entry.pos = 'noun';
    entry.gender = head as Gender;
  } else if (POS_CODES[head]) {
    entry.pos = POS_CODES[head];
  }
  if (entry.pos === 'phrase') entry.kind = 'phrase';
  for (const p of parts) {
    if (p === 'pl') entry.pluralOnly = true;
    else if (p === 'isc') entry.isc = true;
    else if (p === 'ugs') entry.colloquial = true;
    else if (p.startsWith('pl=')) entry.plural = p.slice(3);
    else if (p.startsWith('conj=')) entry.conj = p.slice(5).split(',').map((s) => s.trim());
  }
}

let cache: Entry[] | null = null;

export function seedEntries(): Entry[] {
  if (cache) return cache;
  const seen = new Set<string>();
  const all: Entry[] = [];
  for (const file of SEED_FILES) {
    for (const e of parseSeed(file, all.length)) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      all.push(e);
    }
  }
  cache = all;
  return all;
}
