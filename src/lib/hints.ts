import { splitArticle } from './check';
import type { Direction, Entry } from './types';
import { stripMarks } from './util';

export interface Hint {
  level: number;
  icon: string;
  title: string;
  text: string;
}

/** Zeigt die Form der Lösung: Anfangsbuchstabe und Länge, Artikel bleibt sichtbar */
export function maskWord(word: string, reveal = 1): string {
  let shown = 0;
  return [...word]
    .map((ch) => {
      if (!/\p{L}/u.test(ch)) return ch;
      if (shown < reveal) {
        shown++;
        return ch;
      }
      return '_';
    })
    .join('');
}

export function structureHint(answer: string, lang: 'it' | 'de'): string {
  const main = answer.split(';')[0].split(' / ')[0].trim();
  if (lang === 'it') {
    const { article, rest } = splitArticle(main);
    const masked = rest
      .split(' ')
      .map((w) => maskWord(w))
      .join('  ');
    return article ? `${article}${article.endsWith("'") ? '' : ' '}${masked}` : masked;
  }
  return main
    .split(' ')
    .map((w) => (/^(der|die|das)$/i.test(w) ? w : maskWord(w)))
    .join('  ');
}

/** Beispielsatz mit Lücke für das markierte Zielwort */
export function clozeSentence(example: string): { text: string; answer: string } | null {
  const m = example.match(/\*([^*]+)\*/);
  if (!m) return null;
  return { text: example.replace(m[0], '_____'), answer: m[1] };
}

/** Lücke für Sätze ohne Markierung: das längste Wort */
export function clozeFromPhrase(phrase: string): { text: string; answer: string } | null {
  const words = phrase.match(/[\p{L}']+/gu);
  if (!words || words.length < 2) return null;
  const answer = words.reduce((a, b) => (b.length > a.length ? b : a));
  return { text: phrase.replace(answer, '_____'), answer };
}

export function genderLine(entry: Entry): string | null {
  if (entry.pos !== 'noun' || !entry.gender) return null;
  const g = entry.gender === 'm' ? 'maskulin ♂' : entry.gender === 'f' ? 'feminin ♀' : 'maskulin & feminin';
  return entry.pluralOnly ? `${g}, nur Plural` : g;
}

/** Die Hilfeleiter: von leicht (Struktur) bis zur Auflösung */
export function buildHints(entry: Entry, direction: Direction): Hint[] {
  const answer = direction === 'de-it' ? entry.it : entry.de;
  const lang = direction === 'de-it' ? 'it' : 'de';
  const hints: Hint[] = [];

  const gender = direction === 'de-it' ? genderLine(entry) : null;
  hints.push({
    level: 1,
    icon: '🔤',
    title: 'Form',
    text: structureHint(answer, lang) + (gender ? `   ·   ${gender}` : ''),
  });

  if (entry.mnemonic || entry.emoji) {
    hints.push({
      level: 2,
      icon: entry.emoji || '🖼️',
      title: 'Bild & Eselsbrücke',
      text: entry.mnemonic || 'Stell dir das Bild ganz konkret vor.',
    });
  }

  if (entry.related) {
    hints.push({ level: 3, icon: '🔗', title: 'Verwandte Wörter', text: entry.related });
  }

  if (entry.exampleIt) {
    let text: string;
    if (direction === 'de-it') {
      const c = clozeSentence(entry.exampleIt);
      text = (c ? c.text : stripMarks(entry.exampleIt)) + (entry.exampleDe ? `\n„${entry.exampleDe}“` : '');
    } else {
      text = stripMarks(entry.exampleIt);
    }
    hints.push({ level: 4, icon: '💬', title: 'Beispielsatz', text });
  }

  return hints;
}
