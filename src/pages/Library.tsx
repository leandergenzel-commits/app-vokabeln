import { useMemo, useState } from 'react';
import { blankEntry, EntryEditor, POS_LABEL } from '../components/EntryEditor';
import { stripAccents } from '../lib/check';
import { useCards, useEntries, useSettings, useTopics } from '../lib/hooks';
import { MASTERY_LABEL, mastery, type Mastery } from '../lib/srs';
import { speak } from '../lib/tts';
import type { Entry } from '../lib/types';

const PAGE = 60;

export function Library() {
  const settings = useSettings();
  const entries = useEntries();
  const cards = useCards();
  const topics = useTopics(entries);
  const [q, setQ] = useState('');
  const [topic, setTopic] = useState('');
  const [status, setStatus] = useState<'' | Mastery>('');
  const [limit, setLimit] = useState(PAGE);
  const [editing, setEditing] = useState<{ entry: Entry; isNew: boolean } | null>(null);

  const cardMap = useMemo(() => new Map((cards ?? []).map((c) => [c.id, c])), [cards]);

  const filtered = useMemo(() => {
    if (!entries) return [];
    const needle = stripAccents(q.trim().toLowerCase());
    return entries
      .filter((e) => {
        if (topic && e.topic !== topic) return false;
        if (needle && !stripAccents(`${e.it} ${e.de}`.toLowerCase()).includes(needle)) return false;
        if (status) {
          const m1 = mastery(cardMap.get(`${e.id}|de-it`));
          const m2 = mastery(cardMap.get(`${e.id}|it-de`));
          if (m1 !== status && m2 !== status) return false;
        }
        return true;
      })
      .sort((a, b) => (a.source === 'seed' ? 1 : 0) - (b.source === 'seed' ? 1 : 0) || (a.rank ?? 0) - (b.rank ?? 0) || b.createdAt - a.createdAt);
  }, [entries, q, topic, status, cardMap]);

  return (
    <div className="page">
      <div className="page-head">
        <h1>Vokabeln & Sätze</h1>
        <button className="btn btn-primary" onClick={() => setEditing({ entry: blankEntry(topic || 'Mein Kurs'), isNew: true })}>
          + Neuer Eintrag
        </button>
      </div>

      <div className="filters">
        <input type="search" placeholder="🔍 Suchen (italienisch oder deutsch)" value={q} onChange={(e) => { setQ(e.target.value); setLimit(PAGE); }} />
        <select value={topic} onChange={(e) => { setTopic(e.target.value); setLimit(PAGE); }}>
          <option value="">Alle Themen</option>
          {topics.map((t) => (
            <option key={t.name} value={t.name}>
              {t.emoji} {t.name} ({t.count})
            </option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value as '' | Mastery)}>
          <option value="">Jeder Lernstand</option>
          {(Object.keys(MASTERY_LABEL) as Mastery[]).map((m) => (
            <option key={m} value={m}>
              {MASTERY_LABEL[m]}
            </option>
          ))}
        </select>
      </div>
      <p className="muted small">{filtered.length} Einträge · Punkte: 🇩🇪→🇮🇹 und 🇮🇹→🇩🇪</p>

      <ul className="entry-list">
        {filtered.slice(0, limit).map((e) => (
          <li key={e.id} className="entry-row" onClick={() => setEditing({ entry: e, isNew: false })}>
            <span className="entry-emoji">{e.emoji ?? '·'}</span>
            <div className="entry-main">
              <span className="it">{e.it}</span>
              <span className="muted">{e.de}</span>
            </div>
            <div className="entry-side">
              {e.pos && e.pos !== 'phrase' && <span className="chip chip-soft">{POS_LABEL[e.pos]}{e.gender ? ` · ${e.gender}` : ''}</span>}
              <span className="dots" title="Lernstand je Richtung">
                <i className={`dot m-${mastery(cardMap.get(`${e.id}|de-it`))}`} />
                <i className={`dot m-${mastery(cardMap.get(`${e.id}|it-de`))}`} />
              </span>
              <button
                className="speak-inline"
                onClick={(ev) => {
                  ev.stopPropagation();
                  speak(e.it, settings.speechRate);
                }}
                aria-label="Vorlesen"
              >
                🔊
              </button>
            </div>
          </li>
        ))}
      </ul>
      {filtered.length > limit && (
        <button className="btn btn-block" onClick={() => setLimit(limit + PAGE * 2)}>
          Mehr anzeigen ({filtered.length - limit} weitere)
        </button>
      )}

      {editing && <EntryEditor entry={editing.entry} isNew={editing.isNew} topics={topics.map((t) => t.name)} onClose={() => setEditing(null)} />}
    </div>
  );
}
