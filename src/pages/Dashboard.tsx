import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ForecastBars, Heatmap, MasteryBar, MasteryLegend } from '../components/Charts';
import { ProgressBar, Ring } from '../components/Controls';
import { topicEmoji } from '../data/topics';
import { computeBadges, levelInfo, streak } from '../lib/gamification';
import { useCards, useEntries, useReviews, useSettings } from '../lib/hooks';
import { buildQueue, todayCounts } from '../lib/session';
import { MASTERY_LABEL, mastery } from '../lib/srs';
import { accuracy, activityByDay, forecast, hardest, masteryByTopic, masteryCounts } from '../lib/stats';
import { speak } from '../lib/tts';
import type { Direction } from '../lib/types';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Buonanotte';
  if (h < 13) return 'Buongiorno';
  if (h < 18) return 'Buon pomeriggio';
  return 'Buonasera';
}

const pct = (v: number | null) => (v === null ? '–' : `${Math.round(v * 100)} %`);

export function Dashboard() {
  const settings = useSettings();
  const entries = useEntries();
  const cards = useCards();
  const reviews = useReviews();
  const [showAllTopics, setShowAllTopics] = useState(false);

  const data = useMemo(() => {
    if (!entries || !cards || !reviews) return null;
    const activity = activityByDay(reviews);
    const st = streak(new Set(activity.keys()));
    const xp = reviews.reduce((a, r) => a + r.xp, 0);
    const queue = buildQueue(entries, cards, reviews, settings);
    const today = todayCounts(reviews);
    const dirs: Direction[] = ['de-it', 'it-de'];
    const overall = masteryCounts(entries, cards, dirs);
    const topics = masteryByTopic(entries, cards, dirs).sort((a, b) => {
      const pa = (a.total - a.counts.new) / a.total;
      const pb = (b.total - b.counts.new) / b.total;
      return pb - pa || b.total - a.total;
    });
    const started = new Set(cards.filter((c) => c.phase !== 'new').map((c) => c.entryId)).size;
    return {
      activity,
      st,
      level: levelInfo(xp),
      xp,
      due: queue.due.length,
      fresh: queue.fresh.length,
      today,
      overall,
      topics,
      started,
      forecast: forecast(cards),
      accDeIt: accuracy(reviews, 'de-it'),
      accItDe: accuracy(reviews, 'it-de'),
      hardest: hardest(cards, entries),
      badges: computeBadges({ reviews, cards, entries, streakBest: st.best }),
    };
  }, [entries, cards, reviews, settings]);

  if (!data || !entries) return <div className="page">Lade …</div>;

  const goal = data.today.total / Math.max(1, settings.dailyGoal);
  const totalCards = entries.length * 2;
  const earned = data.badges.filter((b) => b.progress >= 1);
  const toShow = showAllTopics ? data.topics : data.topics.slice(0, 8);

  return (
    <div className="page dashboard">
      <section className="hero">
        <div className="hero-text">
          <h1>{greeting()}! 👋</h1>
          {data.due + data.fresh > 0 ? (
            <p>
              Heute warten <b>{data.due}</b> Wiederholungen und <b>{data.fresh}</b> neue Karten auf dich.
            </p>
          ) : (
            <p>Für heute ist alles erledigt. Perfetto! Lust auf ein freies Training?</p>
          )}
          <div className="btn-row">
            <Link to="/lernen" className="btn btn-primary btn-big">
              📇 Jetzt lernen
            </Link>
            <Link to="/training" className="btn btn-big">
              🎯 Training
            </Link>
          </div>
        </div>
        <Ring value={goal} size={124} stroke={12}>
          <b className="ring-num">{data.today.total}</b>
          <span className="ring-sub">von {settings.dailyGoal}</span>
          <span className="ring-sub">Tagesziel</span>
        </Ring>
      </section>

      <section className="tiles">
        <div className="tile-stat">
          <span className="tile-icon">🔥</span>
          <b>{data.st.current}</b>
          <span>{data.st.current === 1 ? 'Tag Serie' : 'Tage Serie'}</span>
          <small className="muted">Rekord: {data.st.best}</small>
        </div>
        <div className="tile-stat">
          <span className="tile-icon">{data.level.emoji}</span>
          <b>Level {data.level.level}</b>
          <span>{data.level.name}</span>
          <ProgressBar value={data.level.progress} label="Fortschritt zum nächsten Level" />
          <small className="muted">
            {data.level.xpInLevel}/{data.level.xpForNext} XP
          </small>
        </div>
        <div className="tile-stat">
          <span className="tile-icon">📚</span>
          <b>{data.started}</b>
          <span>von {entries.length} Einträgen begonnen</span>
          <small className="muted">{data.overall.mature} Karten gemeistert</small>
        </div>
        <div className="tile-stat">
          <span className="tile-icon">🎯</span>
          <b>{pct(data.accDeIt)}</b>
          <span>🇩🇪→🇮🇹 gewusst</span>
          <small className="muted">🇮🇹→🇩🇪 {pct(data.accItDe)} · letzte 30 Tage</small>
        </div>
      </section>

      <section className="panel">
        <h2>Lernstand</h2>
        <p className="muted small">Jeder Eintrag zählt zweimal, einmal pro Richtung. „Gemeistert“ heißt: Die Wiederholung liegt mindestens 21 Tage entfernt.</p>
        <MasteryBar counts={data.overall} total={totalCards} />
        <MasteryLegend counts={data.overall} />
      </section>

      <div className="grid-2">
        <section className="panel">
          <h2>Aktivität</h2>
          <Heatmap data={data.activity} />
        </section>
        <section className="panel">
          <h2>Vorschau</h2>
          <ForecastBars data={data.forecast} />
        </section>
      </div>

      <section className="panel">
        <h2>Themen</h2>
        <div className="topic-list">
          {toShow.map((t) => (
            <div key={t.topic} className="topic-row">
              <span className="topic-name">
                {topicEmoji(t.topic)} {t.topic}
              </span>
              <MasteryBar counts={t.counts} total={t.total} compact />
              <span className="topic-pct">{Math.round(((t.total - t.counts.new) / t.total) * 100)} %</span>
            </div>
          ))}
        </div>
        {data.topics.length > 8 && (
          <button className="btn btn-ghost" onClick={() => setShowAllTopics(!showAllTopics)}>
            {showAllTopics ? 'Weniger anzeigen' : `Alle ${data.topics.length} Themen anzeigen`}
          </button>
        )}
      </section>

      <div className="grid-2">
        <section className="panel">
          <h2>Deine Knacknüsse 🥜</h2>
          {data.hardest.length === 0 ? (
            <p className="muted">Noch keine. Hier erscheinen Karten, die du öfter vergisst.</p>
          ) : (
            <ul className="hard-list">
              {data.hardest.map(({ entry, card }) => (
                <li key={card.id}>
                  <button className="speak-inline" onClick={() => speak(entry.it, settings.speechRate)} aria-label="Vorlesen">
                    🔊
                  </button>
                  <span className="it">{entry.it}</span>
                  <span className="muted">{entry.de}</span>
                  <span className="chip chip-soft">
                    {card.lapses}× vergessen · {MASTERY_LABEL[mastery(card)]}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {data.hardest.length > 0 && (
            <Link to="/training" className="btn btn-ghost">
              Gezielt üben →
            </Link>
          )}
        </section>

        <section className="panel">
          <h2>
            Abzeichen <span className="muted small">{earned.length}/{data.badges.length}</span>
          </h2>
          <div className="badges">
            {data.badges.map((b) => (
              <div key={b.id} className={`badge ${b.progress >= 1 ? 'earned' : ''}`} title={b.description}>
                <span className="badge-emoji">{b.emoji}</span>
                <b>{b.name}</b>
                <small>{b.description}</small>
                {b.progress < 1 && <ProgressBar value={b.progress} />}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
