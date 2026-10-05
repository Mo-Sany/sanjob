# Chrome Web Store – listing kit for Sanjob

Everything you need to fill in the Chrome Web Store Developer Dashboard.
Upload package: run `npm run zip` → `sanjob-<version>.zip` (manifest.json at the root).

## Store listing

**Category:** Productivity → Workflow & Planning
**Language:** English (default), German (add as second language)

### Name

`Sanjob`

### Summary (max. 132 characters)

- EN: `Collect job listings from StepStone, Indeed, LinkedIn and XING into one Excel table – sorted, filtered, ready to apply.`
- DE: `Stellenanzeigen von StepStone, Indeed, LinkedIn und XING in eine Excel-Tabelle sammeln – sortiert, gefiltert, bereit zur Bewerbung.`

### Description – English

```
Sanjob turns your job search into one clean Excel table – collected automatically, sorted, filtered and ready for your applications.

Searching for a job, an internship or a Praxissemester usually means opening dozens of ads, copying titles, companies and requirements by hand and losing track of what you have already seen. Sanjob does this work for you: open a search results page on StepStone, Indeed, LinkedIn or XING, click "Start collecting" and keep working while Sanjob reads the job ads one by one in the background.

━━━━━━━━━━━━━━━━━━━━
HOW IT WORKS
━━━━━━━━━━━━━━━━━━━━
1. Open a job search on StepStone, Indeed, LinkedIn or XING.
2. Click the Sanjob icon – the side panel opens and analyzes the page right away.
3. Choose a title filter and a mode, then click "Start collecting".
4. Sanjob reads every job ad in its own background window. You can keep browsing and switch tabs – in page-by-page mode you can even close the search page.
5. Click "Export Excel" – done.

━━━━━━━━━━━━━━━━━━━━
PAGE ANALYSIS BEFORE YOU START
━━━━━━━━━━━━━━━━━━━━
As soon as you open the side panel, Sanjob shows you:
• which job board was recognized
• how many jobs are on the current page
• about how many jobs the search has in total
• how many result pages there are
• how long collecting will take approximately
• how many jobs your title filter will skip on this page

Move the mouse over the page and Sanjob highlights the whole job list in green together with its number of jobs – so you can see exactly what will be collected.

━━━━━━━━━━━━━━━━━━━━
TWO COLLECTION MODES
━━━━━━━━━━━━━━━━━━━━
• Page by page: Sanjob follows the search results across several pages (you choose the maximum number of pages) and reads every job ad.
• Continuous: for pages that load more jobs while you scroll. Sanjob reads all jobs that are already on the page and adds every new job that appears while you keep scrolling.

━━━━━━━━━━━━━━━━━━━━
ONE ROW PER JOB – WITH THE DESCRIPTION SPLIT INTO SECTIONS
━━━━━━━━━━━━━━━━━━━━
Every job becomes one row with these columns:
• Title, Company, Location
• Date posted (converted to a real date, e.g. "3 days ago" → 2026-10-02)
• Salary and Contract type (when the ad shows them)
• Link to the job ad
• Description

The description is split automatically – without AI, using the headings of the ad – into:
• Your tasks ("Ihre Aufgaben")
• Your profile ("Ihr Profil")
• We offer ("Wir bieten")
• Other (contact details, application notes)

Each part of the text appears in exactly one column, so you can compare requirements and benefits of many jobs at a glance. If an ad has no recognizable headings, the full text stays in the description column.

━━━━━━━━━━━━━━━━━━━━
FILTERS THAT FIT YOUR SEARCH
━━━━━━━━━━━━━━━━━━━━
• Title filter: skip jobs whose title contains words you don't want.
• Ready-made filters: "Pupils & holiday jobs" (Schüler, Schul, Ferial) and "Praxissemester" (Dual, Studiengang, Quereinsteiger, Senior, Schüler, Controlling, Ausbildung).
• Your own words: add any keywords you like.
• No duplicates: jobs you have already collected are skipped automatically – also across different searches. "Clear history" starts fresh.

━━━━━━━━━━━━━━━━━━━━
LIVE VIEW AND FULL CONTROL
━━━━━━━━━━━━━━━━━━━━
• Live progress in the side panel: current job, number of jobs collected, remaining time.
• Live view on the results page: every job is marked while Sanjob works (queued, reading, done, skipped).
• The toolbar badge shows the progress even when the side panel is closed.
• A notification tells you when collecting is finished ("Done! 312 jobs collected").
• Pause, continue or cancel at any time.
• Resume after a browser restart – nothing is lost, everything is saved in your browser.
• Choose how the collection window is shown (minimized or as a normal window).

━━━━━━━━━━━━━━━━━━━━
THE JOB TABLE
━━━━━━━━━━━━━━━━━━━━
• Sort by any column (e.g. newest first)
• Search the table
• Delete jobs you are not interested in (one or several at once)
• Expand a row to read the description and its sections

━━━━━━━━━━━━━━━━━━━━
EXCEL EXPORT
━━━━━━━━━━━━━━━━━━━━
• A real Excel table with filter buttons in the header
• Frozen header row, sensible column widths, wrapped text
• Clickable links to every job ad
• Column headers in English or German
• "Append to previous results": add new jobs to your earlier export instead of starting a new file
• Very long texts are shortened safely so Excel can always open the file

━━━━━━━━━━━━━━━━━━━━
CV MATCH PROMPT (OPTIONAL)
━━━━━━━━━━━━━━━━━━━━
Paste your CV or skills once in the settings. Sanjob then copies a ready-made prompt with your CV and the collected jobs to the clipboard. Paste it into the AI assistant of your choice (e.g. claude.ai) to find out which jobs fit you best. Sanjob itself never sends your CV anywhere – it only uses the clipboard.

━━━━━━━━━━━━━━━━━━━━
OTHER JOB SITES
━━━━━━━━━━━━━━━━━━━━
Sanjob also works on many other job boards and company career pages: point at the job list, click it, and Sanjob learns where the jobs are. Access to such a site is only requested when you choose to use Sanjob there – for that one site only.

━━━━━━━━━━━━━━━━━━━━
PRIVATE AND FAIR BY DESIGN
━━━━━━━━━━━━━━━━━━━━
• Everything stays in your browser: no account, no servers, no tracking, no analytics.
• Your collected jobs, settings and CV are stored locally and are never sent to the developer or third parties.
• Sanjob never solves CAPTCHAs and never bypasses logins. If a site asks you to confirm that you are human or to sign in, Sanjob stops, tells you, and waits until you have handled it yourself.
• Sanjob reads one job at a time with a random pause of several seconds between pages, like a person would.
• Interface in English and German.

━━━━━━━━━━━━━━━━━━━━
GOOD TO KNOW
━━━━━━━━━━━━━━━━━━━━
• LinkedIn and XING show most jobs only to logged-in users. Sanjob uses the session you already have open in your browser – it never asks for or stores your password.
• Job boards change their pages from time to time. If something is not recognized correctly, please report it so the site support can be updated.
• Please respect the Terms of Service of the job boards you use. Sanjob is meant for your own, personal job search at a moderate pace.

Sanjob is an independent project and is not affiliated with, endorsed by or sponsored by StepStone, Indeed, LinkedIn or XING. All names belong to their respective owners.

Privacy policy: https://github.com/Mo-Sany/sanjob/blob/main/PRIVACY.md
```

