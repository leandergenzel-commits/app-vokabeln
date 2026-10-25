import { useEffect, useMemo, useRef, useState } from 'react';
import { checkAnswer, normalize, suggestRating, type CheckResult } from '../lib/check';
import { distractors } from '../lib/distractors';
import { buildHints, clozeFromPhrase, clozeSentence, genderLine } from '../lib/hints';
import { previewIntervals, RATING_LABEL } from '../lib/srs';
import type { StudyItem } from '../lib/session';
import type { Entry, ExerciseType, Rating, Settings } from '../lib/types';
import { formatInterval, shuffle, stripMarks } from '../lib/util';
import { speak } from '../lib/tts';
import { topicEmoji } from '../data/topics';

export const EXERCISE_LABEL: Record<ExerciseType, { label: string; icon: string; desc: string }> = {
  flip: { label: 'Karteikarte', icon: '🃏', desc: 'Umdrehen und selbst bewerten' },
  type: { label: 'Eintippen', icon: '⌨️', desc: 'Antwort schreiben, die App prüft' },
  choice: { label: 'Auswahl', icon: '🔘', desc: 'Aus vier Möglichkeiten wählen' },
  cloze: { label: 'Lückentext', icon: '🧩', desc: 'Wort im Beispielsatz ergänzen' },
  order: { label: 'Satzbau', icon: '🧱', desc: 'Wörter in die richtige Reihenfolge bringen' },
  listen: { label: 'Hören', icon: '🎧', desc: 'Italienisch hören und verstehen' },
  article: { label: 'Artikel', icon: '♂♀', desc: 'il, lo, la, l’ … richtig zuordnen' },
  conjugate: { label: 'Konjugation', icon: '🔁', desc: 'Verben im Präsens beugen' },
};

interface Props {
  item: StudyItem;
  exercise: ExerciseType;
  pool: Entry[];
  settings: Settings;
  /** srs=false: freies Training, nur "Weiter" statt Bewertung */
  srs: boolean;
  onDone: (rating: Rating, hints: number) => void;
}

