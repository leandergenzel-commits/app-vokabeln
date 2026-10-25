import { useMemo, useRef, useState } from 'react';
import { Segmented } from '../components/Controls';
import { POS_LABEL } from '../components/EntryEditor';
import { hasWebGPU, structureWithLocalAi, WEBLLM_MODELS } from '../ai/local';
import { claudePrompt, DEFAULT_TOPIC_HINT } from '../ai/prompt';
import { extractJson, itemsFromJson, itemToEntry, parseSimpleList } from '../ai/schema';
import { normalize } from '../lib/check';
import { db, saveSettings } from '../lib/db';
import { useEntries, useSettings, useTopics } from '../lib/hooks';
import type { Entry } from '../lib/types';

type Tab = 'local' | 'claude' | 'simple';

interface Draft {
  entry: Entry;
  selected: boolean;
  duplicate: boolean;
}

export function ImportPage() {
  const settings = useSettings();
  const entries = useEntries();
  const topics = useTopics(entries);
  const [tab, setTab] = useState<Tab>('local');
  const [notes, setNotes] = useState('');
  const [fallbackTopic, setFallbackTopic] = useState('Mein Kurs');
  const [claudeAnswer, setClaudeAnswer] = useState('');
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ text: string; progress?: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const cancel = useRef({ cancelled: false });

  const topicNames = useMemo(() => {
    const own = topics.map((t) => t.name);
    return [...new Set([...DEFAULT_TOPIC_HINT, ...own])];
  }, [topics]);

  const existing = useMemo(() => new Set((entries ?? []).map((e) => normalize(e.it))), [entries]);

  const toDrafts = (list: Entry[]) => {
    const seen = new Set<string>();
    const out: Draft[] = [];
    for (const entry of list) {
      const key = normalize(entry.it);
      if (seen.has(key)) continue;
      seen.add(key);
      const duplicate = existing.has(key);
      out.push({ entry, selected: !duplicate, duplicate });
    }
    setDrafts(out);
    setDone(null);
    if (!out.length) setError('Es wurden keine Einträge erkannt.');
  };

  const runLocal = async () => {
    setError(null);
    setBusy(true);
    cancel.current = { cancelled: false };
    try {
      const { entries: list, errors } = await structureWithLocalAi(notes, settings.ai, topicNames, fallbackTopic, setProgress, cancel.current);
      toDrafts(list);
      if (errors.length) setError(`Einige Abschnitte konnten nicht verarbeitet werden:\n${errors.join('\n')}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const parseClaude = () => {
    setError(null);
    try {
      const items = itemsFromJson(extractJson(claudeAnswer));
      toDrafts(items.map((i) => itemToEntry(i, fallbackTopic)));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const parseSimple = () => {
    setError(null);
    toDrafts(parseSimpleList(notes, fallbackTopic));
  };

  const doImport = async () => {
    const chosen = drafts.filter((d) => d.selected).map((d) => d.entry);
    await db.entries.bulkPut(chosen);
    setDone(`${chosen.length} Einträge importiert. Sie kommen beim nächsten Lernen als neue Karten dran.`);
    setDrafts([]);
    setNotes('');
    setClaudeAnswer('');
  };

  const updateDraft = (i: number, patch: Partial<Entry>) => setDrafts(drafts.map((d, j) => (j === i ? { ...d, entry: { ...d.entry, ...patch } } : d)));

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(claudePrompt(notes, topicNames));
    setDone('Prompt kopiert! Füge ihn bei Claude ein und kopiere die Antwort zurück.');
  };

  return (
    <div className="page">
      <h1>Eigene Vokabeln importieren</h1>
      <p className="muted">
        Füge Notizen aus deinem Sprachkurs ein, egal wie unordentlich. Die KI macht daraus Lernkarten mit Artikel, Eselsbrücke, Emoji und Beispielsatz. Vor dem Speichern
        kannst du alles prüfen.
      </p>

      <Segmented
        value={tab}
        onChange={(t) => {
          setTab(t);
          setError(null);
        }}
        options={[
          { value: 'local', label: '🖥️ Lokale KI' },
          { value: 'claude', label: '✳️ Über Claude' },
          { value: 'simple', label: '📝 Einfache Liste' },
        ]}
      />

      <div className="panel">
        <label className="block-label">
          Thema für Einträge ohne erkanntes Thema
          <input value={fallbackTopic} onChange={(e) => setFallbackTopic(e.target.value)} list="import-topics" />
          <datalist id="import-topics">
            {topicNames.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </label>

        <label className="block-label">
          {tab === 'simple' ? 'Eine Zeile pro Eintrag: italienisch – deutsch' : 'Deine Notizen'}
          <textarea
            rows={8}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={
              tab === 'simple'
                ? 'la finestra - das Fenster\nandare = gehen\nil conto ; die Rechnung'
                : 'z. B.\nLektion 4 – Am Bahnhof\nbinario Gleis, il biglietto, andata e ritorno\nquanto costa? was kostet…\nperdere il treno – Zug verpassen'
            }
          />
        </label>

        {tab === 'local' && (
          <div className="ai-box">
            <Segmented
              value={settings.ai.engine}
              onChange={(engine) => saveSettings({ ai: { ...settings.ai, engine } })}
              options={[
                { value: 'webllm', label: 'Im Browser (WebGPU)' },
                { value: 'ollama', label: 'Ollama / LM Studio' },
              ]}
            />
            {settings.ai.engine === 'webllm' ? (
              <>
                <label className="block-label">
                  Modell
                  <select value={settings.ai.webllmModel} onChange={(e) => saveSettings({ ai: { ...settings.ai, webllmModel: e.target.value } })}>
                    {WEBLLM_MODELS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="small muted">
                  {hasWebGPU() ? '✅ WebGPU verfügbar.' : '⚠️ Dieser Browser hat kein WebGPU. Nutze Chrome/Edge oder Safari ab iPadOS 26, oder Ollama.'} Beim ersten Mal wird
                  das Modell einmalig heruntergeladen (1–2 GB, am besten im WLAN) und danach im Browser gespeichert. Alles läuft auf deinem Gerät, nichts verlässt es.
                </p>
              </>
            ) : (
              <>
                <div className="form-grid">
                  <label>
                    Server-Adresse
                    <input value={settings.ai.ollamaUrl} onChange={(e) => saveSettings({ ai: { ...settings.ai, ollamaUrl: e.target.value } })} />
                  </label>
                  <label>
                    Modell
                    <input value={settings.ai.ollamaModel} onChange={(e) => saveSettings({ ai: { ...settings.ai, ollamaModel: e.target.value } })} />
                  </label>
                </div>
                <details className="help">
                  <summary>So richtest du Ollama ein</summary>
                  <ol>
                    <li>
                      Ollama installieren: <code>ollama.com</code>
                    </li>
                    <li>
                      Modell laden: <code>ollama pull qwen2.5:7b</code>
                    </li>
                    <li>
                      Zugriff aus dem Browser erlauben: <code>OLLAMA_ORIGINS="*" ollama serve</code>
                    </li>
                  </ol>
                  <p className="small muted">
                    Hinweis: Die App läuft über HTTPS. Browser erlauben den Zugriff auf <code>http://localhost</code> nur auf demselben Gerät. Auf Handy/Tablet nutze daher
                    besser die Browser-KI.
                  </p>
                </details>
              </>
            )}
            <div className="btn-row">
              <button className="btn btn-primary" disabled={!notes.trim() || busy} onClick={runLocal}>
                ✨ Mit lokaler KI strukturieren
              </button>
              {busy && (
                <button className="btn btn-ghost" onClick={() => (cancel.current.cancelled = true)}>
                  Abbrechen
                </button>
              )}
            </div>
            {progress && busy && (
              <div className="ai-progress">
                <div className="progress">
                  <div className="progress-fill" style={{ width: `${Math.round((progress.progress ?? 0) * 100)}%` }} />
                </div>
                <span className="small muted">{progress.text}</span>
              </div>
            )}
          </div>
        )}

        {tab === 'claude' && (
          <div className="ai-box">
            <ol className="steps">
              <li>
                Notizen oben einfügen und <button className="btn btn-small" onClick={copyPrompt}>📋 Prompt kopieren</button>
              </li>
              <li>
                In <a href="https://claude.ai/new" target="_blank" rel="noreferrer">claude.ai</a> einfügen und absenden
              </li>
              <li>Die JSON-Antwort von Claude kopieren und hier einfügen:</li>
            </ol>
            <textarea rows={6} value={claudeAnswer} onChange={(e) => setClaudeAnswer(e.target.value)} placeholder='{"entries": [ … ]}' />
            <button className="btn btn-primary" disabled={!claudeAnswer.trim()} onClick={parseClaude}>
              Vorschau erstellen
            </button>
            <p className="small muted">Tipp: Im Gespräch mit Claude kannst du auch Fotos deiner Kursunterlagen hochladen und um dasselbe Format bitten.</p>
          </div>
        )}

        {tab === 'simple' && (
          <div className="ai-box">
            <p className="small muted">
              Trennzeichen: Bindestrich, =, Doppelpunkt, Semikolon oder Tabulator. Optional dritte Spalte: <code>m</code>, <code>f</code>, <code>v</code>, <code>adj</code> …
              Eselsbrücken kannst du danach im Editor ergänzen oder die Liste über die KI laufen lassen.
            </p>
            <button className="btn btn-primary" disabled={!notes.trim()} onClick={parseSimple}>
              Vorschau erstellen
            </button>
          </div>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {done && <div className="alert alert-ok">{done}</div>}

      {drafts.length > 0 && (
        <div className="panel">
          <div className="page-head">
            <h2>
              Vorschau: {drafts.filter((d) => d.selected).length} von {drafts.length} ausgewählt
            </h2>
            <button className="btn btn-primary" onClick={doImport} disabled={!drafts.some((d) => d.selected)}>
              Importieren
            </button>
          </div>
          <div className="draft-list">
            {drafts.map((d, i) => (
              <div key={i} className={`draft ${d.selected ? '' : 'off'}`}>
                <input type="checkbox" checked={d.selected} onChange={(e) => setDrafts(drafts.map((x, j) => (j === i ? { ...x, selected: e.target.checked } : x)))} aria-label="Auswählen" />
                <input className="draft-emoji" value={d.entry.emoji ?? ''} onChange={(e) => updateDraft(i, { emoji: e.target.value })} aria-label="Emoji" />
                <div className="draft-fields">
                  <div className="draft-line">
                    <input value={d.entry.it} onChange={(e) => updateDraft(i, { it: e.target.value })} lang="it" aria-label="Italienisch" />
                    <input value={d.entry.de} onChange={(e) => updateDraft(i, { de: e.target.value })} aria-label="Deutsch" />
                    <input value={d.entry.topic} onChange={(e) => updateDraft(i, { topic: e.target.value })} list="import-topics" aria-label="Thema" />
                  </div>
                  <textarea
                    rows={1}
                    value={d.entry.mnemonic ?? ''}
                    placeholder="Eselsbrücke …"
                    onChange={(e) => updateDraft(i, { mnemonic: e.target.value || undefined })}
                    aria-label="Eselsbrücke"
                  />
                  <div className="small muted">
                    {d.entry.kind === 'phrase' ? 'Satz' : d.entry.pos ? POS_LABEL[d.entry.pos] : 'Vokabel'}
                    {d.entry.gender ? ` · ${d.entry.gender}` : ''}
                    {d.entry.exampleIt ? ` · ${d.entry.exampleIt.replace(/\*/g, '')}` : ''}
                    {d.duplicate && <span className="chip chip-warn">schon vorhanden</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
