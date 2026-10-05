import { JSDOM } from 'jsdom';
import { extractDetail } from '../src/extract/detail';
import { presetForUrl } from '../src/presets/presets';
import { matchHeading, splitSections } from '../src/sections/split';
import { loadFixture } from './helpers/fixture';

const html = (body: string): Element =>
  new JSDOM(`<div id="d">${body}</div>`).window.document.getElementById('d')!;

describe('matchHeading', () => {
  it.each([
    ['Ihre Aufgaben', 'tasks'],
    ['IHRE AUFGABEN:', 'tasks'],
    ['Deine Aufgaben :', 'tasks'],
    ['Das erwartet dich', 'tasks'],
    ['Zu deinen Aufgaben können gehören:', 'tasks'],
    ['Your responsibilities', 'tasks'],
    ['Dein Profil', 'profile'],
    ['Das bringst du mit:', 'profile'],
    ['Zusätzliche Anforderungen:', 'profile'],
    ['Requirements', 'profile'],
    ['Was wir bieten', 'offer'],
    ['Darauf kannst du dich freuen!', 'offer'],
    ['✅ Benefits', 'offer'],
    ['What we offer', 'offer'],
  ])('%s → %s', (text, key) => {
    expect(matchHeading(text)).toBe(key);
  });

  it('ignores unknown headings and long sentences', () => {
    expect(matchHeading('Über uns')).toBeNull();
    expect(matchHeading('Profilbild')).toBeNull();
    expect(
      matchHeading(
        'In dieser Rolle übernimmst du viele spannende Aufgaben im Team und darüber hinaus',
      ),
    ).toBeNull();
  });
});

describe('splitSections (HTML structure)', () => {
  it('splits by h2/h3, <strong> lines and colon lines; keeps bullets; leftovers go to Sonstiges', () => {
    const s = splitSections(
      html(`
        <p>Wir sind ein junges Team aus Köln.</p>
        <h2>Ihre Aufgaben</h2>
        <ul><li>Planung</li><li>Umsetzung</li></ul>
        <p><strong>DEIN PROFIL:</strong></p>
        <ul><li>Ausbildung</li><li>Teamgeist</li></ul>
        <p>Wir bieten:</p>
        <ul><li>30 Tage Urlaub</li></ul>
        <p>Kurze Entscheidungswege</p>
        <h3>Kontakt</h3>
        <p>Frau Muster</p>`),
    );
    expect(s.tasks).toBe('• Planung\n• Umsetzung');
    expect(s.profile).toBe('• Ausbildung\n• Teamgeist');
    expect(s.offer).toBe('• 30 Tage Urlaub\n\nKurze Entscheidungswege');
    expect(s.other).toBe('Wir sind ein junges Team aus Köln.\n\nKontakt\n\nFrau Muster');
  });

  it('handles <br>-separated lines and "- " text bullets', () => {
    const s = splitSections(
      html(
        '<p><b>Aufgaben</b><br>- Code schreiben<br>- Tests schreiben</p><p><b>Profil</b><br>Neugier</p>',
      ),
    );
    expect(s.tasks).toBe('• Code schreiben\n• Tests schreiben');
    expect(s.profile).toBe('Neugier');
    expect(s.offer).toBe('');
    expect(s.other).toBe('');
  });

  it('leaves all four columns empty when there is no known heading', () => {
    expect(splitSections(html('<p>Nur Fließtext.</p><h2>Über uns</h2><p>Mehr Text.</p>'))).toEqual({
      tasks: '',
      profile: '',
      offer: '',
      other: '',
    });
  });

  it('falls back to plain text', () => {
    const s = splitSections('Intro\n\nIHRE AUFGABEN\n• Eins\n• Zwei\n\nWir bieten:\nObstkorb');
    expect(s.tasks).toBe('• Eins\n• Zwei');
    expect(s.offer).toBe('Obstkorb');
    expect(s.other).toBe('Intro');
  });
});

