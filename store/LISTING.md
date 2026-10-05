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
Sanjob turns a job search into one clean Excel table.

Open a search results page on StepStone, Indeed, LinkedIn or XING and Sanjob shows you what it found: how many jobs are on the page, about how many in total, how many pages and how long collecting will take. Click "Start collecting" and keep working – Sanjob reads the job ads one by one in its own background window.

WHAT YOU GET
• One row per job: title, company, location, date posted, salary, contract type, link and the full job description
• The description split into "Your tasks", "Your profile", "We offer" and "Other"
• Excel export with a real Excel table, frozen header, clickable links and wrapped text

MADE FOR YOUR SEARCH
• Title filter: skip jobs you don't want, e.g. pupil or holiday jobs, or use the "Praxissemester" filter (Dual, Studiengang, Quereinsteiger, Senior, Schüler, Controlling, Ausbildung) – or your own words
• Duplicates are skipped automatically, also across searches
• Page-by-page mode or continuous mode for pages that load more jobs while you scroll
• Live view: the jobs on the page are marked while Sanjob collects (queued, reading, done)
• Pause, continue and resume after a browser restart
• Works on other job sites too: point at the job list and click

PRIVATE BY DESIGN
• Everything stays in your browser – no account, no servers, no tracking, no analytics
• Sanjob never solves CAPTCHAs or bypasses logins: if a site asks you to confirm, it stops and waits for you
• English and German interface

Please respect the Terms of Service of the job boards you use. Sanjob is meant for your own, personal job search at a modest pace.
```

### Description – Deutsch

```
Sanjob macht aus einer Jobsuche eine saubere Excel-Tabelle.

Öffne eine Ergebnisseite auf StepStone, Indeed, LinkedIn oder XING – Sanjob zeigt dir sofort, wie viele Jobs auf der Seite sind, wie viele es ungefähr insgesamt gibt, wie viele Seiten und wie lange das Sammeln dauert. Klick auf „Sammeln starten“ und arbeite weiter – Sanjob liest die Anzeigen nacheinander in einem eigenen Hintergrund-Fenster.

DAS BEKOMMST DU
• Eine Zeile pro Job: Titel, Unternehmen, Ort, Veröffentlichungsdatum, Gehalt, Vertragsart, Link und die vollständige Beschreibung
• Die Beschreibung aufgeteilt in „Ihre Aufgaben“, „Ihr Profil“, „Wir bieten“ und „Sonstiges“
• Excel-Export als echte Excel-Tabelle mit fixierter Kopfzeile, klickbaren Links und Zeilenumbruch

PASSEND ZU DEINER SUCHE
• Titel-Filter: Jobs überspringen, die du nicht willst – z. B. Schüler- oder Ferialjobs, oder der Filter „Praxissemester“ (Dual, Studiengang, Quereinsteiger, Senior, Schüler, Controlling, Ausbildung) – oder eigene Wörter
• Duplikate werden automatisch übersprungen, auch über mehrere Suchen
• Seite für Seite oder fortlaufend für Seiten, die beim Scrollen nachladen
• Live-Ansicht: die Jobs auf der Seite werden beim Sammeln markiert
• Pausieren, fortsetzen und nach einem Browser-Neustart weitermachen
• Funktioniert auch auf anderen Jobseiten: auf die Liste zeigen und klicken

PRIVAT
• Alles bleibt in deinem Browser – kein Konto, keine Server, kein Tracking, keine Analyse
• Sanjob löst keine CAPTCHAs und umgeht keine Anmeldungen: es stoppt und wartet auf dich
• Oberfläche auf Deutsch und Englisch

Bitte beachte die Nutzungsbedingungen der jeweiligen Jobbörse. Sanjob ist für deine eigene, persönliche Jobsuche in moderatem Tempo gedacht.
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

## Additional fields (Store listing tab)

- **Official URL:** `None` – it needs a domain you verified in Google Search Console; github.com can't be verified.
- **Homepage URL:** `https://github.com/Mo-Sany/sanjob`
- **Support URL:** `https://github.com/Mo-Sany/sanjob/issues`

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