### Description – Deutsch

```
Sanjob macht aus deiner Jobsuche eine saubere Excel-Tabelle – automatisch gesammelt, sortiert, gefiltert und bereit für deine Bewerbungen.

Wer einen Job, ein Praktikum oder ein Praxissemester sucht, öffnet meist Dutzende Anzeigen, kopiert Titel, Firmen und Anforderungen von Hand und verliert schnell den Überblick. Sanjob übernimmt das für dich: Öffne eine Ergebnisseite auf StepStone, Indeed, LinkedIn oder XING, klick auf „Sammeln starten“ und arbeite einfach weiter, während Sanjob die Anzeigen nacheinander im Hintergrund liest.

━━━━━━━━━━━━━━━━━━━━
SO FUNKTIONIERT ES
━━━━━━━━━━━━━━━━━━━━
1. Öffne eine Jobsuche auf StepStone, Indeed, LinkedIn oder XING.
2. Klick auf das Sanjob-Symbol – die Seitenleiste öffnet sich und analysiert die Seite sofort.
3. Wähle einen Titel-Filter und einen Modus und klick auf „Sammeln starten“.
4. Sanjob liest jede Anzeige in einem eigenen Hintergrund-Fenster. Du kannst weitersurfen und den Tab wechseln – im Modus „Seite für Seite“ sogar die Suchseite schließen.
5. Klick auf „Excel exportieren“ – fertig.

━━━━━━━━━━━━━━━━━━━━
SEITENANALYSE VOR DEM START
━━━━━━━━━━━━━━━━━━━━
Sobald du die Seitenleiste öffnest, zeigt dir Sanjob:
• welche Jobbörse erkannt wurde
• wie viele Jobs auf der aktuellen Seite stehen
• wie viele Jobs die Suche ungefähr insgesamt hat
• wie viele Ergebnisseiten es gibt
• wie lange das Sammeln ungefähr dauert
• wie viele Jobs dein Titel-Filter auf dieser Seite überspringt

Bewegst du die Maus über die Seite, markiert Sanjob die ganze Jobliste grün mit der Anzahl der Jobs – so siehst du genau, was gesammelt wird.

━━━━━━━━━━━━━━━━━━━━
ZWEI SAMMEL-MODI
━━━━━━━━━━━━━━━━━━━━
• Seite für Seite: Sanjob folgt den Suchergebnissen über mehrere Seiten (die Höchstzahl bestimmst du) und liest jede Anzeige.
• Fortlaufend: für Seiten, die beim Scrollen weitere Jobs nachladen. Sanjob liest alle Jobs, die schon auf der Seite stehen, und nimmt jeden neuen Job auf, der beim Weiterscrollen erscheint.

━━━━━━━━━━━━━━━━━━━━
EINE ZEILE PRO JOB – MIT AUFGETEILTER BESCHREIBUNG
━━━━━━━━━━━━━━━━━━━━
Jeder Job wird zu einer Zeile mit diesen Spalten:
• Titel, Unternehmen, Ort
• Veröffentlicht (als echtes Datum, z. B. „vor 3 Tagen“ → 2026-10-02)
• Gehalt und Vertragsart (wenn die Anzeige sie nennt)
• Link zur Anzeige
• Beschreibung

Die Beschreibung wird automatisch – ohne KI, anhand der Überschriften der Anzeige – aufgeteilt in:
• Ihre Aufgaben
• Ihr Profil
• Wir bieten
• Sonstiges (Kontakt, Hinweise zur Bewerbung)

Jeder Textteil steht in genau einer Spalte – so vergleichst du Anforderungen und Benefits vieler Jobs auf einen Blick. Hat eine Anzeige keine erkennbaren Überschriften, bleibt der vollständige Text in der Spalte Beschreibung.

━━━━━━━━━━━━━━━━━━━━
FILTER, DIE ZU DEINER SUCHE PASSEN
━━━━━━━━━━━━━━━━━━━━
• Titel-Filter: Jobs überspringen, deren Titel Wörter enthält, die du nicht willst.
• Fertige Filter: „Schüler & Ferialjobs“ (Schüler, Schul, Ferial) und „Praxissemester“ (Dual, Studiengang, Quereinsteiger, Senior, Schüler, Controlling, Ausbildung).
• Eigene Wörter: beliebige Stichwörter hinzufügen.
• Keine Duplikate: Bereits gesammelte Jobs werden automatisch übersprungen – auch über verschiedene Suchen hinweg. „Verlauf löschen“ fängt neu an.

━━━━━━━━━━━━━━━━━━━━
LIVE-ANSICHT UND VOLLE KONTROLLE
━━━━━━━━━━━━━━━━━━━━
• Live-Fortschritt in der Seitenleiste: aktueller Job, Anzahl gesammelter Jobs, verbleibende Zeit.
• Live-Ansicht auf der Ergebnisseite: Jeder Job wird markiert, während Sanjob arbeitet (in der Warteschlange, wird gelesen, fertig, übersprungen).
• Das Symbol in der Symbolleiste zeigt den Fortschritt auch bei geschlossener Seitenleiste.
• Eine Benachrichtigung meldet, wenn das Sammeln fertig ist („Fertig! 312 Jobs gesammelt“).
• Jederzeit pausieren, fortsetzen oder abbrechen.
• Nach einem Browser-Neustart weitermachen – nichts geht verloren, alles wird in deinem Browser gespeichert.
• Wähle, wie das Sammel-Fenster angezeigt wird (minimiert oder als normales Fenster).

━━━━━━━━━━━━━━━━━━━━
DIE JOB-TABELLE
━━━━━━━━━━━━━━━━━━━━
• Nach jeder Spalte sortieren (z. B. neueste zuerst)
• Tabelle durchsuchen
• Uninteressante Jobs löschen (einzeln oder mehrere auf einmal)
• Zeile aufklappen, um Beschreibung und Abschnitte zu lesen

━━━━━━━━━━━━━━━━━━━━
EXCEL-EXPORT
━━━━━━━━━━━━━━━━━━━━
• Eine echte Excel-Tabelle mit Filter-Schaltflächen in der Kopfzeile
• Fixierte Kopfzeile, passende Spaltenbreiten, Zeilenumbruch
• Klickbare Links zu jeder Anzeige
• Spaltenüberschriften auf Deutsch oder Englisch
• „An vorherige Ergebnisse anhängen“: neue Jobs zu deinem früheren Export hinzufügen statt eine neue Datei zu beginnen
• Sehr lange Texte werden sicher gekürzt, damit Excel die Datei immer öffnen kann

━━━━━━━━━━━━━━━━━━━━
LEBENSLAUF-ABGLEICH (OPTIONAL)
━━━━━━━━━━━━━━━━━━━━
Füge deinen Lebenslauf oder deine Skills einmal in den Einstellungen ein. Sanjob kopiert dann einen fertigen Prompt mit deinem Lebenslauf und den gesammelten Jobs in die Zwischenablage. Füge ihn in den KI-Assistenten deiner Wahl ein (z. B. claude.ai) und finde heraus, welche Jobs am besten zu dir passen. Sanjob selbst sendet deinen Lebenslauf nirgendwohin – es nutzt nur die Zwischenablage.

━━━━━━━━━━━━━━━━━━━━
ANDERE JOBSEITEN
━━━━━━━━━━━━━━━━━━━━
Sanjob funktioniert auch auf vielen anderen Jobbörsen und Karriereseiten von Unternehmen: Zeig auf die Jobliste, klick sie an, und Sanjob merkt sich, wo die Jobs stehen. Der Zugriff auf eine solche Seite wird erst angefragt, wenn du Sanjob dort nutzen willst – und nur für diese eine Seite.

━━━━━━━━━━━━━━━━━━━━
PRIVAT UND FAIR
━━━━━━━━━━━━━━━━━━━━
• Alles bleibt in deinem Browser: kein Konto, keine Server, kein Tracking, keine Analyse.
• Deine gesammelten Jobs, Einstellungen und dein Lebenslauf werden lokal gespeichert und nie an den Entwickler oder Dritte gesendet.
• Sanjob löst keine CAPTCHAs und umgeht keine Anmeldungen. Fragt eine Seite, ob du ein Mensch bist, oder verlangt eine Anmeldung, stoppt Sanjob, sagt dir Bescheid und wartet, bis du das selbst erledigt hast.
• Sanjob liest einen Job nach dem anderen, mit einer zufälligen Pause von mehreren Sekunden zwischen den Seiten – wie ein Mensch.
• Oberfläche auf Deutsch und Englisch.

━━━━━━━━━━━━━━━━━━━━
GUT ZU WISSEN
━━━━━━━━━━━━━━━━━━━━
• LinkedIn und XING zeigen die meisten Jobs nur angemeldeten Nutzern. Sanjob nutzt die Sitzung, die in deinem Browser schon geöffnet ist – es fragt nie nach deinem Passwort und speichert es nicht.
• Jobbörsen ändern ihre Seiten von Zeit zu Zeit. Wenn etwas nicht richtig erkannt wird, melde es bitte, damit die Unterstützung der Seite aktualisiert werden kann.
• Bitte beachte die Nutzungsbedingungen der Jobbörsen, die du nutzt. Sanjob ist für deine eigene, persönliche Jobsuche in moderatem Tempo gedacht.

Sanjob ist ein unabhängiges Projekt und steht in keiner Verbindung zu StepStone, Indeed, LinkedIn oder XING und wird von diesen weder unterstützt noch gesponsert. Alle Namen gehören ihren jeweiligen Inhabern.

Datenschutzerklärung: https://github.com/Mo-Sany/sanjob/blob/main/PRIVACY.md
```

