/**
 * Reads the text of a CV file in the browser: PDF (pdf.js, bundled), Word (.docx) and plain
 * text. Nothing is uploaded anywhere.
 */
import { strFromU8, unzipSync } from 'fflate';

export type CvFileKind = 'pdf' | 'docx' | 'text';

export function cvFileKind(name: string, type = ''): CvFileKind | null {
  const n = name.toLowerCase();
  if (n.endsWith('.pdf') || type === 'application/pdf') return 'pdf';
  if (n.endsWith('.docx')) return 'docx';
  if (/\.(txt|md|text)$/.test(n) || type.startsWith('text/')) return 'text';
  return null;
}

const decodeXml = (s: string): string =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, '&');

/** Text of a .docx file: one line per paragraph, tabs and line breaks kept. */
export function docxText(bytes: Uint8Array): string {
  const files = unzipSync(bytes, { filter: (f) => f.name === 'word/document.xml' });
  const xml = files['word/document.xml'];
  if (!xml) throw new Error('not a .docx file');
  return strFromU8(xml)
    .split(/<\/w:p>/)
    .map((p) => {
      let text = '';
      for (const m of p.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:(tab|br)\/>/g)) {
        text += m[2] === 'tab' ? ' ' : m[2] === 'br' ? '\n' : decodeXml(m[1] ?? '');
      }
      return text;
    })
    .flatMap((p) => p.split('\n'))
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

async function pdfText(bytes: Uint8Array): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const task = pdfjs.getDocument({ data: bytes });
  const doc = await task.promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const content = await (await doc.getPage(i)).getTextContent();
    let line = '';
    const lines: string[] = [];
    for (const item of content.items) {
      if (!('str' in item)) continue;
      line += item.str;
      if (item.hasEOL) {
        lines.push(line);
        line = '';
      } else if (item.str && !line.endsWith(' ')) line += ' ';
    }
    if (line.trim()) lines.push(line);
    pages.push(
      lines
        .map((l) => l.replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .join('\n'),
    );
  }
  await task.destroy();
  return pages.join('\n\n');
}

/** Extracts the text of a CV file. Throws for unsupported files. */
export async function readCvFile(file: File): Promise<string> {
  const kind = cvFileKind(file.name, file.type);
  if (!kind) throw new Error('unsupported');
  if (kind === 'text') return (await file.text()).trim();
  const bytes = new Uint8Array(await file.arrayBuffer());
  return (kind === 'pdf' ? await pdfText(bytes) : docxText(bytes)).trim();
}
