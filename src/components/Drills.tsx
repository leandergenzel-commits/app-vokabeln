import { useEffect, useMemo, useRef, useState } from 'react';
import { checkAnswer, genderHint, splitArticle } from '../lib/check';
import { PERSONS, presentTense } from '../lib/conjugate';
import type { Entry, Rating, Settings } from '../lib/types';
import { speak } from '../lib/tts';

const ARTICLES_SG = ['il', 'lo', 'la', "l'"];
const ARTICLES_PL = ['i', 'gli', 'le'];

/** Kurze Begründung, warum ein Artikel passt */
export function articleRule(article: string, word: string): string {
  const w = word.toLowerCase();
  switch (article) {
    case 'il':
      return 'il: maskulin vor normalem Konsonanten';
    case 'lo':
      return /^(s[^aeiou]|z|gn|ps|x|y|pn)/.test(w) ? 'lo: maskulin vor s + Konsonant, z, gn, ps, x, y' : 'lo: maskulin (Sonderfall)';
    case 'la':
      return 'la: feminin vor Konsonant';
    case "l'":
      return "l': vor Vokal (maskulin und feminin)";
    case 'i':
      return 'i: Plural von il';
    case 'gli':
      return 'gli: Plural von lo und l’ (maskulin)';
    case 'le':
      return 'le: Plural feminin';
    default:
      return '';
  }
}

/** Ruft onDone pro Karte höchstens einmal auf (Schutz vor Doppeltippen) */
function useOnce(onDone: (r: Rating) => void, key: string) {
  const done = useRef<string | null>(null);
  return (r: Rating) => {
    if (done.current === key) return;
    done.current = key;
    onDone(r);
  };
}

interface DrillProps {
  entry: Entry;
  settings: Settings;
  onDone: (rating: Rating) => void;
}

export function ArticleDrill({ entry, settings, onDone }: DrillProps) {
  const { article, rest } = splitArticle(entry.it);
  const [chosen, setChosen] = useState<string | null>(null);
  const plural = ['i', 'gli', 'le'].includes(article ?? '');
  const options = plural ? ARTICLES_PL : ARTICLES_SG;
  const correct = chosen === article;
  const once = useOnce(onDone, entry.id);

  useEffect(() => setChosen(null), [entry.id]);

  const choose = (a: string) => {
    if (chosen) return;
    setChosen(a);
    if (settings.autoSpeak) speak(entry.it, settings.speechRate);
  };

  return (
    <div className={`study-card ${chosen ? 'is-revealed' : ''}`}>
      <div className="card-meta">
        <span className="chip chip-soft">♂♀ Welcher Artikel?</span>
      </div>
      <div className="question">
        <div className="q-text it">
          {entry.emoji && <span className="q-emoji">{entry.emoji}</span>} ___ {rest}
        </div>
        <div className="q-sub">{entry.de}</div>
      </div>
      <div className="choices choices-articles">
        {options.map((a) => (
          <button
            key={a}
            className={`btn choice ${chosen && a === article ? 'choice-right' : ''} ${chosen === a && !correct ? 'choice-wrong' : ''}`}
            onClick={() => choose(a)}
          >
            {a}
          </button>
        ))}
      </div>
      {chosen && article && (
        <div className="solution">
          <div className={`feedback feedback-${correct ? 'correct' : 'wrong'}`}>
            {correct ? '✅ Giusto!' : `❌ Richtig ist: ${entry.it}`}
            <div className="feedback-note">
              {articleRule(article, rest)} · {genderHint(article)}
            </div>
          </div>
          {entry.mnemonic && (
            <div className="sol-row">
              <span>🖼️</span>
              <span>{entry.mnemonic}</span>
            </div>
          )}
          <button className="btn btn-primary btn-big" onClick={() => once(correct ? 3 : 1)} autoFocus>
            Weiter →
          </button>
        </div>
      )}
    </div>
  );
}

export function ConjugationDrill({ entry, settings, onDone }: DrillProps) {
  const forms = useMemo(() => presentTense(entry) ?? [], [entry]);
  const person = useMemo(() => Math.floor(Math.random() * 6), [entry.id]);
  const [input, setInput] = useState('');
  const [result, setResult] = useState<ReturnType<typeof checkAnswer> | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  const once = useOnce(onDone, entry.id);

  useEffect(() => {
    setInput('');
    setResult(null);
    setTimeout(() => ref.current?.focus(), 50);
  }, [entry.id]);

  const target = forms[person] ?? '';
  const submit = () => {
    const given = input.trim().replace(new RegExp(`^${PERSONS[person].split('/')[0]}\\s+`, 'i'), '');
    const r = checkAnswer(given, target, { lang: 'it', isWord: true, strictAccents: settings.strictAccents });
    setResult(r);
    if (settings.autoSpeak) speak(`${PERSONS[person].split('/')[0]} ${target}`, settings.speechRate);
  };

  return (
    <div className={`study-card ${result ? 'is-revealed' : ''}`}>
      <div className="card-meta">
        <span className="chip chip-soft">🔁 Präsens</span>
      </div>
      <div className="question">
        <div className="q-label">{entry.de}</div>
        <div className="q-text it">
          {entry.it} → <span className="accent">{PERSONS[person]}</span> …
        </div>
      </div>
      {!result ? (
        <form
          className="type-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (input.trim()) submit();
          }}
        >
          <input ref={ref} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Verbform …" autoCapitalize="off" autoCorrect="off" spellCheck={false} lang="it" />
          <button className="btn btn-primary" type="submit">
            Prüfen
          </button>
        </form>
      ) : (
        <div className="solution">
          <div className={`feedback feedback-${result.verdict}`}>
            {result.verdict === 'correct' ? '✅ Giusto!' : result.verdict === 'almost' ? '🟡 Fast' : '❌ Leider nicht'} – {PERSONS[person]} <b>{target}</b>
          </div>
          <table className="conj-table">
            <tbody>
              {forms.map((f, i) => (
                <tr key={i} className={i === person ? 'hl' : ''}>
                  <td>{PERSONS[i]}</td>
                  <td>{f}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {entry.mnemonic && (
            <div className="sol-row">
              <span>🖼️</span>
              <span>{entry.mnemonic}</span>
            </div>
          )}
          <button className="btn btn-primary btn-big" onClick={() => once(result.verdict === 'correct' ? 3 : result.verdict === 'almost' ? 2 : 1)} autoFocus>
            Weiter →
          </button>
        </div>
      )}
    </div>
  );
}
