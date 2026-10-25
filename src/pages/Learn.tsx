import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Confetti, ProgressBar, Segmented, TopicPicker } from '../components/Controls';
import { EXERCISE_LABEL, StudyCard } from '../components/StudyCard';
import { db, getSettings, recordReview, saveSettings } from '../lib/db';
import { useCards, useEntries, useReviews, useSettings, useTopics } from '../lib/hooks';
import { buildQueue, chooseExercise, interleave, LEARN_AHEAD, type StudyItem } from '../lib/session';
import type { DirectionSetting, Entry, ExerciseType, Rating, Settings } from '../lib/types';

const SRS_EXERCISES: ExerciseType[] = ['flip', 'type', 'choice', 'cloze', 'order', 'listen'];

export const DIRECTION_OPTIONS: { value: DirectionSetting; label: string }[] = [
  { value: 'de-it', label: '🇩🇪 → 🇮🇹' },
  { value: 'it-de', label: '🇮🇹 → 🇩🇪' },
  { value: 'mix', label: '🔀 Gemischt' },
];

interface Current {
  item: StudyItem;
  exercise: ExerciseType;
}

interface SessionStats {
  count: number;
  good: number;
  xp: number;
  started: number;
  hints: number;
}

export function Learn() {
  const settings = useSettings();
  const entries = useEntries();
  const cards = useCards();
  const reviews = useReviews();
  const topics = useTopics(entries);

  const [mode, setMode] = useState<'setup' | 'session' | 'done'>('setup');
  const [queue, setQueue] = useState<StudyItem[]>([]);
  const [later, setLater] = useState<StudyItem[]>([]);
  const [current, setCurrent] = useState<Current | null>(null);
  const [pool, setPool] = useState<Entry[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<SessionStats>({ count: 0, good: 0, xp: 0, started: 0, hints: 0 });

  const preview = useMemo(() => {
    if (!entries || !cards || !reviews) return null;
    const { due, fresh } = buildQueue(entries, cards, reviews, settings);
    return { learning: due.filter((d) => d.card.phase !== 'review').length, review: due.filter((d) => d.card.phase === 'review').length, fresh: fresh.length };
  }, [entries, cards, reviews, settings]);

  const start = async () => {
    const s = await getSettings();
    const [es, cs, rs] = await Promise.all([db.entries.toArray(), db.cards.toArray(), db.reviews.toArray()]);
    const live = es.filter((e) => !e.deleted);
    const { due, fresh } = buildQueue(live, cs, rs, s);
    const q = interleave(due, fresh);
    if (!q.length) return;
    setPool(live);
    setTotal(q.length);
    setLater([]);
    setStats({ count: 0, good: 0, xp: 0, started: Date.now(), hints: 0 });
    const [first, ...rest] = q;
    setQueue(rest);
    setCurrent({ item: first, exercise: chooseExercise(first, s.exercises) });
    setMode('session');
  };

  const next = (q: StudyItem[], l: StudyItem[], s: Settings) => {
    const now = Date.now();
    const readyIdx = l.findIndex((i) => i.card.due <= now);
    let item: StudyItem | undefined;
    if (readyIdx >= 0) {
      item = l[readyIdx];
      l = l.filter((_, i) => i !== readyIdx);
    } else if (q.length) {
      [item, ...q] = q;
    } else if (l.length) {
      // Wie Anki: Lernkarten vorziehen, wenn sonst nichts mehr ansteht
      const sorted = [...l].sort((a, b) => a.card.due - b.card.due);
      item = sorted[0];
      l = sorted.slice(1);
    }
    setQueue(q);
    setLater(l);
    if (!item) {
      setCurrent(null);
      setMode('done');
      return;
    }
    setCurrent({ item, exercise: chooseExercise(item, s.exercises) });
  };

  const onDone = async (rating: Rating, hints: number) => {
    if (!current) return;
    const { item, exercise } = current;
    const { card, log } = await recordReview({ entryId: item.entry.id, direction: item.direction, rating, exercise, hints, srs: true });
    setStats((st) => ({ ...st, count: st.count + 1, good: st.good + (rating > 1 ? 1 : 0), xp: st.xp + log.xp, hints: st.hints + hints }));
    let l = later;
    if (card.phase !== 'review' && card.due <= Date.now() + LEARN_AHEAD) {
      l = [...later, { ...item, card }];
      setTotal((t) => t + 1);
    }
    next(queue, l, settings);
  };

  const update = (patch: Partial<Settings>) => saveSettings(patch);

  if (mode === 'session' && current) {
    const done = stats.count;
    return (
      <div className="page page-study">
        <div className="session-top">
          <button className="btn btn-ghost" onClick={() => setMode('done')}>
            ✕ Beenden
          </button>
          <ProgressBar value={done / Math.max(1, total)} label="Fortschritt der Sitzung" />
          <span className="session-count">
            {done}/{total}
          </span>
        </div>
        <StudyCard key={`${current.item.card.id}-${done}`} item={current.item} exercise={current.exercise} pool={pool} settings={settings} srs onDone={onDone} />
      </div>
    );
  }

  if (mode === 'done') {
    const minutes = Math.max(1, Math.round((Date.now() - stats.started) / 60000));
    const remaining = queue.length + later.length;
    return (
      <div className="page center-page">
        {stats.count > 0 && <Confetti />}
        <div className="panel done-panel">
          <div className="done-emoji">{stats.count === 0 ? '👋' : stats.good / stats.count > 0.8 ? '🏆' : '💪'}</div>
          <h1>{stats.count === 0 ? 'Bis gleich!' : 'Bravissimo!'}</h1>
          {stats.count > 0 && (
            <div className="stat-row">
              <div className="stat">
                <b>{stats.count}</b>
                <span>Karten</span>
              </div>
              <div className="stat">
                <b>{Math.round((stats.good / stats.count) * 100)} %</b>
                <span>gewusst</span>
              </div>
              <div className="stat">
                <b>+{stats.xp}</b>
                <span>XP</span>
              </div>
              <div className="stat">
                <b>{minutes}</b>
                <span>Min</span>
              </div>
            </div>
          )}
          {remaining > 0 && <p className="muted">{remaining} Karten wären noch offen – sie warten auf dich.</p>}
          <div className="btn-row">
            <Link to="/" className="btn">
              Zur Übersicht
            </Link>
            <button className="btn btn-primary" onClick={start} disabled={!preview || preview.learning + preview.review + preview.fresh === 0}>
              Weiterlernen
            </button>
          </div>
        </div>
      </div>
    );
  }

  const totalDue = preview ? preview.learning + preview.review + preview.fresh : 0;

  return (
    <div className="page">
      <h1>Lernen</h1>
      <div className="panel">
        <div className="due-summary">
          <div className="due-box due-new">
            <b>{preview?.fresh ?? '–'}</b>
            <span>neu</span>
          </div>
          <div className="due-box due-learn">
            <b>{preview?.learning ?? '–'}</b>
            <span>in Lernphase</span>
          </div>
          <div className="due-box due-review">
            <b>{preview?.review ?? '–'}</b>
            <span>Wiederholungen</span>
          </div>
        </div>
        <button className="btn btn-primary btn-big btn-block" disabled={!totalDue} onClick={start}>
          {totalDue ? `Los geht’s – ${totalDue} Karten` : 'Für heute alles erledigt 🎉'}
        </button>
        {!totalDue && preview && (
          <p className="muted center">
            Erhöhe die neuen Karten pro Tag, wähle andere Themen oder nutze das <Link to="/training">freie Training</Link>.
          </p>
        )}
      </div>

      <div className="panel">
        <h2>Lernrichtung</h2>
        <Segmented value={settings.direction} options={DIRECTION_OPTIONS} onChange={(direction) => update({ direction })} label="Lernrichtung" />
        <p className="muted small">Bei „Gemischt“ lernst du jeden Eintrag zuerst in Richtung Italienisch → Deutsch. Die Gegenrichtung folgt an einem späteren Tag.</p>
      </div>

      <div className="panel">
        <h2>Neue Karten pro Tag</h2>
        <div className="number-row">
          <input type="range" min={0} max={50} step={1} value={settings.newPerDay} onChange={(e) => update({ newPerDay: Number(e.target.value) })} />
          <b>{settings.newPerDay}</b>
        </div>
      </div>

      <div className="panel">
        <h2>Themen</h2>
        <TopicPicker topics={topics} selected={settings.topics} onChange={(t) => update({ topics: t })} />
      </div>

      <div className="panel">
        <h2>Übungsarten</h2>
        <p className="muted small">Die App wechselt zwischen den gewählten Übungen ab. Neue Karten werden zuerst als Karteikarte oder mit Auswahl eingeführt.</p>
        <div className="exercise-grid">
          {SRS_EXERCISES.map((ex) => {
            const on = settings.exercises.includes(ex);
            return (
              <button
                key={ex}
                className={`exercise-toggle ${on ? 'on' : ''}`}
                onClick={() => {
                  const list = on ? settings.exercises.filter((x) => x !== ex) : [...settings.exercises, ex];
                  if (list.length) update({ exercises: list });
                }}
              >
                <span className="ex-icon">{EXERCISE_LABEL[ex].icon}</span>
                <b>{EXERCISE_LABEL[ex].label}</b>
                <span className="small muted">{EXERCISE_LABEL[ex].desc}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
