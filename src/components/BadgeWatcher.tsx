import { useEffect, useState } from 'react';
import { getMeta, setMeta } from '../lib/db';
import { computeBadges, levelInfo, streak, type Badge } from '../lib/gamification';
import { useCards, useEntries, useReviews } from '../lib/hooks';
import { activityByDay } from '../lib/stats';

interface Toast {
  id: string;
  emoji: string;
  title: string;
  text: string;
}

/** Meldet neu verdiente Abzeichen und Level-Aufstiege */
export function BadgeWatcher() {
  const entries = useEntries();
  const cards = useCards();
  const reviews = useReviews();
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    if (!entries || !cards || !reviews) return;
    let cancelled = false;
    (async () => {
      const st = streak(new Set(activityByDay(reviews).keys()));
      const badges = computeBadges({ reviews, cards, entries, streakBest: st.best });
      const earned = badges.filter((b) => b.progress >= 1).map((b) => b.id);
      const level = levelInfo(reviews.reduce((a, r) => a + r.xp, 0));
      const known = await getMeta<string[] | null>('badges', null);
      const knownLevel = await getMeta<number | null>('level', null);
      if (cancelled) return;
      const fresh: Toast[] = [];
      if (known) {
        for (const b of badges.filter((x: Badge) => earned.includes(x.id) && !known.includes(x.id))) {
          fresh.push({ id: b.id, emoji: b.emoji, title: `Abzeichen: ${b.name}`, text: b.description });
        }
      }
      if (knownLevel !== null && level.level > knownLevel) {
        fresh.push({ id: `level-${level.level}`, emoji: level.emoji, title: `Level ${level.level}!`, text: `Du bist jetzt „${level.name}“` });
      }
      if (!known || fresh.length || earned.length !== known.length) await setMeta('badges', earned);
      if (knownLevel !== level.level) await setMeta('level', level.level);
      if (fresh.length) setToasts((t) => [...t, ...fresh]);
    })();
    return () => {
      cancelled = true;
    };
  }, [entries, cards, reviews]);

  useEffect(() => {
    if (!toasts.length) return;
    const t = setTimeout(() => setToasts((list) => list.slice(1)), 4500);
    return () => clearTimeout(t);
  }, [toasts]);

  return (
    <div className="toasts" aria-live="polite">
      {toasts.slice(0, 2).map((t) => (
        <div key={t.id} className="toast" onClick={() => setToasts((list) => list.filter((x) => x.id !== t.id))}>
          <span className="toast-emoji">{t.emoji}</span>
          <div>
            <b>{t.title}</b>
            <div className="small">{t.text}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
