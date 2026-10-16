# Sanjob – Privacy Policy / Datenschutzerklärung

_Last updated / Stand: 2026-10-16_

[English](#english) · [Deutsch](#deutsch)

## English

Sanjob is a browser extension that collects job listings you choose from job boards and
exports them to an Excel file. This policy explains what data the extension handles.

**Summary: everything stays in your browser. Sanjob has no servers, no accounts, no
telemetry, no analytics and no tracking. The developer receives no data at all. The only
exception is the optional AI evaluation: if you turn it on and use it with your own Anthropic
API key, your CV and the job ads you choose are sent to Anthropic.**

### What Sanjob processes

- **Job page content** of the search results and job ads you decide to collect (title,
  company, location, date, salary, contract type, URL, description).
- **URLs of collected jobs**, to skip jobs you already collected.
- **Your settings** (language, delays, filter words, window mode, etc.).
- **Your CV / skills text** – only if you upload or paste it in Settings yourself. An uploaded
  file (PDF, Word, text) is read inside your browser; only the extracted text is kept.
- **Your Anthropic API key** – only if you turn on the optional AI evaluation and enter it.

### Where it is stored

Only locally in your browser profile (IndexedDB and `chrome.storage.local`). Nothing is
transmitted to the developer or to any third party. Sanjob does not load or run remote code.

### When data leaves your browser

Only when **you** do it:

- by exporting an Excel file to your computer,
- by copying the "Match with my CV" prompt to the clipboard and pasting it somewhere yourself,
- by using the **optional AI evaluation** (off by default). When you click "Rate with AI",
  Sanjob sends your CV text and the text of the chosen job ads directly from your browser to
  Anthropic's API (`api.anthropic.com`), authenticated with your own API key. Anthropic
  processes this data under its own terms and privacy policy
  (<https://www.anthropic.com/legal/privacy>); usage is billed to your Anthropic account.
  Nothing is sent to the developer of Sanjob. Before the first use, Chrome asks you to allow
  access to `api.anthropic.com`.

The CV match score shown without the AI evaluation is calculated locally in your browser.

### Permissions

| Permission                                       | Why                                                                                                    |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `sidePanel`                                      | Shows the Sanjob user interface.                                                                       |
| `storage`                                        | Saves your settings locally.                                                                           |
| `tabs`, `scripting`, `activeTab`                 | Reads the job search page you opened and opens job ads in Sanjob's own collection window to read them. |
| `alarms`                                         | Keeps a running collection alive in the background.                                                    |
| `notifications`                                  | Tells you when a collection has finished.                                                              |
| Host access to StepStone, Indeed, LinkedIn, XING | The supported job boards whose pages Sanjob reads.                                                     |
| Optional access to other sites                   | Only when you choose to use Sanjob on another job site and approve it for that one site.               |
| Optional access to `api.anthropic.com`           | Only for the optional AI evaluation, after you turn it on and approve it.                              |

### Deleting your data

Delete jobs in the table, use **Settings → Clear history**, clear the CV box and the API key
field, or remove the extension – this deletes all data Sanjob stored. Data already sent to
Anthropic through the AI evaluation is governed by Anthropic's retention policy.

### Your responsibility

Job boards have their own Terms of Service, which may restrict automated collection. You are
responsible for using Sanjob in line with them.

### Contact

Please open an issue at <https://github.com/Mo-Sany/sanjob/issues>.

## Deutsch

Sanjob ist eine Browser-Erweiterung, die von dir ausgewählte Stellenanzeigen von Jobbörsen
sammelt und als Excel-Datei exportiert. Diese Erklärung beschreibt, welche Daten sie verarbeitet.

**Kurz: Alles bleibt in deinem Browser. Sanjob hat keine Server, keine Konten, keine Telemetrie,
keine Analyse und kein Tracking. Der Entwickler erhält keinerlei Daten. Einzige Ausnahme ist die
optionale KI-Bewertung: Wenn du sie einschaltest und mit deinem eigenen Anthropic-API-Schlüssel
nutzt, werden dein Lebenslauf und die gewählten Stellenanzeigen an Anthropic gesendet.**

### Was Sanjob verarbeitet

- **Inhalte der Stellenseiten**, die du sammelst (Titel, Unternehmen, Ort, Datum, Gehalt,
  Vertragsart, URL, Beschreibung).
- **URLs gesammelter Jobs**, um bereits gesammelte Jobs zu überspringen.
- **Deine Einstellungen** (Sprache, Pausen, Filterwörter, Fenstermodus usw.).
- **Deinen Lebenslauf-Text** – nur wenn du ihn selbst in den Einstellungen hochlädst oder
  einfügst. Eine hochgeladene Datei (PDF, Word, Text) wird in deinem Browser gelesen; gespeichert
  wird nur der Text.
- **Deinen Anthropic-API-Schlüssel** – nur wenn du die optionale KI-Bewertung einschaltest und
  ihn einträgst.

### Speicherort

Ausschließlich lokal in deinem Browserprofil (IndexedDB und `chrome.storage.local`). Es werden
keine Daten an den Entwickler oder Dritte übertragen. Sanjob lädt und führt keinen Code aus
dem Internet aus.

### Wann Daten den Browser verlassen

Nur wenn **du** es tust:

- beim Export einer Excel-Datei auf deinen Computer,
- wenn du den „Mit meinem Lebenslauf abgleichen“-Prompt kopierst und selbst irgendwo einfügst,
- bei der **optionalen KI-Bewertung** (standardmäßig aus). Klickst du auf „Mit KI bewerten“,
  sendet Sanjob deinen Lebenslauf-Text und den Text der gewählten Anzeigen direkt aus deinem
  Browser an die API von Anthropic (`api.anthropic.com`), authentifiziert mit deinem eigenen
  API-Schlüssel. Anthropic verarbeitet diese Daten nach seinen eigenen Bedingungen und seiner
  Datenschutzerklärung (<https://www.anthropic.com/legal/privacy>); die Nutzung wird über dein
  Anthropic-Konto abgerechnet. An den Entwickler von Sanjob wird nichts gesendet. Vor der ersten
  Nutzung fragt Chrome, ob Sanjob auf `api.anthropic.com` zugreifen darf.

Die Passung ohne KI-Bewertung wird lokal in deinem Browser berechnet.

### Berechtigungen

`sidePanel` (Oberfläche), `storage` (Einstellungen), `tabs`/`scripting`/`activeTab` (Suchseite
lesen und Stellenanzeigen im eigenen Sammel-Fenster öffnen), `alarms` (Sammeln im Hintergrund),
`notifications` (Hinweis, wenn das Sammeln fertig ist), Zugriff auf StepStone, Indeed, LinkedIn
und XING sowie – nur nach deiner Zustimmung – auf einzelne weitere Jobseiten und, für die
optionale KI-Bewertung, auf `api.anthropic.com`.

### Löschen

Jobs in der Tabelle löschen, **Einstellungen → Verlauf löschen**, Lebenslauf-Feld und
API-Schlüssel leeren oder die Erweiterung entfernen – damit werden alle von Sanjob gespeicherten
Daten gelöscht. Für Daten, die über die KI-Bewertung an Anthropic gesendet wurden, gelten die
Aufbewahrungsregeln von Anthropic.

### Kontakt

Bitte ein Issue unter <https://github.com/Mo-Sany/sanjob/issues> eröffnen.
