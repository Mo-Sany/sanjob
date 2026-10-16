# Sanjob

**Collect job listings from job boards into one Excel table.**
Chrome extension (Manifest V3) for StepStone, Indeed, LinkedIn and XING, with a generic mode for
other sites.

[English](#english) · [Deutsch](#deutsch)

> **Terms of Service:** LinkedIn, Indeed, StepStone and XING restrict automated access and
> scraping in their Terms of Service. **You are responsible for following each site's terms.**
> Use Sanjob only for your own, personal job search, at a modest pace, and only where it is
> allowed. Sanjob never bypasses CAPTCHAs, login walls or blocks: when it meets one, it stops and
> waits for you.

---

## English

### What it does

1. Open a job search results page. The side panel reads it right away and shows a summary
   ("XING detected · 20 jobs on this page · about 360 jobs in total · 18 pages · ~30 min",
   plus how many of them you already collected). Click **Start collecting**, **Only this page**
   or **Choose list manually**.
2. Sanjob opens a separate (minimized) window and goes through the result pages (next-page link
   or `page`/`start` URL parameter) until the last page or your page limit, collecting every job
   link.
3. It opens each job, one at a time with a random 3–6 s pause, and reads Title, Company,
   Location, Date posted, Salary, Contract type, URL and the full Description. Structured data
   (schema.org `JobPosting` JSON-LD) is preferred; CSS selectors are the fallback.
4. You see live progress (progress bar, current job, collected / skipped counts, time left, also
   on the toolbar badge, e.g. `45/360`) and a table you can sort, search and delete rows from.
   You can switch tabs or close the side panel – the run continues. A notification tells you
   when it is finished ("Fertig! 312 Jobs gesammelt").
5. **Export .xlsx** writes one sheet with all jobs as an Excel Table: header row, frozen header,
   auto column widths, wrapped text with a capped row height, clickable URLs.

Jobs you collected before (same normalized URL) are skipped automatically, also across runs.
**Settings → Clear history** forgets them.

### Download (ready to install)

Every change on `main` is built automatically. Get the ready-to-install zip from
**[Releases → latest](https://github.com/Mo-Sany/sanjob/releases/latest)** (`sanjob-<version>.zip`),
unzip it into a folder (not inside OneDrive), then follow steps 1–4 below and choose that folder.
"Code → Download ZIP" on GitHub is the source code – it has to be built first (see below).

### Install (Load unpacked)

Requirements: Node.js 20+ and Chrome 116+.

```bash
npm install
npm run build
```

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and choose the `dist` folder.
4. Pin Sanjob and click its icon – the side panel opens.

### Publish to the Chrome Web Store

`npm run zip` builds `sanjob-<version>.zip` for the upload. Store texts (EN/DE), permission
justifications, privacy answers and graphics are in [`store/`](store/LISTING.md); the privacy
policy is [`PRIVACY.md`](PRIVACY.md). Increase `version` in `package.json` for every update.

### Usage

- **Start / Pause / Continue / Stop** – the whole run is driven by the background service worker.
  Job pages load in an inactive tab of a separate window, never in your own tabs, so switching
  tabs does not pause anything. Closing that window pauses the run.
- **Resume after a restart** – queue and results are stored in IndexedDB. If the browser was
  closed during a run, the side panel shows _Interrupted_ with a **Resume** button and continues
  where it stopped.
- **CAPTCHA / login / block page** – Sanjob stops, brings the window to the front and shows a
  notice. Solve it yourself in that window, then click **Resume**.
- **Window mode** (Settings) – _Minimized_ (default) or _Small normal window_. Some sites do not
  render in minimized windows; if several job pages come back empty, Sanjob suggests switching.
- **Delay** (Settings) – random pause between page loads, default 3–6 s. Only one page loads at
  a time.
- **Append to previous results** (next to Export) – on: export all stored jobs; off: export only
  the latest collection.
- **Generic mode** – on any other site, Sanjob asks for permission to read that one site, then
  **auto-detects** the repeating job cards.
- **Two modes** – _Page by page_ goes through the numbered result pages. _Continuous_ reads all
  jobs on the current page and keeps watching it: when you scroll down (infinite scroll, "load
  more") and new jobs appear, they are added. Click **Finish** when you are done.
- **Title filter** – skips jobs whose title contains an excluded word at the start of a word
  (any case). Ready-made filters: _Pupils & holiday jobs_ (Schüler, Schul, Ferial – default) and
  _Praxissemester_ (Dual, Studiengang, Quereinsteiger, Senior, Schüler, Controlling, Ausbildung),
  or your own words, or off. "Schul" skips "Schulbegleiter" but not "Hochschulabsolvent".
  Filtered jobs are never opened and are counted as "Filtered out".
- **Hover preview** – before you start, moving the mouse over the job list on Indeed, XING,
  LinkedIn or StepStone outlines the whole list in green with "List with 25 jobs · about 360 in
  total" (other sites: largest repeating list).
- **Live view** (Settings, on by default) – while collecting, the results tab where you clicked
  Start shows the progress on the job cards themselves: a dashed green outline once a job's link
  is collected, a pulsing border with "Collecting…" while its page is read, a green ✓ when it is
  saved, gray "Already saved" for duplicates and amber "Skipped" for unreadable jobs. The page
  scrolls along smoothly (it pauses for 5 s when you scroll yourself), a chip at the bottom right
  shows "✓ 23 / 360 · ~25 min left" (click it to open the side panel), and the tab follows the run
  to the next results page unless you navigated it elsewhere. The marks are overlays: they never
  shift the layout or block clicks. ✓ marks stay until you reload or click **Clear marks**.
- **Choose list manually** – move the mouse over the page: the job list under the cursor is
  outlined in green (each item dashed) with a label such as "List with 20 items found – click to
  select". Click to select it, Esc to cancel. The largest meaningful list wins over small inner
  lists; "Smart detection" means Sanjob is confident.
- **CV fit (local)** – upload your CV once in Settings (PDF, Word .docx or text – read inside the
  browser) or paste it. Every job then gets a **fit score 0–100** with a label (very good / good /
  partial / low fit), the table is sorted by fit, and "Best matches for your CV" lists the top 5.
  Open a row to see the **keywords of the job**, which of them are **in your CV** and which are
  **missing**. Keywords come from a skills dictionary
  ([`src/match/skills.ts`](src/match/skills.ts) – add your own) plus words typical for the ad.
  Profile requirements count most; must-haves ("zwingend", "erforderlich", "required", marked ❗)
  count 1.5×, nice-to-haves ("wünschenswert", "von Vorteil", "a plus", marked _optional_) only
  0.4×. An English CV also matches a German ad (and vice versa) through a small glossary
  ([`src/match/glossary.ts`](src/match/glossary.ts)). Nothing leaves the browser.
- **Filters and application tracking** – show only jobs from 40/60/80 % fit, set a status per
  job (interested / applied / interview / offer / rejected), filter by status and keep notes
  (contact, deadline …). Status and notes are kept when the same job is collected again and are
  exported to Excel.
- **AI evaluation (optional)** – in Settings → AI evaluation, turn on "Rate jobs with Claude",
  allow access to `api.anthropic.com` and enter your own Anthropic API key (stored only on this
  device). **Rate with AI** sends your CV and the selected jobs (or the top 10 by local fit) to
  Claude, one request per job; each job gets an AI score, a short verdict, matched/missing skills
  and keywords, shown with an "AI" badge. Usage is billed to your Anthropic account (Claude Opus
  5.5 by default; Sonnet 5.5 and Haiku 5.5 are cheaper). Stop at any time.
- **Match with my CV (prompt)** – select jobs (or use ✦ on a row) and click **Match with my CV**:
  a ready-made prompt (instructions + CV + job data) is copied to the clipboard for
  [claude.ai](https://claude.ai) – no API key needed.
- **Excel** – the export also has the columns _Status_, _Notes_, _Fit %_, _Fit_, _Keywords_,
  _In my CV_, _Missing in my CV_ and _AI verdict_ (keywords are filled even without a CV).
- **Language** – English or German (Settings).

### Data columns

`Title | Company | Location | Date posted | Salary | Contract type | URL | Description | Ihre Aufgaben | Ihr Profil | Wir bieten | Sonstiges`

(With English UI the last four headers read _Your tasks, Your profile, We offer, Other_.)

- Missing fields stay empty – Sanjob never invents values.
- _Date posted_ is normalized to `YYYY-MM-DD` (also relative dates like "vor 3 Tagen", "Heute",
  "2 days ago"); if it cannot be parsed exactly (e.g. "30+ days ago") the original text is kept.
- _Description_ is the full text of the posting as shown on the page. When sections were found,
  the export shows only the intro there (the text before the first heading), so every part of
  the text appears in exactly one column. If a page has no readable description element, the
  JSON-LD description is used.
- Cells longer than 32,000 characters are cut and end with ` [truncated]`.
- **Sections** (rule-based, no AI): the description is split by its headings into
  _Ihre Aufgaben_, _Ihr Profil_ and _Wir bieten_. A heading is a short line (≤ 60 characters)
  that equals a known phrase, or ends with ":" / "?" (or is an h2/h3/bold line) and contains
  one ("Zu deinen Aufgaben gehören:", "Warum Firma?"). Headings glued to their text
  ("Ihre Aufgaben Je nach …") are split. A section ends at the next heading or at a footer line
  (contact, e-mail, postal code + city, "Ihre Bewerbung", "Noch Fragen?" …); the footer goes to
  _Sonstiges_. Bullet points become `• item` lines. If no known heading exists, the full text
  stays in _Description_ and the four columns stay empty.
  The heading synonyms (German + English) are in
  [`src/sections/sections.config.ts`](src/sections/sections.config.ts) – add your own there.

### Fixing a site preset

Job boards change their HTML from time to time. All site-specific selectors live in **one file:
[`src/presets/presets.ts`](src/presets/presets.ts)**.

1. Open a results page and a job page of the site in Chrome and save them with **Ctrl+S**
   ("Webpage, Complete") into `fixtures/<site>/`.
2. Find the new selectors with DevTools (right-click → Inspect). Prefer stable attributes like
   `data-testid`, `data-at`, `id` or `aria-label` over generated class names (`css-1x2y3z`).
3. Edit the preset:
   - `listing.links` – selectors for job links on the results page
     (`jobUrlPattern` filters them by URL, `idAttr` builds the URL from an id attribute).
   - `listing.next` / `listing.pageParam` – next-page control / URL parameter.
   - `detail.fields.<field>` – a list of rules, tried in order. A rule is a CSS selector string
     or `{ selector, attr?, match?, strip?, leaf?, all? }` (see
     [`src/presets/types.ts`](src/presets/types.ts)).
4. Add or update the test in `tests/presets/<site>.test.ts` and run `npm test`.
5. `npm run build` and click the reload icon of Sanjob in `chrome://extensions`.

### Development

```bash
npm run lint       # eslint + prettier --check
npm test           # vitest (extractors, presets, dedupe, export, …)
npm run typecheck  # tsc
npm run build      # production build into dist/
npm run icons      # re-render PNG icons from public/icons/icon.svg
```

Stack: TypeScript, Vite + CRXJS, Preact, Tailwind CSS, SheetJS, Dexie (IndexedDB),
chrome.storage.local.

Project layout:

| Path                  | Purpose                                                        |
| --------------------- | -------------------------------------------------------------- |
| `src/presets/`        | Site presets (selectors) – edit here when a site changes       |
| `src/extract/`        | JSON-LD, selector engine, listing/detail, generic, block check |
| `src/background/`     | Service worker: run loop, window handling, keep-alive          |
| `src/content/`        | Script injected into pages, element picker                     |
| `src/db/`             | IndexedDB (jobs, queue, history, run state)                    |
| `src/export/`         | XLSX export                                                    |
| `src/match/`          | Local CV matching, skills dictionary, CV file reading          |
| `src/claude/`         | CV match prompt (clipboard) and optional Claude API rating     |
| `src/sidepanel/`      | Side panel UI                                                  |
| `fixtures/`, `tests/` | Saved pages and unit tests                                     |

### Known limitations

- **Live sites are not tested automatically.** Presets are tested against saved pages:
  - **Indeed** – real saved page (home feed with job cards and an opened job). The `/jobs`
    search pagination and the standalone `/viewjob` page are covered by a hand-made fixture /
    known selectors only.
  - **LinkedIn** – real saved page (`/jobs/` home with job cards). The job detail page is tested
    against a hand-made fixture only.
  - **XING** – the saved page is the job-preferences page (no job list); search and detail are
    tested against hand-made fixtures only.
  - **StepStone** – no saved page yet; tested against hand-made fixtures only.

  Hand-made fixtures are named `*.synthetic.html`. Replace them with real saved pages to make
  the tests meaningful.

- LinkedIn and XING show most jobs only when you are logged in. Sanjob uses your normal browser
  session; it never handles credentials.
- In generic mode, job pages on a different domain than the result list need their own
  permission and may fail.
- The npm build of SheetJS (`xlsx@0.18.5`) has advisories for _parsing_ untrusted files. Sanjob
  only _writes_ files, so they do not apply; you can switch to the current SheetJS build from
  `https://cdn.sheetjs.com` in `package.json`.

### Privacy policy

_Applies to the Sanjob browser extension._

- **What is processed:** the content of job pages you choose to collect (job title, company,
  location, date, salary, contract type, URL, description), the URLs of collected jobs (for
  duplicate detection), your settings, and – only if you enter them – your CV/skills text and
  your Anthropic API key.
- **Where it is stored:** only locally in your browser (IndexedDB and `chrome.storage.local`).
  Nothing is sent to the developer or to any server. There is no telemetry, no analytics, no
  tracking and no remote code.
- **Sharing:** none by default. Data leaves your browser only when you export an Excel file,
  copy a prompt to the clipboard yourself, or use the optional AI evaluation.
- **Optional AI evaluation:** off by default. When you turn it on and click "Rate with AI", your
  CV text and the chosen job ads are sent directly to Anthropic (`api.anthropic.com`) with your
  own API key, under Anthropic's terms and privacy policy. Nothing goes to the developer.
- **Permissions:** `storage` (settings), `sidePanel` (UI), `tabs` + `scripting` + `activeTab`
  (open job pages in the collection window and read them), `alarms` (keep the collection running),
  `notifications` (the "finished" message),
  host access to StepStone, Indeed, LinkedIn and XING, and – only after you agree – to other
  single sites in generic mode.
- **Deletion:** delete rows in the table, use **Clear history**, or remove the extension to
  delete all data.
- **Contact:** please open an issue in this repository.

---

## Deutsch

### Was Sanjob macht

1. Öffne eine Ergebnisseite einer Jobsuche. Der Seitenbereich liest sie sofort und zeigt eine
   Zusammenfassung („XING erkannt · 20 Jobs auf dieser Seite · ca. 360 Jobs insgesamt ·
   18 Seiten · ~30 min“, dazu wie viele du schon gesammelt hast). Klicke auf **Sammeln starten**,
   **Nur diese Seite** oder **Liste selbst wählen**.
2. Sanjob öffnet ein eigenes (minimiertes) Fenster und blättert durch die Ergebnisseiten
   („Weiter“-Link oder `page`/`start`-Parameter) bis zur letzten Seite oder deinem Seitenlimit
   und sammelt alle Job-Links.
3. Jede Stelle wird nacheinander geöffnet (zufällige Pause von 3–6 s) und Titel, Unternehmen,
   Ort, Veröffentlichungsdatum, Gehalt, Vertragsart, URL und die vollständige Beschreibung werden
   gelesen. Strukturierte Daten (schema.org `JobPosting`, JSON-LD) haben Vorrang, CSS-Selektoren
   sind der Fallback.
4. Du siehst den Fortschritt live (X von N, aktuelle Stelle, Fehler) und eine Tabelle zum
   Sortieren, Durchsuchen und Löschen von Zeilen.
5. **.xlsx exportieren** erstellt ein Tabellenblatt mit allen Jobs als Excel-Tabelle:
   Kopfzeile (fixiert), automatische Spaltenbreiten, Zeilenumbruch mit begrenzter Zeilenhöhe,
   klickbare URLs.

Bereits gesammelte Jobs (gleiche normalisierte URL) werden automatisch übersprungen – auch über
mehrere Durchläufe hinweg. **Einstellungen → Verlauf löschen** setzt das zurück.

### Download (fertig zum Installieren)

Jede Änderung auf `main` wird automatisch gebaut. Die fertige Zip-Datei gibt es unter
**[Releases → latest](https://github.com/Mo-Sany/sanjob/releases/latest)** (`sanjob-<version>.zip`):
in einen Ordner entpacken (nicht in OneDrive), dann die Schritte 1–4 unten ausführen und diesen
Ordner wählen. „Code → Download ZIP“ auf GitHub ist der Quellcode – der muss erst gebaut werden.

### Installation (Entpackte Erweiterung laden)

Voraussetzungen: Node.js 20+ und Chrome 116+.

```bash
npm install
npm run build
```

1. `chrome://extensions` öffnen.
2. **Entwicklermodus** einschalten (oben rechts).
3. **Entpackte Erweiterung laden** klicken und den Ordner `dist` wählen.
4. Sanjob anheften und auf das Symbol klicken – der Seitenbereich öffnet sich.

### Bedienung

- **Start / Pause / Weiter / Stoppen** – der Lauf wird komplett vom Hintergrund-Service-Worker
  gesteuert. Stellenseiten laden in einem inaktiven Tab eines eigenen Fensters, nie in deinen
  Tabs – Tabwechsel unterbrechen nichts. Fortschritt steht auch am Symbol (z. B. `45/360`), am
  Ende kommt eine Benachrichtigung („Fertig! 312 Jobs gesammelt“). Wird das Fenster
  geschlossen, pausiert der Lauf.
- **Fortsetzen nach Neustart** – Warteschlange und Ergebnisse liegen in IndexedDB. Wurde der
  Browser während eines Laufs geschlossen, zeigt Sanjob _Unterbrochen_ und **Fortsetzen**.
- **CAPTCHA / Anmeldung / Sperrseite** – Sanjob stoppt, holt das Fenster nach vorne und zeigt
  einen Hinweis. Löse die Abfrage selbst und klicke dann auf **Fortsetzen**.
- **Fenstermodus** (Einstellungen) – _Minimiert_ (Standard) oder _Kleines normales Fenster_.
  Liefern mehrere Stellenseiten leere Felder, schlägt Sanjob den Wechsel vor.
- **Pause zwischen Seitenaufrufen** – standardmäßig zufällig 3–6 s, immer nur eine Seite
  gleichzeitig.
- **An frühere Ergebnisse anhängen** (beim Export) – an: alle gespeicherten Jobs; aus: nur die
  letzte Sammlung.
- **Generischer Modus** – auf anderen Seiten fragt Sanjob nach der Berechtigung für genau diese
  Seite und erkennt die Stellenkarten automatisch.
- **Zwei Modi** – _Seite für Seite_ geht die Ergebnisseiten durch. _Fortlaufend_ liest alle Jobs
  der aktuellen Seite und beobachtet sie weiter: scrollst du nach unten und neue Jobs erscheinen,
  kommen sie dazu. Mit **Fertigstellen** beenden.
- **Titel-Filter** – überspringt Jobs, deren Titel ein ausgeschlossenes Wort (Wortanfang, egal
  ob groß/klein) enthält. Fertige Filter: _Schüler & Ferialjobs_ (Schüler, Schul, Ferial –
  Standard) und _Praxissemester_ (Dual, Studiengang, Quereinsteiger, Senior, Schüler,
  Controlling, Ausbildung), eigene Wörter oder aus.
- **Hover-Vorschau** – vor dem Start wird beim Bewegen der Maus über die Jobliste (Indeed, XING,
  LinkedIn, StepStone) die ganze Liste grün markiert: „Liste mit 25 Jobs · ca. 360 insgesamt“.
- **Live-Ansicht** (Einstellungen, standardmäßig an) – im Ergebnis-Tab, in dem du gestartet
  hast, siehst du den Fortschritt direkt an den Stellenkarten: grün gestrichelt = Link gesammelt,
  pulsierender Rahmen mit „Wird gesammelt…“ = wird gerade gelesen, grünes ✓ = gespeichert, grau
  „Bereits gespeichert“, orange „Übersprungen“. Die Seite scrollt mit (5 s Pause, wenn du selbst
  scrollst), unten rechts steht „✓ 23 / 360 · noch ~25 min“ (Klick öffnet den Seitenbereich).
  Die Markierungen verschieben nichts und blockieren keine Klicks; ✓ bleiben bis zum Neuladen
  oder bis **Markierungen entfernen**.
- **Liste selbst wählen** – beim Bewegen der Maus wird die Jobliste unter dem Zeiger grün
  umrandet (jeder Eintrag gestrichelt), dazu „Liste mit 20 Einträgen gefunden – klicken zum
  Auswählen“. Klick wählt aus, Esc bricht ab.
- **Passung zum Lebenslauf (lokal)** – Lebenslauf einmal in den Einstellungen hochladen (PDF,
  Word .docx oder Text – wird im Browser gelesen) oder einfügen. Jeder Job bekommt dann eine
  **Passung 0–100** (passt sehr gut / gut / teilweise / wenig), die Tabelle wird danach sortiert
  und „Beste Treffer“ zeigt die Top 5. Eine Zeile aufklappen zeigt die **Schlüsselwörter der
  Stelle**, welche **in deinem Lebenslauf** stehen und welche **fehlen**. Muss-Anforderungen
  („zwingend“, „erforderlich“, ❗) zählen 1,5-fach, Wunsch-Anforderungen („wünschenswert“, „von
  Vorteil“, _optional_) nur 0,4-fach. Ein englischer Lebenslauf passt auch zu deutschen Anzeigen
  (Glossar in [`src/match/glossary.ts`](src/match/glossary.ts)). Nichts verlässt den Browser.
- **Filter und Bewerbungsstatus** – nur Jobs ab 40/60/80 % Passung zeigen, pro Job einen Status
  setzen (interessant / beworben / Vorstellungsgespräch / Zusage / Absage), danach filtern und
  Notizen speichern (Ansprechpartner, Frist …). Status und Notizen bleiben erhalten und stehen im
  Excel-Export.
- **KI-Bewertung (optional)** – in den Einstellungen „Jobs mit Claude bewerten“ einschalten,
  Zugriff auf `api.anthropic.com` erlauben und den eigenen Anthropic-API-Schlüssel eintragen
  (nur auf diesem Gerät gespeichert). **Mit KI bewerten** schickt Lebenslauf und die gewählten
  Jobs (oder die Top 10 nach lokaler Passung) an Claude; jeder Job bekommt eine KI-Bewertung, ein
  kurzes Fazit, passende/fehlende Fähigkeiten und Schlüsselwörter. Die Kosten laufen über dein
  Anthropic-Konto (Standard: Claude Opus 5.5; Sonnet 5.5 und Haiku 5.5 sind günstiger).
- **Mit meinem Lebenslauf abgleichen (Prompt)** – Jobs auswählen (oder ✦ in einer Zeile) – ein
  fertiger Prompt wird für [claude.ai](https://claude.ai) kopiert, ohne API-Schlüssel.
- **Excel** – der Export enthält zusätzlich _Status_, _Notizen_, _Passung %_, _Passung_,
  _Schlüsselwörter_, _In meinem Lebenslauf_, _Fehlt im Lebenslauf_ und _KI-Fazit_.
- **Sprache** – Englisch oder Deutsch (Einstellungen).

### Spalten

`Titel | Unternehmen | Ort | Veröffentlicht | Gehalt | Vertragsart | URL | Beschreibung | Ihre Aufgaben | Ihr Profil | Wir bieten | Sonstiges`

Fehlende Werte bleiben leer. Das Datum wird nach `JJJJ-MM-TT` umgewandelt (auch „vor 3 Tagen“,
„Heute“, „2 days ago“); ist das nicht eindeutig möglich, bleibt der Originaltext stehen. Die
Anzeige wird regelbasiert (ohne KI) anhand ihrer Überschriften in **Ihre Aufgaben**, **Ihr Profil**
und **Wir bieten** aufgeteilt; Kontakt- und Bewerbungshinweise am Ende landen in **Sonstiges**,
der Text vor der ersten Überschrift in **Beschreibung** – jeder Textteil steht genau in einer
Spalte. Aufzählungen erscheinen als `• Punkt`. Ohne bekannte Überschrift steht der vollständige
Text in **Beschreibung** und die vier Spalten bleiben leer. Die Überschriften-Synonyme stehen in
[`src/sections/sections.config.ts`](src/sections/sections.config.ts). Zellen über 32.000 Zeichen werden gekürzt und
enden mit ` [truncated]`.

### Ein Seiten-Preset reparieren

Alle seitenspezifischen Selektoren stehen in **einer Datei:
[`src/presets/presets.ts`](src/presets/presets.ts)**.

1. Ergebnisseite und Stellenseite in Chrome mit **Strg+S** („Webseite, komplett“) unter
   `fixtures/<seite>/` speichern.
2. Neue Selektoren mit den DevTools finden (Rechtsklick → Untersuchen). Stabile Attribute wie
   `data-testid`, `data-at`, `id` oder `aria-label` sind besser als generierte Klassen.
3. Preset anpassen: `listing.links`, `listing.next`/`listing.pageParam`,
   `detail.fields.<feld>` (Regeln werden der Reihe nach probiert, siehe
   [`src/presets/types.ts`](src/presets/types.ts)).
4. Test in `tests/presets/<seite>.test.ts` ergänzen, `npm test` ausführen.
5. `npm run build` und Sanjob in `chrome://extensions` neu laden.

### Bekannte Einschränkungen

- Die Presets sind **nicht automatisch gegen die Live-Seiten getestet**, sondern gegen
  gespeicherte Seiten: Indeed und LinkedIn mit echten gespeicherten Seiten (Ergebnislisten;
  Indeed auch eine geöffnete Stelle), XING nur mit der Job-Wünsche-Seite (ohne Jobliste),
  StepStone noch gar nicht. Fehlende Seiten sind durch handgeschriebene `*.synthetic.html`
  ersetzt.
- LinkedIn und XING zeigen viele Jobs nur angemeldet. Sanjob nutzt deine normale
  Browsersitzung und verarbeitet niemals Zugangsdaten.

### Datenschutzerklärung

- **Verarbeitete Daten:** Inhalte der Stellenseiten, die du sammelst, die URLs gesammelter Jobs
  (Duplikaterkennung), deine Einstellungen und – nur wenn du sie einträgst – dein
  Lebenslauf-Text und dein Anthropic-API-Schlüssel.
- **Speicherort:** ausschließlich lokal in deinem Browser (IndexedDB, `chrome.storage.local`).
  Es werden keine Daten an den Entwickler oder an Server übertragen. Keine Telemetrie, keine
  Analyse, kein Tracking, kein nachgeladener Code.
- **Weitergabe:** standardmäßig keine. Daten verlassen den Browser nur, wenn du selbst eine
  Excel-Datei exportierst, einen Prompt kopierst oder die optionale KI-Bewertung nutzt – dann
  gehen Lebenslauf und gewählte Anzeigen mit deinem Schlüssel direkt an Anthropic
  (`api.anthropic.com`).
- **Berechtigungen:** `storage`, `sidePanel`, `tabs`, `scripting`, `activeTab`, `alarms`,
  `notifications`,
  Zugriff auf StepStone, Indeed, LinkedIn und XING sowie – nur nach deiner Zustimmung – auf
  einzelne weitere Seiten im generischen Modus.
- **Löschen:** Zeilen in der Tabelle löschen, **Verlauf löschen** oder die Erweiterung
  entfernen.
- **Kontakt:** bitte ein Issue in diesem Repository eröffnen.

> **Nutzungsbedingungen:** LinkedIn, Indeed, StepStone und XING schränken automatisierten
> Zugriff in ihren Nutzungsbedingungen ein. **Du bist selbst dafür verantwortlich, die
> Bedingungen der jeweiligen Seite einzuhalten.**
