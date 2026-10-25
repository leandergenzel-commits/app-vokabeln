import { useRef, useState } from 'react';
import { Segmented } from '../components/Controls';
import { exportBackup, importBackup, saveSettings, wipeAll, type Backup } from '../lib/db';
import { useSettings } from '../lib/hooks';
import { canSpeak, speak } from '../lib/tts';
import { dayKey } from '../lib/util';
import { DIRECTION_OPTIONS } from './Learn';

export function SettingsPage() {
  const s = useSettings();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const download = async () => {
    const backup = await exportBackup();
    const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `parliamo-sicherung-${dayKey()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const restore = async (file: File) => {
    try {
      const data = JSON.parse(await file.text()) as Backup;
      const r = await importBackup(data);
      setMsg(`Sicherung eingespielt: ${r.entries} Einträge, ${r.cards} Lernstände, ${r.reviews} Wiederholungen übernommen.`);
    } catch (e) {
      setMsg(`Fehler: ${(e as Error).message}`);
    }
  };

  return (
    <div className="page">
      <h1>Einstellungen</h1>

      <div className="panel">
        <h2>Lernen</h2>
        <div className="setting">
          <span>Lernrichtung</span>
          <Segmented value={s.direction} options={DIRECTION_OPTIONS} onChange={(direction) => saveSettings({ direction })} />
        </div>
        <div className="setting">
          <span>Neue Karten pro Tag</span>
          <div className="number-row">
            <input type="range" min={0} max={50} value={s.newPerDay} onChange={(e) => saveSettings({ newPerDay: Number(e.target.value) })} />
            <b>{s.newPerDay}</b>
          </div>
        </div>
        <div className="setting">
          <span>Max. Wiederholungen pro Tag</span>
          <div className="number-row">
            <input type="range" min={20} max={500} step={10} value={s.maxReviewsPerDay} onChange={(e) => saveSettings({ maxReviewsPerDay: Number(e.target.value) })} />
            <b>{s.maxReviewsPerDay}</b>
          </div>
        </div>
        <div className="setting">
          <span>Tagesziel (Karten)</span>
          <div className="number-row">
            <input type="range" min={5} max={150} step={5} value={s.dailyGoal} onChange={(e) => saveSettings({ dailyGoal: Number(e.target.value) })} />
            <b>{s.dailyGoal}</b>
          </div>
        </div>
        <label className="setting check">
          <input type="checkbox" checked={s.strictAccents} onChange={(e) => saveSettings({ strictAccents: e.target.checked })} />
          <span>Akzente müssen beim Eintippen stimmen (è, à, ù …)</span>
        </label>
      </div>

      <div className="panel">
        <h2>Aussprache</h2>
        {!canSpeak() && <p className="muted">Dieser Browser unterstützt keine Sprachausgabe.</p>}
        <label className="setting check">
          <input type="checkbox" checked={s.autoSpeak} onChange={(e) => saveSettings({ autoSpeak: e.target.checked })} />
          <span>Italienisch automatisch vorlesen</span>
        </label>
        <div className="setting">
          <span>Sprechtempo</span>
          <div className="number-row">
            <input type="range" min={0.5} max={1.2} step={0.05} value={s.speechRate} onChange={(e) => saveSettings({ speechRate: Number(e.target.value) })} />
            <b>{s.speechRate.toFixed(2)}</b>
            <button className="btn btn-small" onClick={() => speak('Buongiorno! Vorrei un caffè, per favore.', s.speechRate)}>
              🔊 Test
            </button>
          </div>
        </div>
        <p className="small muted">Tipp für iPhone/iPad: Unter Einstellungen → Bedienungshilfen → Gesprochene Inhalte → Stimmen → Italienisch kannst du eine bessere Stimme (z. B. „Alice (Premium)“) laden.</p>
      </div>

      <div className="panel">
        <h2>Darstellung</h2>
        <Segmented
          value={s.theme}
          onChange={(theme) => saveSettings({ theme })}
          options={[
            { value: 'auto', label: 'Automatisch' },
            { value: 'light', label: '☀️ Hell' },
            { value: 'dark', label: '🌙 Dunkel' },
          ]}
        />
      </div>

      <div className="panel">
        <h2>Daten & Sicherung</h2>
        <p className="small muted">
          Alle Daten liegen nur auf diesem Gerät im Browser. Mit einer Sicherungsdatei kannst du sie auf ein anderes Gerät übertragen, z. B. vom Handy aufs Tablet. Beim Einspielen
          wird zusammengeführt: Der neuere Stand gewinnt, und Lernprotokolle beider Geräte bleiben erhalten.
        </p>
        <div className="btn-row">
          <button className="btn" onClick={download}>
            ⬇️ Sicherung herunterladen
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            ⬆️ Sicherung einspielen
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) restore(f);
              e.target.value = '';
            }}
          />
        </div>
        {msg && <div className="alert alert-ok">{msg}</div>}
        <hr />
        <button
          className="btn btn-danger"
          onClick={async () => {
            if (confirm('Wirklich ALLES löschen (Lernstand, eigene Vokabeln, Einstellungen)? Lade vorher eine Sicherung herunter!')) {
              await wipeAll();
              setMsg('Alles zurückgesetzt.');
            }
          }}
        >
          Alles zurücksetzen
        </button>
      </div>

      <p className="small muted center">Parliamo! · Daten bleiben auf deinem Gerät · Wiederholung nach dem Anki-Verfahren (SM-2)</p>
    </div>
  );
}
