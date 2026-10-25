# Parliamo! 🇮🇹 – Italienisch-Vokabeltrainer

Web-App (PWA) zum Lernen italienischer Vokabeln und Alltagssätze. Läuft im Browser auf Handy, Tablet und PC, lässt sich wie eine App installieren und funktioniert offline.

## Funktionen

- **Lernrichtung wählbar:** 🇩🇪→🇮🇹, 🇮🇹→🇩🇪 oder gemischt
- **Wiederholungsplan wie Anki (SM-2):** Nach jeder Karte bewertest du sie mit *Nochmal / Schwer / Gut / Leicht*. Die Buttons zeigen, wann die Karte wiederkommt. Die App schlägt eine Bewertung vor, die eingetippte Antwort und genutzte Hilfen fließen ein.
- **Übungsarten:** Karteikarte, Eintippen (toleriert Tippfehler und fehlende Akzente, prüft den Artikel), Multiple Choice, Lückentext, Satzbau, Hören
- **Gestufte Hilfen, die ein Bild im Kopf aufbauen:**
  1. 🔤 Form (Anfangsbuchstabe, Länge, Artikel, Geschlecht)
  2. 🖼️ Bild & Eselsbrücke (Emoji und bildhafte Merkhilfe)
  3. 🔗 Verwandte Wörter (Englisch, Latein, Französisch …)
  4. 💬 Beispielsatz mit Lücke
- **Freies Training** (verändert den Wiederholungsplan nicht): Artikel-Trainer (il/lo/la/l’), Konjugation im Präsens, Satzbau, Hörverstehen, Quiz
- **Dashboard:** Tagesziel, Lernserie 🔥, Level und XP, Lernstand je Thema, Aktivitätskalender, Vorschau auf fällige Karten, „Knacknüsse“, 16 Abzeichen
- **Startdaten:** 1097 wichtige Vokabeln mit Schwerpunkt Alltag und Umgangssprache, jede mit Emoji, Eselsbrücke und Beispielsatz, dazu 173 Alltagssätze (Restaurant, Bar, Einkaufen, unterwegs, Hotel, Smalltalk, Notfall, Umgangssprache)
- **Eigene Vokabeln importieren:** unstrukturierte Notizen per KI in Lernkarten verwandeln (siehe unten), mit Vorschau und Erkennung von Doppelten
- **Aussprache** über die italienische Sprachausgabe des Geräts
- **Sicherung als Datei** zum Übertragen zwischen Geräten (Zusammenführen nach dem Prinzip „neuester Stand gewinnt“)

## KI-Import

| Weg | Wann |
|---|---|
| **Lokale KI im Browser** (WebLLM, WebGPU) | Läuft komplett auf dem Gerät. Beim ersten Mal lädt sie ein Modell mit 1–2 GB, danach geht es offline. Braucht einen Browser mit WebGPU (aktueller Chrome/Edge, Safari ab iPadOS/iOS 26). |
| **Ollama / LM Studio** | Lokaler KI-Server am PC (`OLLAMA_ORIGINS="*" ollama serve`), nur auf demselben Gerät erreichbar |
| **Über Claude** | Die App erzeugt einen fertigen Prompt. Du fügst ihn bei claude.ai ein und die JSON-Antwort zurück in die App. Liefert die beste Qualität für Eselsbrücken. |
| **Einfache Liste** | Ohne KI: `la finestra - das Fenster`, eine Zeile pro Eintrag |

Alle Wege nutzen dasselbe JSON-Format (`src/ai/prompt.ts`).

## Entwicklung

```bash
npm install
npm run dev        # Entwicklungsserver
npm test           # Tests (Algorithmus, Antwortprüfung, Konjugation, Startdaten …)
npm run build      # Produktionsbuild nach dist/
```

Technik: React, TypeScript, Vite, Dexie (IndexedDB), vite-plugin-pwa, WebLLM (wird nur bei Bedarf geladen).

## Veröffentlichen auf GitHub Pages

1. Im Repo unter **Settings → Pages → Source** „GitHub Actions“ wählen.
2. Auf `main` pushen bzw. mergen. Der Workflow `.github/workflows/deploy.yml` testet, baut und veröffentlicht die App.
3. Die App liegt dann unter `https://<benutzer>.github.io/app-vokabeln/`. Auf dem Handy oder Tablet: „Zum Home-Bildschirm hinzufügen“.

## Daten & Struktur

- `src/data/seed/*.txt`: Startdaten, eine Zeile pro Eintrag:
  `italienisch | deutsch | grammatik | emoji | eselsbrücke | verwandt | beispiel_it | beispiel_de`
  (Grammatik: `m`, `f`, `mf`, `v`, `adj`, … mit Zusätzen wie `pl`, `isc`, `conj=…`, `ugs`. Im Beispielsatz steht das Zielwort in `*Sternchen*`.)
- `src/lib/srs.ts`: Wiederholungsalgorithmus
- `src/lib/check.ts`: Antwortprüfung
- `src/lib/session.ts`: Zusammenstellung der Lernsitzung
- `src/ai/`: Import (Prompt, Schema, lokale KI)

### Vorbereitung für einen Geräte-Abgleich

Alle Daten liegen lokal in IndexedDB. Für einen späteren automatischen Abgleich (z. B. über Supabase) ist schon einiges vorbereitet:
Jeder Eintrag und jeder Lernstand hat eine stabile ID und einen `updatedAt`-Zeitstempel. Gelöschte Einträge werden nur markiert (`deleted`), Lernprotokolle sind reine Ergänzungslisten mit eindeutigen IDs, und jedes Gerät hat eine eigene `deviceId`. Das Zusammenführen nach „neuester Stand gewinnt“ ist in `importBackup` schon umgesetzt.
