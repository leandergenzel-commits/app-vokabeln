import { useMemo, useState } from 'react';
import { Confetti, ProgressBar, Segmented, TopicPicker } from '../components/Controls';
import { ArticleDrill, ConjugationDrill } from '../components/Drills';
import { EXERCISE_LABEL, StudyCard } from '../components/StudyCard';
import { splitArticle } from '../lib/check';
import { presentTense } from '../lib/conjugate';
import { recordReview } from '../lib/db';
import { useCards, useEntries, useSettings, useTopics } from '../lib/hooks';
import { chooseExercise, directionsFor, inTopics, type StudyItem } from '../lib/session';
import { cardId, newCard } from '../lib/srs';
import type { CardState, Entry, ExerciseType, Rating } from '../lib/types';
import { pick, shuffle } from '../lib/util';

type Mode = 'mix' | 'article' | 'conjugate' | 'order' | 'listen' | 'choice' | 'type';
type Source = 'all' | 'learned' | 'hard';

const MODES: { id: Mode; title: string; icon: string; desc: string }[] = [
  { id: 'article', title: 'Artikel-Trainer', icon: '♂♀', desc: 'il, lo, la oder l’? Das Geschlecht der Nomen sicher lernen' },
  { id: 'conjugate', title: 'Konjugation', icon: '🔁', desc: 'Die wichtigsten Verben im Präsens: io, tu, lui …' },
  { id: 'order', title: 'Satzbau', icon: '🧱', desc: 'Alltagssätze aus Wortbausteinen zusammensetzen' },
  { id: 'listen', title: 'Hörverstehen', icon: '🎧', desc: 'Italienisch hören und verstehen' },
  { id: 'choice', title: 'Schnell-Quiz', icon: '⚡', desc: 'Multiple Choice zum Aufwärmen' },
  { id: 'type', title: 'Schreiben', icon: '⌨️', desc: 'Antworten eintippen' },
  { id: 'mix', title: 'Bunter Mix', icon: '🎲', desc: 'Alle Übungsarten durcheinander' },
];

interface Round {
  items: { item: StudyItem; exercise: ExerciseType }[];
  index: number;
  good: number;
  xp: number;
}

function eligible(mode: Mode, e: Entry): boolean {
  switch (mode) {
    case 'article':
      return e.pos === 'noun' && !!splitArticle(e.it).article;
    case 'conjugate':
      return e.pos === 'verb' && !!presentTense(e);
    case 'order':
      return e.kind === 'phrase' && e.it.split(' ').length >= 3;
    default:
      return true;
  }
}

