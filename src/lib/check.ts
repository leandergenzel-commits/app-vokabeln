import type { Rating } from './types';

const IT_ARTICLES = ['il', 'lo', 'la', "l'", 'i', 'gli', 'le', 'un', 'uno', 'una', "un'"];

export function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function normalize(s: string, keepAccents = true): string {
  let out = s
    .toLowerCase()
    .replace(/[’`´]/g, "'")
    .replace(/\*/g, '')
    .replace(/[.,!?¿¡;:"«»„“”…–—-]/g, ' ')
    .replace(/'\s+/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  if (!keepAccents) out = stripAccents(out);
  return out;
}

/** Zerlegt eine italienische Nominalphrase in Artikel und Rest ("l'acqua" → ["l'", "acqua"]) */
export function splitArticle(it: string): { article: string | null; rest: string } {
  const s = it.trim().replace(/[’]/g, "'");
  const m = s.match(/^(il|lo|la|i|gli|le|un|uno|una)\s+(.+)$/i) ?? s.match(/^(l'|un')(.+)$/i);
  if (m && IT_ARTICLES.includes(m[1].toLowerCase())) return { article: m[1].toLowerCase(), rest: m[2].trim() };
  return { article: null, rest: s };
}

/** Alle akzeptierten Varianten einer Lösung */
export function alternatives(answer: string, isWord: boolean): string[] {
  const parts = answer.split(';').flatMap((p) => (isWord ? p.split('/') : [p]));
  const out = new Set<string>();
  for (const raw of parts) {
    const p = raw.trim();
    if (!p) continue;
    out.add(p.replace(/[()]/g, ''));
    const withoutOptional = p.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
    if (withoutOptional) out.add(withoutOptional);
  }
  // "bello/bella": Wort mit Endungsalternativen → beide Formen
  return [...out];
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

function tolerance(len: number): number {
  if (len <= 4) return 0;
  if (len <= 9) return 1;
  return 2;
}

const DE_ARTICLES = /^(der|die|das|den|dem|ein|eine|einen)\s+/i;

export type Verdict = 'correct' | 'almost' | 'wrong';

export interface CheckResult {
  verdict: Verdict;
  notes: string[];
  /** Lösungsvariante, die am besten gepasst hat */
  best: string;
}

/**
 * Prüft eine eingetippte Antwort.
 * - Akzente: werden toleriert (Hinweis), außer `strictAccents`
 * - Tippfehler: 1–2 Buchstaben je nach Wortlänge → "fast richtig"
 * - Italienische Artikel: fehlend oder falsch → "fast richtig" mit Hinweis
 * - Deutsche Artikel: optional
 */
export function checkAnswer(
  input: string,
  solution: string,
  opts: { lang: 'it' | 'de'; isWord: boolean; strictAccents?: boolean },
): CheckResult {
  const alts = alternatives(solution, opts.isWord);
  const given = normalize(input);
  if (!given) return { verdict: 'wrong', notes: [], best: alts[0] ?? solution };

  let best: CheckResult = { verdict: 'wrong', notes: [], best: alts[0] ?? solution };
  const rank = (v: Verdict) => (v === 'correct' ? 2 : v === 'almost' ? 1 : 0);

  for (const alt of alts) {
    const r = compareOne(given, alt, opts);
    if (rank(r.verdict) > rank(best.verdict) || (r.verdict === best.verdict && r.notes.length < best.notes.length && r.verdict !== 'wrong')) {
      best = r;
    }
    if (best.verdict === 'correct' && best.notes.length === 0) break;
  }
  return best;
}

function compareOne(given: string, alt: string, opts: { lang: 'it' | 'de'; isWord: boolean; strictAccents?: boolean }): CheckResult {
  const target = normalize(alt);
  const notes: string[] = [];

  const exact = (a: string, b: string): Verdict | 'accent' => {
    if (a === b) return 'correct';
    if (stripAccents(a) === stripAccents(b)) return 'accent';
    const d = levenshtein(stripAccents(a), stripAccents(b));
    return d <= tolerance(b.length) ? 'almost' : 'wrong';
  };

  const finish = (v: Verdict | 'accent', extraNotes: string[] = []): CheckResult => {
    const n = [...extraNotes];
    let verdict: Verdict;
    if (v === 'accent') {
      n.push(`Achte auf die Akzente: ${alt}`);
      verdict = opts.strictAccents ? 'almost' : 'correct';
    } else {
      verdict = v;
      if (v === 'almost') n.push(`Kleiner Tippfehler – richtig ist: ${alt}`);
    }
    return { verdict, notes: n, best: alt };
  };

  if (opts.lang === 'de') {
    const g = given.replace(DE_ARTICLES, '');
    const t = target.replace(DE_ARTICLES, '');
    const v = exact(given, target);
    if (v === 'correct' || v === 'accent') return finish(v);
    return finish(exact(g, t));
  }

  // Italienisch: Artikel gesondert prüfen
  const tSplit = splitArticle(target);
  if (opts.isWord && tSplit.article) {
    const gSplit = splitArticle(given);
    const restV = exact(gSplit.rest, tSplit.rest);
    if (restV === 'wrong') {
      // Vielleicht ohne Leerzeichen zusammengeschrieben ("lacqua")
      return finish(exact(given, target));
    }
    if (!gSplit.article) {
      notes.push(`Artikel nicht vergessen: ${tSplit.article} ${tSplit.rest}`.replace("' ", "'"));
      const merged = restV === 'correct' || restV === 'accent' ? 'almost' : restV;
      return { ...finish(restV === 'accent' ? 'accent' : merged, notes), verdict: 'almost' };
    }
    if (gSplit.article !== tSplit.article) {
      notes.push(`Falscher Artikel: richtig ist „${tSplit.article}“ (${genderHint(tSplit.article)})`);
      return { ...finish(restV, notes), verdict: 'almost' };
    }
    return finish(restV, notes);
  }

  return finish(exact(given, target));
}

export function genderHint(article: string): string {
  if (['il', 'lo', 'i', 'gli', 'un', 'uno'].includes(article)) return 'maskulin';
  if (['la', 'le', 'una', "un'"].includes(article)) return 'feminin';
  return "vor Vokal";
}

export function suggestRating(verdict: Verdict, hints: number): Rating {
  if (verdict === 'wrong') return 1;
  if (verdict === 'almost' || hints >= 2) return 2;
  if (hints === 1) return 2;
  return 3;
}
