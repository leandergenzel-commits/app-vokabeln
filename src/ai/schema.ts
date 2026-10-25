import { applyGrammar } from '../data/seed';
import type { Entry, Gender, Pos } from '../lib/types';
import { uid } from '../lib/util';

/** Format, in dem KI (Claude oder lokal) die Einträge liefert */
export interface ImportItem {
  it: string;
  de: string;
  type?: 'word' | 'phrase';
  pos?: string;
  gender?: string;
  topic?: string;
  emoji?: string;
  mnemonic?: string;
  related?: string;
  example_it?: string;
  example_de?: string;
  colloquial?: boolean;
  conj?: string[] | string;
}

const POS: Record<string, Pos> = {
  noun: 'noun', nomen: 'noun', substantiv: 'noun', sostantivo: 'noun',
  verb: 'verb', verbo: 'verb',
  adj: 'adj', adjective: 'adj', adjektiv: 'adj', aggettivo: 'adj',
  adv: 'adv', adverb: 'adv', avverbio: 'adv',
  pron: 'pron', pronoun: 'pron', pronomen: 'pron',
  prep: 'prep', preposition: 'prep', präposition: 'prep',
  conj: 'conj', conjunction: 'conj', konjunktion: 'conj',
  num: 'num', number: 'num', zahl: 'num',
  interj: 'interj', interjection: 'interj',
  expr: 'expr', expression: 'expr', redewendung: 'expr',
  phrase: 'phrase', satz: 'phrase', sentence: 'phrase',
};

/** Holt JSON auch aus Antworten mit ```json-Blöcken oder Begleittext */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (fenced ? fenced[1] : text).trim();
  try {
    return JSON.parse(body);
  } catch {
    const start = body.search(/[[{]/);
    const end = Math.max(body.lastIndexOf('}'), body.lastIndexOf(']'));
    if (start >= 0 && end > start) return JSON.parse(body.slice(start, end + 1));
    throw new Error('Keine gültigen JSON-Daten gefunden.');
  }
}

export function itemsFromJson(data: unknown): ImportItem[] {
  const list = Array.isArray(data)
    ? data
    : data && typeof data === 'object'
      ? ((data as Record<string, unknown>).entries ?? (data as Record<string, unknown>).items ?? (data as Record<string, unknown>).vocabulary)
      : null;
  if (!Array.isArray(list)) throw new Error('Erwartet wird {"entries": [...]} oder eine Liste.');
  return list.filter((x): x is ImportItem => !!x && typeof x === 'object' && typeof x.it === 'string' && typeof x.de === 'string' && !!x.it.trim() && !!x.de.trim());
}

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

export function itemToEntry(item: ImportItem, fallbackTopic: string, now = Date.now()): Entry {
  const it = item.it.trim();
  const isPhrase = item.type === 'phrase' || (!item.type && /\s/.test(it) && it.split(/\s+/).length > 3);
  const entry: Entry = {
    id: 'imp:' + uid(),
    it,
    de: item.de.trim(),
    kind: isPhrase ? 'phrase' : 'word',
    topic: str(item.topic) ?? fallbackTopic,
    source: 'import',
    createdAt: now,
    updatedAt: now,
  };
  const pos = POS[(item.pos ?? '').toLowerCase()];
  if (pos) entry.pos = pos;
  if (isPhrase) entry.pos = 'phrase';
  const g = (item.gender ?? '').toLowerCase();
  if (['m', 'f', 'mf'].includes(g)) {
    entry.gender = g as Gender;
    if (!entry.pos) entry.pos = 'noun';
  }
  // Geschlecht aus dem Artikel ableiten, falls nicht angegeben
  if (!entry.gender && !isPhrase && (!entry.pos || entry.pos === 'noun')) {
    const art = it.match(/^(il|lo|i|gli|la|le)\s/i)?.[1].toLowerCase();
    if (art) {
      entry.pos = 'noun';
      entry.gender = ['il', 'lo', 'i', 'gli'].includes(art) ? 'm' : 'f';
    }
  }
  entry.emoji = str(item.emoji);
  entry.mnemonic = str(item.mnemonic);
  entry.related = str(item.related);
  entry.exampleIt = str(item.example_it);
  entry.exampleDe = str(item.example_de);
  if (item.colloquial) entry.colloquial = true;
  if (entry.pos === 'verb' && item.conj) {
    const forms = Array.isArray(item.conj) ? item.conj : item.conj.split(',');
    if (forms.length === 6) entry.conj = forms.map((f) => f.trim());
  }
  // Falls das Beispiel das Wort nicht markiert, versuchen wir es selbst
  if (entry.exampleIt && !entry.exampleIt.includes('*') && entry.kind === 'word') {
    const core = it.replace(/^(il|lo|la|i|gli|le|l')\s*/i, '');
    const stem = core.slice(0, Math.max(3, core.length - 2));
    const word = entry.exampleIt.match(new RegExp(`\\b${escapeRe(stem)}\\p{L}*`, 'iu'));
    if (word) entry.exampleIt = entry.exampleIt.replace(word[0], `*${word[0]}*`);
  }
  for (const k of Object.keys(entry) as (keyof Entry)[]) if (entry[k] === undefined) delete entry[k];
  return entry;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Ohne KI: eine Zeile pro Eintrag, z. B. "la finestra - das Fenster", "ciao = hallo",
 * Tabulator oder Semikolon getrennt. Optional dritte Spalte mit Grammatik (m, f, v …).
 */
export function parseSimpleList(text: string, topic: string, now = Date.now()): Entry[] {
  const out: Entry[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim().replace(/^[-•*\d.)\s]+(?=\p{L})/u, '');
    if (!line) continue;
    const parts = line.split(/\t|\s+[-–—=:]\s+|;|\s*\|\s*/).map((s) => s.trim()).filter(Boolean);
    if (parts.length < 2) continue;
    const entry = itemToEntry({ it: parts[0], de: parts[1] }, topic, now);
    if (parts[2]) applyGrammar(entry, parts[2]);
    out.push(entry);
  }
  return out;
}