### Graphics

| Asset                         | File                                    | Size     |
| ----------------------------- | --------------------------------------- | -------- |
| Store icon                    | `public/icons/icon128.png`              | 128×128  |
| Screenshot 1                  | `store/screenshots/1-analysis.png`      | 1280×800 |
| Screenshot 2                  | `store/screenshots/2-live-progress.png` | 1280×800 |
| Screenshot 3                  | `store/screenshots/3-table.png`         | 1280×800 |
| Screenshot 4                  | `store/screenshots/4-settings.png`      | 1280×800 |
| Small promo tile              | `store/promo-small-440x280.png`         | 440×280  |
| Marquee promo tile (optional) | `store/promo-marquee-1400x560.png`      | 1400×560 |

The screenshots use a demo job board with fictional companies.

## Privacy practices tab

**Single purpose:**

```
Sanjob collects the job listings a user chooses from job board search results into one table and exports them as an Excel file.
```

**Permission justifications:**

| Permission                                              | Justification                                                                                                                                                              |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| sidePanel                                               | The whole user interface (page summary, progress, job table, settings) is shown in the side panel.                                                                         |
| storage                                                 | Saves the user's settings (language, delay, filter words, window mode) locally.                                                                                            |
| tabs                                                    | Reads the URL of the active tab to recognize a job search page, and opens/navigates a background tab in Sanjob's own window to read the job ads the user asked to collect. |
| scripting                                               | Injects Sanjob's content script into the job search page and the job ads to read the job details and to show the progress marks.                                           |
| activeTab                                               | Lets the user analyze the current job page when they open Sanjob from the toolbar.                                                                                         |
| alarms                                                  | Keeps a long collection running in the background service worker and resumes it after the worker restarts.                                                                 |
| notifications                                           | Shows one notification when a collection has finished ("Done! 312 jobs collected").                                                                                        |
| Host permissions (StepStone, Indeed, LinkedIn, XING)    | These are the supported job boards. Sanjob reads their search result pages and job ads – only when the user starts a collection.                                           |
| Optional host permissions (https://\*/\*, http://\*/\*) | Requested at runtime for one single site only, when the user chooses to use Sanjob on another job board. Never requested automatically.                                    |

**Are you using remote code?** No, I am not using remote code. (All JavaScript is bundled in the package.)

**Data usage** – tick nothing under "collected data". Sanjob stores data only locally in the
browser and never transmits it to the developer or third parties (the Chrome Web Store counts
data as "collected" only when it leaves the user's device). Then confirm all three statements:

- I do not sell or transfer user data to third parties, outside of the approved use cases
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL:** `https://github.com/Mo-Sany/sanjob/blob/main/PRIVACY.md`

## Distribution

- Visibility: start with **Unlisted** (only people with the link can install) – switch to Public later.
- Regions: all regions (or Germany/Austria/Switzerland only).
- Pricing: free.

## Test instructions for the reviewer (optional field)

```
1. Open https://de.indeed.com/jobs?q=praktikum (or a StepStone search) and click the Sanjob toolbar icon – the side panel shows a summary of the page.
2. Click "Only this page" – Sanjob opens a minimized window, reads the job ads and fills the table. Progress is shown in the panel and on the page.
3. Click "Export Excel" to download the table.
No account or login is needed for Indeed and StepStone. LinkedIn and XING show most jobs only to logged-in users.
```
