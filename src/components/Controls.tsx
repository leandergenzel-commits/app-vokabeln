import type { ReactNode } from 'react';

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  label?: string;
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          className={value === o.value ? 'active' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function TopicPicker({
  topics,
  selected,
  onChange,
}: {
  topics: { name: string; count: number; emoji: string }[];
  selected: string[];
  onChange: (t: string[]) => void;
}) {
  const all = selected.length === 0;
  const toggle = (name: string) => onChange(selected.includes(name) ? selected.filter((t) => t !== name) : [...selected, name]);
  const words = topics.filter((t) => !t.name.startsWith('Sätze'));
  const phrases = topics.filter((t) => t.name.startsWith('Sätze'));
  const chip = (t: { name: string; count: number; emoji: string }) => (
    <button key={t.name} className={`chip chip-toggle ${selected.includes(t.name) ? 'on' : ''}`} onClick={() => toggle(t.name)}>
      {t.emoji} {t.name.replace('Sätze: ', '')} <span className="chip-count">{t.count}</span>
    </button>
  );
  return (
    <div className="topic-picker">
      <button className={`chip chip-toggle ${all ? 'on' : ''}`} onClick={() => onChange([])}>
        🌍 Alle Themen
      </button>
      <div className="topic-group-label">Wortschatz</div>
      <div className="chips">{words.map(chip)}</div>
      {phrases.length > 0 && (
        <>
          <div className="topic-group-label">Alltagssätze</div>
          <div className="chips">{phrases.map(chip)}</div>
        </>
      )}
    </div>
  );
}

export function ProgressBar({ value, label }: { value: number; label?: string }) {
  return (
    <div className="progress" role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className="progress-fill" style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }} />
    </div>
  );
}

export function Ring({ value, size = 96, stroke = 10, children }: { value: number; size?: number; stroke?: number; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.min(1, Math.max(0, value));
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={v >= 1 ? 'var(--verde)' : 'var(--accent)'}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c * v} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="ring-center">{children}</div>
    </div>
  );
}

export function Confetti() {
  const colors = ['var(--verde)', 'var(--rosso)', '#fff', 'var(--oro)'];
  return (
    <div className="confetti" aria-hidden>
      {Array.from({ length: 40 }, (_, i) => (
        <span
          key={i}
          style={{
            left: `${(i * 37) % 100}%`,
            background: colors[i % colors.length],
            animationDelay: `${(i % 10) * 0.08}s`,
            animationDuration: `${1.8 + (i % 5) * 0.3}s`,
          }}
        />
      ))}
    </div>
  );
}
