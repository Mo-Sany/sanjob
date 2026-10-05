# Sanjob – Privacy Policy / Datenschutzerklärung

_Last updated / Stand: 2026-10-05_

[English](#english) · [Deutsch](#deutsch)

## English

Sanjob is a browser extension that collects job listings you choose from job boards and
exports them to an Excel file. This policy explains what data the extension handles.

**Summary: everything stays in your browser. Sanjob has no servers, no accounts, no
telemetry, no analytics and no tracking. The developer receives no data at all.**

### What Sanjob processes

- **Job page content** of the search results and job ads you decide to collect (title,
  company, location, date, salary, contract type, URL, description).
- **URLs of collected jobs**, to skip jobs you already collected.
- **Your settings** (language, delays, filter words, window mode, etc.).
- **Your CV / skills text** – only if you type it into Settings yourself.

### Where it is stored

Only locally in your browser profile (IndexedDB and `chrome.storage.local`). Nothing is
transmitted to the developer or to any third party. Sanjob does not load or run remote code.

### When data leaves your browser

Only when **you** do it: by exporting an Excel file to your computer, or by copying the
"Match with my CV" prompt to the clipboard and pasting it somewhere yourself.

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

### Deleting your data

Delete jobs in the table, use **Settings → Clear history**, or remove the extension – this
deletes all data Sanjob stored.

### Your responsibility

Job boards have their own Terms of Service, which may restrict automated collection. You are
responsible for using Sanjob in line with them.

### Contact

Please open an issue at <https://github.com/Mo-Sany/sanjob/issues>.

## Deutsch

Sanjob ist eine Browser-Erweiterung, die von dir ausgewählte Stellenanzeigen von Jobbörsen
sammelt und als Excel-Datei exportiert. Diese Erklärung beschreibt, welche Daten sie verarbeitet.

**Kurz: Alles bleibt in deinem Browser. Sanjob hat keine Server, keine Konten, keine Telemetrie,
keine Analyse und kein Tracking. Der Entwickler erhält keinerlei Daten.**

### Was Sanjob verarbeitet

- **Inhalte der Stellenseiten**, die du sammelst (Titel, Unternehmen, Ort, Datum, Gehalt,
  Vertragsart, URL, Beschreibung).
- **URLs gesammelter Jobs**, um bereits gesammelte Jobs zu überspringen.
- **Deine Einstellungen** (Sprache, Pausen, Filterwörter, Fenstermodus usw.).
- **Deinen Lebenslauf-Text** – nur wenn du ihn selbst in den Einstellungen einträgst.

### Speicherort

Ausschließlich lokal in deinem Browserprofil (IndexedDB und `chrome.storage.local`). Es werden
keine Daten an den Entwickler oder Dritte übertragen. Sanjob lädt und führt keinen Code aus
dem Internet aus.

### Wann Daten den Browser verlassen

Nur wenn **du** es tust: beim Export einer Excel-Datei auf deinen Computer oder wenn du den
„Mit meinem Lebenslauf abgleichen“-Prompt in die Zwischenablage kopierst und selbst einfügst.

### Berechtigungen

`sidePanel` (Oberfläche), `storage` (Einstellungen), `tabs`/`scripting`/`activeTab` (Suchseite
lesen und Stellenanzeigen im eigenen Sammel-Fenster öffnen), `alarms` (Sammeln im Hintergrund),
`notifications` (Hinweis, wenn das Sammeln fertig ist), Zugriff auf StepStone, Indeed, LinkedIn
und XING sowie – nur nach deiner Zustimmung – auf einzelne weitere Jobseiten.

### Löschen

Jobs in der Tabelle löschen, **Einstellungen → Verlauf löschen** oder die Erweiterung
entfernen – damit werden alle von Sanjob gespeicherten Daten gelöscht.

### Kontakt

Bitte ein Issue unter <https://github.com/Mo-Sany/sanjob/issues> eröffnen.