describe('sections from the site fixtures', () => {
  const read = (fixture: string, url: string) =>
    extractDetail({ doc: loadFixture(fixture, url), pageUrl: url, preset: presetForUrl(url) }).job!;

  it('Indeed (real saved page)', () => {
    const job = read(
      'indeed/homepage-feed.html',
      'https://de.indeed.com/viewjob?jk=24f47c3c796d9b1e',
    );
    expect(job.tasks.split('\n')[0]).toBe(
      '• Bestellungen für den Versand vorbereiten und verpacken',
    );
    expect(job.tasks.split('\n')).toHaveLength(7);
    expect(job.profile).toMatch(/^Bewerber müssen mindestens 18 Jahre alt sein/);
    expect(job.offer).toMatch(/^• 28 Tage bezahlter Urlaub/);
    expect(job.offer).toContain('• 10% Mitarbeiterrabatt bei Amazon');
    expect(job.other).toMatch(/^Bewirb dich jetzt als Versand-/);
    expect(job.other).toContain('Du solltest außerdem in der Lage sein:');
    // The full text is still in the description.
    expect(job.description).toContain('Zu deinen Aufgaben können gehören:');
  });

  it('LinkedIn (h3, bold colon heading, "- " bullets)', () => {
    const job = read(
      'linkedin/detail.synthetic.html',
      'https://www.linkedin.com/jobs/view/4462295045/',
    );
    expect(job.tasks).toBe(
      '• PLC programming (Siemens TIA Portal)\n• Commissioning at customer sites',
    );
    expect(job.profile).toBe(
      '• Degree in electrical engineering or mechatronics\n• Fluent German and English',
    );
    expect(job.offer).toBe(
      '• Hybrid work\n• 30 days of vacation\n\nShort decision paths and a friendly team.',
    );
    expect(job.other).toBe(
      'About the job\n\nContoso builds automation lines for the automotive industry.',
    );
  });

  it('StepStone (h2 headings)', () => {
    const job = read(
      'stepstone/detail.synthetic.html',
      'https://www.stepstone.de/stellenangebote--x--1-inline.html',
    );
    expect(job.tasks).toBe(
      '• Wartung und Instandsetzung elektrischer Anlagen\n• Prüfung nach DGUV V3',
    );
    expect(job.profile).toBe(
      '• Abgeschlossene Ausbildung als Elektroniker\n• Führerschein Klasse B',
    );
    expect(job.offer).toBe('Übertarifliche Bezahlung, 30 Tage Urlaub und ein großartiges Team.');
    expect(job.other).toBe(
      'Über uns\n\nDie Muster GmbH ist ein führender Anbieter für Gebäudetechnik in Norddeutschland.',
    );
  });

  it('StepStone via JSON-LD description when the page body is missing', () => {
    const url = 'https://www.stepstone.de/stellenangebote--x--1-inline.html';
    const doc = loadFixture('stepstone/detail.synthetic.html', url);
    doc.querySelector('[data-at="job-ad-content"]')?.remove();
    doc.querySelector('main')!.setAttribute('class', 'x');
    const ld = doc.querySelector('script[type="application/ld+json"]')!;
    ld.textContent = ld.textContent!.replace(
      '"<p>Wir suchen Verstärkung für unser Team.</p><ul><li>Wartung</li><li>Prüfung</li></ul>"',
      '"<p>Wir suchen Verstärkung.</p><h3>Ihre Aufgaben</h3><ul><li>Wartung</li><li>Prüfung</li></ul>"',
    );
    const job = extractDetail({ doc, pageUrl: url, preset: presetForUrl(url) }).job!;
    expect(job.tasks).toBe('• Wartung\n• Prüfung');
  });

  it('XING (<strong> + <br>, ALL-CAPS colon heading, colon line)', () => {
    const job = read(
      'xing/detail.synthetic.html',
      'https://www.xing.com/jobs/hamburg-elektroniker-123',
    );
    expect(job.tasks).toBe('Inbetriebnahme von Schaltanlagen\nFehlersuche und Dokumentation');
    expect(job.profile).toBe('• Ausbildung als Elektroniker\n• Führerschein Klasse B');
    expect(job.offer).toBe('• Firmenwagen\n• Betriebliche Altersvorsorge');
    expect(job.other).toBe(
      'Nord Energie betreibt Umspannwerke in ganz Norddeutschland.\n\nKontakt\n\nFrau Beispiel freut sich auf deine Bewerbung.',
    );
  });
});
