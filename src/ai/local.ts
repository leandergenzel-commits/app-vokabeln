import type { MLCEngineInterface } from '@mlc-ai/web-llm';
import type { AiSettings, Entry } from '../lib/types';
import { localSystemPrompt } from './prompt';
import { extractJson, itemToEntry, itemsFromJson } from './schema';

export const WEBLLM_MODELS = [
  { id: 'Qwen2.5-3B-Instruct-q4f16_1-MLC', label: 'Qwen 2.5 · 3B (empfohlen, ca. 2 GB)' },
  { id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC', label: 'Llama 3.2 · 3B (ca. 2 GB)' },
  { id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', label: 'Qwen 2.5 · 1.5B (schnell, ca. 1 GB, einfacher)' },
  { id: 'gemma-2-2b-it-q4f16_1-MLC', label: 'Gemma 2 · 2B (ca. 1.5 GB)' },
];

export type Progress = (info: { text: string; progress?: number }) => void;

type ChatFn = (system: string, user: string) => Promise<string>;

let webllmEngine: { model: string; engine: MLCEngineInterface } | null = null;

export function hasWebGPU(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator;
}

async function webllmChat(model: string, onProgress: Progress): Promise<ChatFn> {
  if (!hasWebGPU()) {
    throw new Error('Dieser Browser unterstützt kein WebGPU. Nutze einen aktuellen Chrome/Edge oder Safari (iPadOS 26+), oder Ollama.');
  }
  if (!webllmEngine || webllmEngine.model !== model) {
    onProgress({ text: 'Lade KI-Modul …' });
    const webllm = await import('@mlc-ai/web-llm');
    const engine = await webllm.CreateMLCEngine(model, {
      initProgressCallback: (r) => onProgress({ text: r.text, progress: r.progress }),
    });
    webllmEngine = { model, engine };
  }
  const engine = webllmEngine.engine;
  return async (system, user) => {
    const res = await engine.chat.completions.create({
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });
    return res.choices[0]?.message?.content ?? '';
  };
}

function ollamaChat(url: string, model: string): ChatFn {
  return async (system, user) => {
    let res: Response;
    try {
      res = await fetch(`${url.replace(/\/$/, '')}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          stream: false,
          format: 'json',
          options: { temperature: 0.3 },
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
      });
    } catch {
      throw new Error(
        `Ollama unter ${url} nicht erreichbar. Läuft Ollama, und ist OLLAMA_ORIGINS="*" gesetzt? (Siehe Hilfe auf dieser Seite.)`,
      );
    }
    if (!res.ok) throw new Error(`Ollama antwortet mit Fehler ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data.message?.content ?? '';
  };
}

/** Teilt lange Notizen in Häppchen, damit auch kleine Modelle zuverlässig antworten */
export function chunkNotes(text: string, linesPerChunk = 10): string[] {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  for (let i = 0; i < lines.length; i += linesPerChunk) chunks.push(lines.slice(i, i + linesPerChunk).join('\n'));
  return chunks;
}

export async function structureWithLocalAi(
  notes: string,
  ai: AiSettings,
  topics: string[],
  fallbackTopic: string,
  onProgress: Progress,
  signal?: { cancelled: boolean },
): Promise<{ entries: Entry[]; errors: string[] }> {
  const chat = ai.engine === 'webllm' ? await webllmChat(ai.webllmModel, onProgress) : ollamaChat(ai.ollamaUrl, ai.ollamaModel);
  const system = localSystemPrompt(topics);
  const chunks = chunkNotes(notes);
  const entries: Entry[] = [];
  const errors: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    if (signal?.cancelled) break;
    onProgress({ text: `KI strukturiert Abschnitt ${i + 1} von ${chunks.length} …`, progress: i / chunks.length });
    try {
      const answer = await chat(system, `Notizen:\n${chunks[i]}`);
      const items = itemsFromJson(extractJson(answer));
      entries.push(...items.map((it) => itemToEntry(it, fallbackTopic)));
    } catch (e) {
      errors.push(`Abschnitt ${i + 1}: ${(e as Error).message}`);
    }
  }
  onProgress({ text: 'Fertig', progress: 1 });
  return { entries, errors };
}
