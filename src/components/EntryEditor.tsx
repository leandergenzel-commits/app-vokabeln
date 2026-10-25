import { useEffect, useState } from 'react';
import { PERSONS, presentTense } from '../lib/conjugate';
import { deleteEntry, resetProgress, saveEntry } from '../lib/db';
import type { Entry, Gender, Pos } from '../lib/types';
import { speak } from '../lib/tts';
import { uid } from '../lib/util';

export const POS_LABEL: Record<Pos, string> = {
  noun: 'Nomen',
  verb: 'Verb',
  adj: 'Adjektiv',
  adv: 'Adverb',
  pron: 'Pronomen',
  prep: 'Präposition',
  conj: 'Konjunktion',
  num: 'Zahlwort',
  interj: 'Ausruf',
  expr: 'Ausdruck',
  phrase: 'Satz',
};

export function blankEntry(topic = 'Mein Kurs'): Entry {
  const now = Date.now();
  return { id: 'user:' + uid(), it: '', de: '', kind: 'word', topic, source: 'user', createdAt: now, updatedAt: now };
}

export function EntryEditor({ entry, topics, onClose, isNew }: { entry: Entry; topics: string[]; onClose: () => void; isNew?: boolean }) {
  const [e, setE] = useState<Entry>(entry);
  const [conj, setConj] = useState<string[]>(() => entry.conj ?? presentTense(entry) ?? ['', '', '', '', '', '']);
  const set = <K extends keyof Entry>(k: K, v: Entry[K]) => setE((x) => ({ ...x, [k]: v }));
  const valid = e.it.trim() && e.de.trim() && e.topic.trim();

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => ev.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const save = async () => {
    const out: Entry = { ...e, it: e.it.trim(), de: e.de.trim(), topic: e.topic.trim() };
    if (out.pos === 'verb') {
      const regular = presentTense({ it: out.it, isc: out.isc });
      const filled = conj.every((c) => c.trim());
      out.conj = filled && JSON.stringify(conj) !== JSON.stringify(regular) ? conj.map((c) => c.trim()) : undefined;
    }
    if (out.pos !== 'noun') delete out.gender;
    if (out.kind === 'phrase') out.pos = 'phrase';
    await saveEntry(out);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(ev) => ev.stopPropagation()} role="dialog" aria-label="Eintrag bearbeiten">
        <div className="modal-head">
          <h2>{isNew ? 'Neuer Eintrag' : 'Eintrag bearbeiten'}</h2>
          <button className="btn btn-ghost" onClick={onClose} aria-label="Schließen">
            ✕
          </button>
        </div>
        <div className="form-grid">
          <label>
            Italienisch
            <div className="input-with-btn">
              <input value={e.it} onChange={(x) => set('it', x.target.value)} lang="it" placeholder="la finestra" />
              <button type="button" className="btn btn-ghost" onClick={() => speak(e.it)} aria-label="Vorlesen">
                🔊
              </button>
            </div>
          </label>
          <label>
            Deutsch
            <input value={e.de} onChange={(x) => set('de', x.target.value)} placeholder="das Fenster" />
          </label>
          <label>
            Art
            <select value={e.kind} onChange={(x) => set('kind', x.target.value as Entry['kind'])}>
              <option value="word">Vokabel</option>
              <option value="phrase">Satz</option>
            </select>
          </label>
          {e.kind === 'word' && (
            <label>
              Wortart
              <select value={e.pos ?? ''} onChange={(x) => set('pos', (x.target.value || undefined) as Pos | undefined)}>
                <option value="">–</option>
                {Object.entries(POS_LABEL)
                  .filter(([k]) => k !== 'phrase')
                  .map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
              </select>
            </label>
          )}
          {e.pos === 'noun' && (
            <label>
              Geschlecht
              <select value={e.gender ?? ''} onChange={(x) => set('gender', (x.target.value || undefined) as Gender | undefined)}>
                <option value="">–</option>
                <option value="m">maskulin</option>
                <option value="f">feminin</option>
                <option value="mf">beides</option>
              </select>
            </label>
          )}
          <label>
            Thema
            <input value={e.topic} onChange={(x) => set('topic', x.target.value)} list="topic-list" />
            <datalist id="topic-list">
              {topics.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </label>
          <label>
            Emoji (Bild)
            <input value={e.emoji ?? ''} onChange={(x) => set('emoji', x.target.value || undefined)} placeholder="🪟" />
          </label>
          <label className="span-2">
            Eselsbrücke
            <textarea rows={2} value={e.mnemonic ?? ''} onChange={(x) => set('mnemonic', x.target.value || undefined)} placeholder="Hinter dem FENSTER ist es FINSTER …" />
          </label>
          <label className="span-2">
            Verwandte Wörter
            <input value={e.related ?? ''} onChange={(x) => set('related', x.target.value || undefined)} placeholder="engl. … · lat. …" />
          </label>
          <label className="span-2">
            Beispielsatz (Zielwort mit *Sternchen* markieren)
            <input value={e.exampleIt ?? ''} onChange={(x) => set('exampleIt', x.target.value || undefined)} lang="it" placeholder="Apri la *finestra*, per favore." />
          </label>
          <label className="span-2">
            Beispiel auf Deutsch
            <input value={e.exampleDe ?? ''} onChange={(x) => set('exampleDe', x.target.value || undefined)} />
          </label>
          <label className="span-2">
            Notiz
            <input value={e.notes ?? ''} onChange={(x) => set('notes', x.target.value || undefined)} />
          </label>
          <label className="check">
            <input type="checkbox" checked={!!e.colloquial} onChange={(x) => set('colloquial', x.target.checked || undefined)} /> umgangssprachlich
          </label>
          {e.pos === 'verb' && (
            <>
              <label className="check">
                <input type="checkbox" checked={!!e.isc} onChange={(x) => set('isc', x.target.checked || undefined)} /> -isc-Verb (finisco)
              </label>
              <div className="span-2 conj-edit">
                <span className="small muted">Präsens (wird bei regelmäßigen Verben automatisch gebildet)</span>
                <div className="conj-grid">
                  {PERSONS.map((p, i) => (
                    <label key={p}>
                      {p}
                      <input
                        value={conj[i] ?? ''}
                        onChange={(x) => setConj(conj.map((c, j) => (j === i ? x.target.value : c)))}
                        lang="it"
                      />
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
        <div className="modal-foot">
          {!isNew && (
            <>
              <button
                className="btn btn-danger"
                onClick={async () => {
                  if (confirm('Eintrag wirklich löschen?')) {
                    await deleteEntry(e.id);
                    onClose();
                  }
                }}
              >
                Löschen
              </button>
              <button
                className="btn btn-ghost"
                onClick={async () => {
                  if (confirm('Lernstand dieses Eintrags zurücksetzen?')) {
                    await resetProgress(e.id);
                    onClose();
                  }
                }}
              >
                Lernstand zurücksetzen
              </button>
            </>
          )}
          <span className="spacer" />
          <button className="btn" onClick={onClose}>
            Abbrechen
          </button>
          <button className="btn btn-primary" disabled={!valid} onClick={save}>
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
}
