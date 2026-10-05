import { buildMatchPrompt } from '../src/claude/prompt';
import { ClipboardProvider } from '../src/claude/provider';
import type { JobData } from '../src/shared/types';

const job: JobData = {
  title: 'Automation Engineer',
  company: 'Contoso',
  location: 'München',
  datePosted: '2026-10-02',
  salary: '',
  contractType: 'Full-time',
  url: 'https://www.linkedin.com/jobs/view/1/',
  description: 'PLC programming, TIA Portal',
  tasks: '',
  profile: '',
  offer: '',
  other: '',
};

describe('CV match prompt', () => {
  it('contains instructions, CV and job data, and asks for score, skills and verdict', () => {
    const p = buildMatchPrompt('Siemens S7, Python', [job], 'en');
    expect(p).toContain('Match score: <0-100>');
    expect(p).toContain('Matching skills');
    expect(p).toContain('Missing skills');
    expect(p).toContain('Verdict: <one line>');
    expect(p).toContain('Siemens S7, Python');
    expect(p).toContain('Title: Automation Engineer');
    expect(p).toContain('PLC programming, TIA Portal');
    expect(p).not.toContain('Salary:');
  });

  it('builds one prompt for several jobs, in German', () => {
    const p = buildMatchPrompt('CV', [job, { ...job, title: 'Zweiter Job' }], 'de');
    expect(p).toContain('=== STELLE 1 ===');
    expect(p).toContain('=== STELLE 2 ===');
    expect(p).toContain('Match-Score');
  });

  it('copies the prompt to the clipboard', async () => {
    let copied = '';
    const provider = new ClipboardProvider(async (t) => {
      copied = t;
    });
    const out = await provider.run({ cv: 'CV', jobs: [job], lang: 'en' });
    expect(out.kind).toBe('copied');
    expect(copied).toContain('Automation Engineer');
  });
});
