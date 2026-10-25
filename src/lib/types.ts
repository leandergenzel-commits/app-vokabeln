export type Direction = 'de-it' | 'it-de';
export type DirectionSetting = Direction | 'mix';

export type EntryKind = 'word' | 'phrase';
export type Gender = 'm' | 'f' | 'mf';
export type Pos =
  | 'noun'
  | 'verb'
  | 'adj'
  | 'adv'
  | 'pron'
  | 'prep'
  | 'conj'
  | 'num'
  | 'interj'
  | 'expr'
  | 'phrase';

/** Ein Lerneintrag (Vokabel oder Satz). Felder für späteren Geräte-Abgleich: id, updatedAt, deleted. */
export interface Entry {
  id: string;
  it: string;
  de: string;
  kind: EntryKind;
  pos?: Pos;
  gender?: Gender;
  /** Nur Plural, z. B. "gli occhiali" */
  pluralOnly?: boolean;
  /** Unregelmäßiger Plural, z. B. "le uova" */
  plural?: string;
  topic: string;
  emoji?: string;
  /** Eselsbrücke / Bild */
  mnemonic?: string;
  /** Verwandte Wörter (Englisch, Latein, Deutsch …) */
  related?: string;
  /** Beispielsatz; das Zielwort ist mit *Sternchen* markiert */
  exampleIt?: string;
  exampleDe?: string;
  notes?: string;
  colloquial?: boolean;
  /** Verben: Präsens io…loro (nur nötig, wenn unregelmäßig) */
  conj?: string[];
  /** Verben mit -isc- (finire → finisco) */
  isc?: boolean;
  /** Häufigkeitsrang innerhalb der Startdaten (kleiner = wichtiger) */
  rank?: number;
  source: 'seed' | 'user' | 'import';
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
}

export type CardPhase = 'new' | 'learning' | 'review' | 'relearning';

export interface CardState {
  /** `${entryId}|${direction}` */
  id: string;
  entryId: string;
  direction: Direction;
  phase: CardPhase;
  /** Zeitpunkt der nächsten Fälligkeit (ms) */
  due: number;
  /** Intervall in Tagen (für review) */
  interval: number;
  ease: number;
  step: number;
  reps: number;
  lapses: number;
  lastReview?: number;
  updatedAt: number;
}

/** 1 = Nochmal, 2 = Schwer, 3 = Gut, 4 = Leicht (wie Anki) */
export type Rating = 1 | 2 | 3 | 4;

export type ExerciseType =
  | 'flip'
  | 'type'
  | 'choice'
  | 'cloze'
  | 'order'
  | 'listen'
  | 'article'
  | 'conjugate';

export interface ReviewLog {
  id: string;
  cardId: string;
  entryId: string;
  direction: Direction;
  rating: Rating;
  exercise: ExerciseType;
  hints: number;
  /** false bei freiem Training (ändert den Wiederholungsplan nicht) */
  srs: boolean;
  xp: number;
  ts: number;
  /** Lokales Datum YYYY-MM-DD */
  day: string;
  /** Phase der Karte vor der Bewertung */
  prevPhase: CardPhase;
}

export interface Settings {
  direction: DirectionSetting;
  newPerDay: number;
  maxReviewsPerDay: number;
  dailyGoal: number;
  topics: string[];
  exercises: ExerciseType[];
  /** Antwort beim Eintippen: Akzente müssen stimmen */
  strictAccents: boolean;
  autoSpeak: boolean;
  speechRate: number;
  ai: AiSettings;
  theme: 'auto' | 'light' | 'dark';
}

export interface AiSettings {
  engine: 'webllm' | 'ollama';
  webllmModel: string;
  ollamaUrl: string;
  ollamaModel: string;
}

export interface Meta {
  key: string;
  value: unknown;
}
