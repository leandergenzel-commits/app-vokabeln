import type { Entry } from './types';

export const PERSONS = ['io', 'tu', 'lui/lei', 'noi', 'voi', 'loro'] as const;
const REFLEXIVE = ['mi', 'ti', 'si', 'ci', 'vi', 'si'];

/**
 * Präsens (presente indicativo) eines Verbs.
 * Unregelmäßige Formen kommen aus den Daten (entry.conj), regelmäßige werden gebildet:
 * -are, -ere, -ire, -ire mit -isc-, -care/-gare (h), -iare (ein i), reflexiv -arsi/-ersi/-irsi.
 */
export function presentTense(entry: Pick<Entry, 'it' | 'conj' | 'isc'>): string[] | null {
  if (entry.conj && entry.conj.length === 6) return entry.conj;
  const inf = entry.it.trim().toLowerCase();
  if (inf.includes(' ')) return null;
  return conjugateRegular(inf, !!entry.isc);
}

export function conjugateRegular(inf: string, isc = false): string[] | null {
  let verb = inf;
  let reflexive = false;
  const refl = verb.match(/^(.+)(ar|er|ir)si$/);
  if (refl) {
    reflexive = true;
    verb = refl[1] + refl[2] + 'e';
  }
  const m = verb.match(/^(.+)(are|ere|ire)$/);
  if (!m) return null;
  const [, stem, ending] = m;
  let forms: string[];
  if (ending === 'are') {
    const hard = /[cg]$/.test(stem) ? stem + 'h' : stem;
    const iStem = /i$/.test(stem) ? stem.slice(0, -1) : null;
    const s2 = iStem ?? hard;
    forms = [stem + 'o', s2 + 'i', stem + 'a', s2 + 'iamo', stem + 'ate', stem + 'ano'];
  } else if (ending === 'ere') {
    forms = [stem + 'o', stem + 'i', stem + 'e', stem + 'iamo', stem + 'ete', stem + 'ono'];
  } else if (isc) {
    forms = [stem + 'isco', stem + 'isci', stem + 'isce', stem + 'iamo', stem + 'ite', stem + 'iscono'];
  } else {
    forms = [stem + 'o', stem + 'i', stem + 'e', stem + 'iamo', stem + 'ite', stem + 'ono'];
  }
  forms = forms.map((f) => f.replace(/iiamo$/, 'iamo'));
  if (reflexive) forms = forms.map((f, i) => `${REFLEXIVE[i]} ${f}`);
  return forms;
}
