import { useState } from 'react';
import type { Mastery } from '../lib/srs';
import { MASTERY_LABEL } from '../lib/srs';
import { addDays, dayKey } from '../lib/util';

const MASTERY_ORDER: Mastery[] = ['new', 'learning', 'young', 'mature'];
const WEEKDAYS = ['Mo', '', 'Mi', '', 'Fr', '', 'So'];
const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

function formatDay(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** Aktivitätskalender: Wiederholungen pro Tag, eine Farbe hell → dunkel */
export function Heatmap({ data, weeks = 18 }: { data: Map<string, number>; weeks?: number }) {
  const [hover, setHover] = useState<string | null>(null);
  const today = dayKey();
  const [y, m, d] = today.split('-').map(Number);
  const weekday = (new Date(y, m - 1, d).getDay() + 6) % 7; // Mo = 0
  const start = addDays(today, -(weeks - 1) * 7 - weekday);
  const max = Math.max(1, ...data.values());
  const level = (n: number) => (n === 0 ? 0 : Math.min(4, Math.ceil((n / max) * 4)));
  const cell = 14;
  const gap = 3;
  const cols = Array.from({ length: weeks }, (_, w) => Array.from({ length: 7 }, (_, i) => addDays(start, w * 7 + i)));
  const total = [...data.values()].reduce((a, b) => a + b, 0);

  return (
    <figure className="chart">
      <div className="chart-scroll">
        <svg width={28 + weeks * (cell + gap)} height={18 + 7 * (cell + gap)} role="img" aria-label={`Aktivitätskalender, ${total} Wiederholungen insgesamt`}>
          {WEEKDAYS.map((w, i) => (
            <text key={i} x={0} y={18 + i * (cell + gap) + cell - 3} className="axis-label">
              {w}
            </text>
          ))}
          {cols.map((days, w) => {
            const first = days[0];
            const showMonth = first.slice(8) <= '07';
            return (
              <g key={w} transform={`translate(${28 + w * (cell + gap)},0)`}>
                {showMonth && (
                  <text x={0} y={11} className="axis-label">
                    {MONTHS[Number(first.slice(5, 7)) - 1]}
                  </text>
                )}
                {days.map((day, i) => {
                  if (day > today) return null;
                  const n = data.get(day) ?? 0;
                  return (
                    <rect
                      key={day}
                      x={0}
                      y={18 + i * (cell + gap)}
                      width={cell}
                      height={cell}
                      rx={3}
                      className={`heat heat-${level(n)} ${day === today ? 'heat-today' : ''}`}
                      onMouseEnter={() => setHover(day)}
                      onMouseLeave={() => setHover(null)}
                      onClick={() => setHover(day)}
                    >
                      <title>{`${formatDay(day)}: ${n} Wiederholungen`}</title>
                    </rect>
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>
      <figcaption className="chart-caption">
        {hover ? (
          <>
            <b>{formatDay(hover)}</b>: {data.get(hover) ?? 0} Wiederholungen
          </>
        ) : (
          <span className="heat-legend">
            weniger <i className="heat-0" /> <i className="heat-1" /> <i className="heat-2" /> <i className="heat-3" /> <i className="heat-4" /> mehr
          </span>
        )}
      </figcaption>
    </figure>
  );
}

/** Gestapelter Balken für den Lernstand (geordnet: neu → gemeistert) */
export function MasteryBar({ counts, total, compact = false }: { counts: Record<Mastery, number>; total: number; compact?: boolean }) {
  return (
    <div className={`mbar ${compact ? 'mbar-compact' : ''}`} role="img" aria-label={MASTERY_ORDER.map((k) => `${MASTERY_LABEL[k]} ${counts[k]}`).join(', ')}>
      {MASTERY_ORDER.map((k) =>
        counts[k] > 0 ? (
          <div key={k} className={`mseg m-${k}`} style={{ flexGrow: counts[k] / Math.max(1, total) }} title={`${MASTERY_LABEL[k]}: ${counts[k]}`} />
        ) : null,
      )}
    </div>
  );
}

export function MasteryLegend({ counts }: { counts: Record<Mastery, number> }) {
  return (
    <div className="legend">
      {MASTERY_ORDER.map((k) => (
        <span key={k} className="legend-item">
          <i className={`swatch m-${k}`} />
          {MASTERY_LABEL[k]} <b>{counts[k]}</b>
        </span>
      ))}
    </div>
  );
}

/** Fälligkeiten der kommenden Tage */
export function ForecastBars({ data }: { data: { day: string; count: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.count));
  const h = 110;
  return (
    <figure className="chart">
      <div className="fbars" style={{ height: h + 36 }}>
        {data.map((d, i) => (
          <div
            key={d.day}
            className={`fbar-col ${hover === i ? 'is-hover' : ''}`}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            onClick={() => setHover(i)}
            title={`${formatDay(d.day)}: ${d.count} fällig`}
          >
            <span className="fbar-value">{i === 0 || hover === i ? d.count : ''}</span>
            <div className="fbar" style={{ height: Math.max(d.count ? 4 : 1, (d.count / max) * h) }} />
            <span className="axis-label">{i === 0 ? 'Heute' : formatDay(d.day).split(',')[0]}</span>
          </div>
        ))}
      </div>
      <figcaption className="chart-caption">
        {hover !== null ? (
          <>
            <b>{formatDay(data[hover].day)}</b>: {data[hover].count} Karten fällig
          </>
        ) : (
          'Fällige Karten der nächsten 7 Tage'
        )}
      </figcaption>
    </figure>
  );
}
