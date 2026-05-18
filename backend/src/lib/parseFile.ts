import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

export type FileKind = 'txt' | 'pdf' | 'docx' | 'vtt' | 'srt' | 'json';

export interface ParsedFile {
  text: string;
  kind: FileKind;
}

const MAX_BYTES = 10 * 1024 * 1024;
const MIN_CHARS = 200;

export async function parseFile(buffer: Buffer, filename: string): Promise<ParsedFile> {
  if (buffer.length > MAX_BYTES) {
    const mb = (buffer.length / 1024 / 1024).toFixed(1);
    throw new Error(`File "${filename}" is ${mb} MB, exceeds 10 MB limit.`);
  }

  const ext = filename.toLowerCase().split('.').pop() ?? '';

  let text: string;
  let kind: FileKind;

  switch (ext) {
    case 'txt': {
      text = buffer.toString('utf-8');
      kind = 'txt';
      break;
    }
    case 'pdf': {
      const result = await pdfParse(buffer);
      text = result.text;
      kind = 'pdf';
      break;
    }
    case 'docx': {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
      kind = 'docx';
      break;
    }
    case 'vtt': {
      text = parseVtt(buffer.toString('utf-8'));
      kind = 'vtt';
      break;
    }
    case 'srt': {
      text = parseSrt(buffer.toString('utf-8'));
      kind = 'srt';
      break;
    }
    case 'json': {
      text = parseGongJson(buffer.toString('utf-8'), filename);
      kind = 'json';
      break;
    }
    default:
      throw new Error(
        `Unsupported file type ".${ext}". Accepted: .txt, .pdf, .docx, .vtt, .srt, .json`
      );
  }

  const trimmed = text.trim();
  if (trimmed.length < MIN_CHARS) {
    throw new Error(
      `File appears empty or unreadable, got ${trimmed.length} chars (minimum ${MIN_CHARS}).`
    );
  }

  return { text: trimmed, kind };
}

function parseVtt(raw: string): string {
  const lines = raw.split('\n');
  const output: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed === 'WEBVTT' || trimmed.startsWith('WEBVTT ')) continue;
    // Skip any line containing a cue timestamp arrow
    if (trimmed.includes(' --> ')) continue;
    // Strip <v Speaker> tags and HTML-like cue annotations
    const cleaned = trimmed.replace(/<[^>]+>/g, '').trim();
    if (cleaned) output.push(cleaned);
  }

  return output.join('\n');
}

function parseSrt(raw: string): string {
  const lines = raw.split('\n');
  const output: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // Skip sequence number lines (pure integers)
    if (/^\d+$/.test(trimmed)) continue;
    // Skip SRT timestamp lines
    if (trimmed.includes(' --> ')) continue;
    output.push(trimmed);
  }

  return output.join('\n');
}

function parseGongJson(raw: string, filename: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`"${filename}" is not valid JSON.`);
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Unrecognized JSON shape, expected Gong export.');
  }

  const obj = parsed as Record<string, unknown>;

  if (!('transcript' in obj) && !('participants' in obj)) {
    throw new Error('Unrecognized JSON shape, expected Gong export.');
  }

  // Gong transcript is an array of speaker segments
  if (Array.isArray(obj.transcript)) {
    const lines: string[] = [];
    for (const segment of obj.transcript as unknown[]) {
      if (typeof segment !== 'object' || segment === null) continue;
      const seg = segment as Record<string, unknown>;
      const speaker = typeof seg.speakerId === 'string' ? seg.speakerId : '';

      if (Array.isArray(seg.sentences)) {
        const text = (seg.sentences as unknown[])
          .map(s =>
            typeof s === 'object' && s !== null && 'text' in s
              ? String((s as Record<string, unknown>).text)
              : ''
          )
          .filter(Boolean)
          .join(' ');
        if (text) lines.push(speaker ? `${speaker}: ${text}` : text);
      } else if (typeof seg.text === 'string' && seg.text) {
        lines.push(speaker ? `${speaker}: ${seg.text}` : seg.text);
      }
    }
    if (lines.length > 0) return lines.join('\n');
  }

  // Gong transcript as a plain string
  if (typeof obj.transcript === 'string' && obj.transcript) {
    return obj.transcript;
  }

  throw new Error('Could not extract transcript text from Gong JSON.');
}
