const FORMAT = `{
  "entries": [
    {
      "it": "la finestra",
      "de": "das Fenster",
      "type": "word",
      "pos": "noun",
      "gender": "f",
      "topic": "Haus & Alltag",
      "emoji": "🪟",
      "mnemonic": "Hinter dem FENSTER ist es FINSTER – fiNESTRA klingt nach finster.",
      "related": "lat. fenestra · frz. fenêtre",
      "example_it": "Apri la *finestra*, per favore.",
      "example_de": "Mach bitte das Fenster auf.",
      "colloquial": false
    },
    {
      "it": "Vorrei un tavolo per due, per favore.",
      "de": "Ich hätte gern einen Tisch für zwei, bitte.",
      "type": "phrase",
      "topic": "Sätze: Restaurant",
      "emoji": "🍽️",
      "mnemonic": "VORREI = ich VOR-REIhe mich in die Schlange ein und hätte gern …"
    }
  ]
}`;

const RULES = `Regeln:
- "it": italienisch. Nomen IMMER mit bestimmtem Artikel (il, lo, la, l', i, gli, le). Adjektive als "bello/bella". Verben im Infinitiv.
- "de": deutsche Übersetzung, Nomen mit Artikel (der/die/das). Mehrere Bedeutungen mit ";" trennen.
- "type": "word" für Vokabeln und kurze Ausdrücke, "phrase" für ganze Sätze.
- "pos": noun, verb, adj, adv, pron, prep, conj, num, interj, expr oder phrase.
- "gender": nur bei Nomen: "m", "f" oder "mf".
- "topic": kurzes deutsches Thema. Bevorzugt eines von: {TOPICS}. Neue Themen sind erlaubt.
- "emoji": genau ein passendes Emoji als Bild.
- "mnemonic": kurze, bildhafte deutsche Eselsbrücke (Klangähnlichkeit + lebendiges Bild, max. 25 Wörter). Wichtiges Wort GROSS.
- "related": verwandte Wörter (Englisch, Latein, Französisch, deutsche Fremdwörter), sonst weglassen.
- "example_it": kurzer alltagsnaher Beispielsatz, das Zielwort mit *Sternchen* markiert. "example_de": Übersetzung.
- "colloquial": true, wenn umgangssprachlich.
- Unregelmäßige Verben zusätzlich "conj": ["io …","tu …","lui …","noi …","voi …","loro …"] im Präsens, ohne Pronomen.
- Korrigiere offensichtliche Tippfehler in meinen Notizen. Doppelte Einträge nur einmal.
- Antworte NUR mit JSON, ohne Erklärtext.`;

export const DEFAULT_TOPIC_HINT = [
  'Grundlagen & Begrüßung',
  'Menschen & Familie',
  'Essen & Trinken',
  'Reisen & Verkehr',
  'Haus & Alltag',
  'Arbeit & Lernen',
  'Freizeit & Kultur',
  'Verben',
  'Eigenschaften',
  'Umgangssprache',
  'Sätze: Restaurant',
  'Sätze: Smalltalk',
];

/** Prompt zum Kopieren in Claude (claude.ai) */
export function claudePrompt(notes: string, topics: string[]): string {
  return `Ich lerne Italienisch (Ziel: Alltag und Umgangssprache) und nutze eine Vokabel-App.
Bitte wandle meine unstrukturierten Notizen aus dem Sprachkurs in strukturierte Lernkarten um.

Ausgabeformat (JSON):
${FORMAT}

${RULES.replace('{TOPICS}', topics.join(', '))}

Meine Notizen:
"""
${notes.trim() || '(hier deine Notizen einfügen)'}
"""`;
}

/** Kürzerer System-Prompt für kleine lokale Modelle */
export function localSystemPrompt(topics: string[]): string {
  return `Du bist ein Italienischlehrer für deutschsprachige Lernende. Du wandelst Notizen in Lernkarten um.
Antworte ausschließlich mit JSON in diesem Format:
${FORMAT}
${RULES.replace('{TOPICS}', topics.join(', '))}`;
}
