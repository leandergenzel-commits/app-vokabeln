import { stripMarks } from './util';

let voice: SpeechSynthesisVoice | null | undefined;

function italianVoice(): SpeechSynthesisVoice | null {
  if (voice !== undefined && voice !== null) return voice;
  const voices = window.speechSynthesis?.getVoices() ?? [];
  voice = voices.find((v) => v.lang === 'it-IT' && /premium|enhanced|natural/i.test(v.name)) ?? voices.find((v) => v.lang.startsWith('it')) ?? null;
  return voice;
}

export function canSpeak(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function speak(text: string, rate = 0.9): void {
  if (!canSpeak()) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(stripMarks(text).replace(/\//g, ', '));
  u.lang = 'it-IT';
  u.rate = rate;
  const v = italianVoice();
  if (v) u.voice = v;
  window.speechSynthesis.speak(u);
}

if (canSpeak()) {
  window.speechSynthesis.onvoiceschanged = () => {
    voice = undefined;
  };
}