export function StudyCard({ item, exercise, pool, settings, srs, onDone }: Props) {
  const { entry, direction } = item;
  const toIt = direction === 'de-it';
  const question = toIt ? entry.de : entry.it;
  const answer = toIt ? entry.it : entry.de;
  const hints = useMemo(() => buildHints(entry, direction), [entry, direction]);

  const [hintCount, setHintCount] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [input, setInput] = useState('');
  const [chosen, setChosen] = useState<string | null>(null);
  const [built, setBuilt] = useState<number[]>([]);
  const [showText, setShowText] = useState(exercise !== 'listen');
  const inputRef = useRef<HTMLInputElement>(null);
  const finished = useRef(false);

  const options = useMemo(() => (exercise === 'choice' ? shuffle([answer, ...distractors(entry, pool, direction)]) : []), [exercise, entry, pool, direction, answer]);

  const cloze = useMemo(() => {
    if (exercise !== 'cloze') return null;
    if (entry.kind === 'word' && entry.exampleIt) return clozeSentence(entry.exampleIt);
    return clozeFromPhrase(entry.it);
  }, [exercise, entry]);

  const tiles = useMemo(() => (exercise === 'order' ? shuffle(entry.it.split(/\s+/)) : []), [exercise, entry]);

  // Reset bei neuer Karte
  useEffect(() => {
    finished.current = false;
    setHintCount(0);
    setRevealed(false);
    setResult(null);
    setInput('');
    setChosen(null);
    setBuilt([]);
    setShowText(exercise !== 'listen');
    if ((exercise === 'listen' || (!toIt && settings.autoSpeak)) && entry.it) {
      speak(entry.it, settings.speechRate);
    }
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [entry.id, direction, exercise]);

  const reveal = (r: CheckResult | null) => {
    setResult(r);
    setRevealed(true);
    if (toIt && settings.autoSpeak) speak(entry.it, settings.speechRate);
  };

  const submitTyped = () => {
    if (!input.trim()) return;
    if (exercise === 'cloze' && cloze) {
      reveal(checkAnswer(input, cloze.answer, { lang: 'it', isWord: true, strictAccents: settings.strictAccents }));
      return;
    }
    reveal(checkAnswer(input, answer, { lang: toIt ? 'it' : 'de', isWord: entry.kind === 'word', strictAccents: settings.strictAccents }));
  };

  const submitOrder = () => {
    const sentence = built.map((i) => tiles[i]).join(' ');
    const ok = normalize(sentence) === normalize(entry.it);
    reveal({ verdict: ok ? 'correct' : 'wrong', notes: ok ? [] : [`Deine Reihenfolge: ${sentence}`], best: entry.it });
  };

  const choose = (opt: string) => {
    if (revealed) return;
    setChosen(opt);
    reveal({ verdict: opt === answer ? 'correct' : 'wrong', notes: [], best: answer });
  };

  // Doppeltes Antippen der Bewertung darf nicht zweimal zählen
  const finish = (rating: Rating, hintsUsed: number) => {
    if (finished.current) return;
    finished.current = true;
    onDone(rating, hintsUsed);
  };

  const usedHints = hintCount + (exercise === 'listen' && showText ? 1 : 0);
  const suggested: Rating = result ? suggestRating(result.verdict, usedHints) : usedHints > 1 ? 2 : 3;
  const intervals = useMemo(() => previewIntervals(item.card), [item.card]);

  // Tastatur: Enter = prüfen/aufdecken, 1–4 = bewerten, H = Hilfe
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
      if (revealed) {
        if (srs && ['1', '2', '3', '4'].includes(e.key) && !typing) finish(Number(e.key) as Rating, usedHints);
        else if (e.key === 'Enter' || (e.key === ' ' && !typing)) {
          e.preventDefault();
          finish(srs ? suggested : suggestedTraining(result), usedHints);
        }
        return;
      }
      if (typing) return;
      if (e.key === ' ' && exercise === 'flip') {
        e.preventDefault();
        reveal(null);
      } else if (e.key.toLowerCase() === 'h') setHintCount((h) => Math.min(hints.length, h + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const dirLabel = toIt ? 'Deutsch → Italienisch' : 'Italienisch → Deutsch';
  const gender = genderLine(entry);

  return (
    <div className={`study-card ${revealed ? 'is-revealed' : ''} verdict-${result?.verdict ?? 'none'}`}>
      <div className="card-meta">
        <span className="chip">
          {topicEmoji(entry.topic)} {entry.topic}
        </span>
        <span className="chip chip-soft">
          {EXERCISE_LABEL[exercise].icon} {EXERCISE_LABEL[exercise].label}
        </span>
        <span className="chip chip-soft">{dirLabel}</span>
        {item.card.phase === 'new' && <span className="chip chip-new">Neu</span>}
        {entry.colloquial && <span className="chip chip-soft">🤌 umgangssprachlich</span>}
      </div>

      {/* Frage */}
      <div className="question">
        {exercise === 'listen' ? (
          <div className="listen-box">
            <button className="btn btn-round" onClick={() => speak(entry.it, settings.speechRate)} aria-label="Nochmal anhören">
              🔊
            </button>
            <button className="btn btn-round" onClick={() => speak(entry.it, settings.speechRate * 0.7)} aria-label="Langsam anhören">
              🐢
            </button>
            {showText ? (
              <div className="q-text it">{entry.it}</div>
            ) : (
              <button className="btn btn-ghost" onClick={() => setShowText(true)}>
                Text anzeigen (zählt als Hilfe)
              </button>
            )}
          </div>
        ) : exercise === 'cloze' && cloze ? (
          <>
            <div className="q-label">Ergänze die Lücke</div>
            <div className="q-text it">{cloze.text}</div>
            <div className="q-sub">„{entry.kind === 'word' ? entry.exampleDe ?? entry.de : entry.de}“{entry.kind === 'word' && <> · gesucht: {entry.de}</>}</div>
          </>
        ) : exercise === 'order' ? (
          <>
            <div className="q-label">Bilde den Satz auf Italienisch</div>
            <div className="q-text">{entry.de}</div>
          </>
        ) : (
          <>
            <div className="q-label">{toIt ? 'Wie heißt das auf Italienisch?' : 'Was bedeutet das?'}</div>
            <div className={`q-text ${toIt ? '' : 'it'}`}>
              {question}
              {!toIt && (
                <button className="speak-inline" onClick={() => speak(entry.it, settings.speechRate)} aria-label="Vorlesen">
                  🔊
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Hilfeleiter */}
      {!revealed && hints.length > 0 && (
        <div className="hints">
          {hints.slice(0, hintCount).map((h) => (
            <div key={h.level} className={`hint hint-${h.level}`}>
              <span className="hint-icon">{h.icon}</span>
              <div>
                <div className="hint-title">{h.title}</div>
                <div className="hint-text">{h.text}</div>
              </div>
            </div>
          ))}
          {hintCount < hints.length && (
            <button className="btn btn-hint" onClick={() => setHintCount(hintCount + 1)}>
              💡 {hintCount === 0 ? 'Hilfe' : 'Weitere Hilfe'} ({hintCount + 1}/{hints.length}) – {hints[hintCount].title}
            </button>
          )}
        </div>
      )}

      {/* Antwortbereich */}
      {!revealed && (
        <div className="answer-area">
          {exercise === 'flip' && (
            <button className="btn btn-primary btn-big" onClick={() => reveal(null)}>
              Antwort zeigen
            </button>
          )}

          {(exercise === 'type' || exercise === 'cloze' || exercise === 'listen') && (
            <form
              className="type-form"
              onSubmit={(e) => {
                e.preventDefault();
                submitTyped();
              }}
            >
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={exercise === 'listen' ? 'Was bedeutet das auf Deutsch?' : toIt || exercise === 'cloze' ? 'Italienisch …' : 'Deutsch …'}
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                lang={toIt || exercise === 'cloze' ? 'it' : 'de'}
              />
              <button className="btn btn-primary" type="submit">
                Prüfen
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => reveal({ verdict: 'wrong', notes: [], best: answer })}>
                Weiß ich nicht
              </button>
            </form>
          )}

          {exercise === 'choice' && (
            <div className="choices">
              {options.map((o) => (
                <button key={o} className="btn choice" onClick={() => choose(o)}>
                  {o}
                </button>
              ))}
            </div>
          )}

          {exercise === 'order' && (
            <div className="order">
              <div className="order-built">
                {built.length === 0 && <span className="muted">Tippe die Wörter in der richtigen Reihenfolge an</span>}
                {built.map((i, k) => (
                  <button key={k} className="tile tile-used" onClick={() => setBuilt(built.filter((_, j) => j !== k))}>
                    {tiles[i]}
                  </button>
                ))}
              </div>
              <div className="order-pool">
                {tiles.map((t, i) =>
                  built.includes(i) ? (
                    <span key={i} className="tile tile-ghost">
                      {t}
                    </span>
                  ) : (
                    <button key={i} className="tile" onClick={() => setBuilt([...built, i])}>
                      {t}
                    </button>
                  ),
                )}
              </div>
              <button className="btn btn-primary" disabled={built.length !== tiles.length} onClick={submitOrder}>
                Prüfen
              </button>
            </div>
          )}
        </div>
      )}

      {/* Auflösung */}
      {revealed && (
        <div className="solution">
          {result && (
            <div className={`feedback feedback-${result.verdict}`}>
              {result.verdict === 'correct' ? '✅ Richtig!' : result.verdict === 'almost' ? '🟡 Fast richtig' : '❌ Leider nicht'}
              {result.notes.map((n) => (
                <div key={n} className="feedback-note">
                  {n}
                </div>
              ))}
              {exercise === 'choice' && chosen && chosen !== answer && <div className="feedback-note">Gewählt: {chosen}</div>}
            </div>
          )}
          <div className="sol-main">
            {entry.emoji && <span className="sol-emoji">{entry.emoji}</span>}
            <div>
              <div className="sol-it">
                {entry.it}
                <button className="speak-inline" onClick={() => speak(entry.it, settings.speechRate)} aria-label="Vorlesen">
                  🔊
                </button>
              </div>
              <div className="sol-de">{entry.de}</div>
              {gender && <div className="sol-gender">{gender}{entry.plural ? ` · Plural: ${entry.plural}` : ''}</div>}
            </div>
          </div>
          {entry.mnemonic && (
            <div className="sol-row">
              <span>🖼️</span>
              <span>{entry.mnemonic}</span>
            </div>
          )}
          {entry.related && (
            <div className="sol-row">
              <span>🔗</span>
              <span>{entry.related}</span>
            </div>
          )}
          {entry.exampleIt && (
            <div className="sol-row">
              <span>💬</span>
              <span>
                <em lang="it">{stripMarks(entry.exampleIt)}</em>
                {entry.exampleDe && <> – {entry.exampleDe}</>}
              </span>
            </div>
          )}
          {entry.notes && (
            <div className="sol-row">
              <span>📝</span>
              <span>{entry.notes}</span>
            </div>
          )}

          {srs ? (
            <div className="rating">
              <div className="rating-label">Wie leicht war es?</div>
              <div className="rating-buttons">
                {([1, 2, 3, 4] as Rating[]).map((r) => (
                  <button key={r} className={`btn rate rate-${r} ${r === suggested ? 'rate-suggested' : ''}`} onClick={() => finish(r, usedHints)}>
                    <span className="rate-name">{RATING_LABEL[r]}</span>
                    <span className="rate-ivl">{formatInterval(intervals[r])}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <button className="btn btn-primary btn-big" onClick={() => finish(suggestedTraining(result), usedHints)}>
              Weiter →
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function suggestedTraining(result: CheckResult | null): Rating {
  if (!result) return 3;
  return result.verdict === 'correct' ? 3 : result.verdict === 'almost' ? 2 : 1;
}