export function Training() {
  const settings = useSettings();
  const entries = useEntries();
  const cards = useCards();
  const topics = useTopics(entries);
  const [mode, setMode] = useState<Mode>('article');
  const [source, setSource] = useState<Source>('all');
  const [chosenTopics, setChosenTopics] = useState<string[]>([]);
  const [length, setLength] = useState(15);
  const [round, setRound] = useState<Round | null>(null);

  const cardMap = useMemo(() => new Map((cards ?? []).map((c) => [c.id, c])), [cards]);

  const pool = useMemo(() => {
    if (!entries) return [];
    const started = new Set((cards ?? []).filter((c) => c.phase !== 'new').map((c) => c.entryId));
    const hard = new Set((cards ?? []).filter((c) => c.lapses > 0 || c.ease < 2.3 || c.phase === 'relearning').map((c) => c.entryId));
    return entries.filter(
      (e) =>
        eligible(mode, e) &&
        inTopics(e, chosenTopics) &&
        (source === 'all' || (source === 'learned' && started.has(e.id)) || (source === 'hard' && hard.has(e.id))),
    );
  }, [entries, cards, mode, source, chosenTopics]);

  const start = () => {
    const chosen = shuffle(pool).slice(0, length);
    const dirs = directionsFor(settings.direction);
    const items = chosen.map((entry) => {
      let direction = pick(dirs);
      if (mode === 'order' || mode === 'article' || mode === 'conjugate') direction = 'de-it';
      if (mode === 'listen') direction = 'it-de';
      const card: CardState = cardMap.get(cardId(entry.id, direction)) ?? newCard(entry.id, direction);
      const item: StudyItem = { entry, direction, card: { ...card, phase: card.phase === 'new' ? 'review' : card.phase } };
      let exercise: ExerciseType;
      if (mode === 'mix') exercise = chooseExercise(item, ['flip', 'type', 'choice', 'cloze', 'order', 'listen']);
      else exercise = mode;
      return { item, exercise };
    });
    setRound({ items, index: 0, good: 0, xp: 0 });
  };

  const onDone = async (rating: Rating, hints = 0) => {
    if (!round) return;
    const cur = round.items[round.index];
    const { log } = await recordReview({ entryId: cur.item.entry.id, direction: cur.item.direction, rating, exercise: cur.exercise, hints, srs: false });
    setRound({ ...round, index: round.index + 1, good: round.good + (rating >= 3 ? 1 : 0), xp: round.xp + log.xp });
  };

  if (round && entries) {
    if (round.index >= round.items.length) {
      return (
        <div className="page center-page">
          <Confetti />
          <div className="panel done-panel">
            <div className="done-emoji">🎯</div>
            <h1>Allenamento finito!</h1>
            <div className="stat-row">
              <div className="stat">
                <b>
                  {round.good}/{round.items.length}
                </b>
                <span>richtig</span>
              </div>
              <div className="stat">
                <b>+{round.xp}</b>
                <span>XP</span>
              </div>
            </div>
            <div className="btn-row">
              <button className="btn" onClick={() => setRound(null)}>
                Andere Übung
              </button>
              <button className="btn btn-primary" onClick={start}>
                Nochmal
              </button>
            </div>
          </div>
        </div>
      );
    }
    const cur = round.items[round.index];
    return (
      <div className="page page-study">
        <div className="session-top">
          <button className="btn btn-ghost" onClick={() => setRound(null)}>
            ✕ Beenden
          </button>
          <ProgressBar value={round.index / round.items.length} />
          <span className="session-count">
            {round.index}/{round.items.length}
          </span>
        </div>
        {cur.exercise === 'article' ? (
          <ArticleDrill key={round.index} entry={cur.item.entry} settings={settings} onDone={onDone} />
        ) : cur.exercise === 'conjugate' ? (
          <ConjugationDrill key={round.index} entry={cur.item.entry} settings={settings} onDone={onDone} />
        ) : (
          <StudyCard key={round.index} item={cur.item} exercise={cur.exercise} pool={entries} settings={settings} srs={false} onDone={onDone} />
        )}
      </div>
    );
  }

  return (
    <div className="page">
      <h1>Freies Training</h1>
      <p className="muted">Übe gezielt, ohne deinen Wiederholungsplan zu verändern. Du sammelst trotzdem XP.</p>
      <div className="mode-grid">
        {MODES.map((m) => (
          <button key={m.id} className={`mode-card ${mode === m.id ? 'on' : ''}`} onClick={() => setMode(m.id)}>
            <span className="mode-icon">{m.icon}</span>
            <b>{m.title}</b>
            <span className="small muted">{m.desc}</span>
          </button>
        ))}
      </div>

      <div className="panel">
        <h2>Welche Karten?</h2>
        <Segmented
          value={source}
          onChange={setSource}
          options={[
            { value: 'all', label: 'Alle' },
            { value: 'learned', label: 'Schon gelernt' },
            { value: 'hard', label: 'Schwierige' },
          ]}
        />
        <div className="number-row">
          <span>Anzahl</span>
          <input type="range" min={5} max={50} step={5} value={length} onChange={(e) => setLength(Number(e.target.value))} />
          <b>{length}</b>
        </div>
        <TopicPicker topics={topics} selected={chosenTopics} onChange={setChosenTopics} />
      </div>

      <div className="sticky-cta">
        <button className="btn btn-primary btn-big btn-block" disabled={!pool.length} onClick={start}>
          {pool.length ? `${MODES.find((m) => m.id === mode)!.icon} Start – ${Math.min(length, pool.length)} von ${pool.length} passenden Karten` : 'Keine passenden Karten'}
        </button>
      </div>
      <p className="muted small center">Übungsarten im Mix: {(['flip', 'type', 'choice', 'cloze', 'order', 'listen'] as ExerciseType[]).map((x) => EXERCISE_LABEL[x].label).join(', ')}</p>
    </div>
  );
}
