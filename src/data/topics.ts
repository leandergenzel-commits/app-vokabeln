/** Bekannte Themen mit Symbol. Eigene Themen aus dem Import bekommen 📚. */
export const TOPIC_EMOJI: Record<string, string> = {
  'Grundlagen & Begrüßung': '👋',
  'Menschen & Familie': '👨‍👩‍👧',
  'Zahlen & Mengen': '🔢',
  'Zeit & Kalender': '🕐',
  'Essen & Trinken': '🍝',
  'Restaurant & Bar': '☕',
  'Einkaufen & Geld': '🛍️',
  'Reisen & Verkehr': '🚆',
  'Unterkunft': '🏨',
  'Stadt & Orte': '🏛️',
  'Haus & Alltag': '🏠',
  'Körper & Gesundheit': '🩺',
  'Kleidung & Farben': '👗',
  'Natur & Wetter': '☀️',
  'Arbeit & Lernen': '💼',
  'Freizeit & Kultur': '⚽',
  'Gefühle & Charakter': '❤️',
  'Verben': '🏃',
  'Eigenschaften': '✨',
  'Kleine Wörter': '🧩',
  'Fragen': '❓',
  'Umgangssprache': '🤌',
  'Sätze: Restaurant': '🍽️',
  'Sätze: Bar & Café': '☕',
  'Sätze: Einkaufen': '🛒',
  'Sätze: Unterwegs': '🧭',
  'Sätze: Hotel': '🛎️',
  'Sätze: Smalltalk': '💬',
  'Sätze: Notfall & Gesundheit': '🚑',
  'Sätze: Umgangssprache': '😎',
};

export function topicEmoji(topic: string): string {
  return TOPIC_EMOJI[topic] ?? '📚';
}
