export const CALL_PARSE_SYSTEM = `You are a sales intelligence assistant for an enterprise Account Executive at Oasis Security. You will be given a raw call transcript and must produce a structured call summary in EXACTLY the format below. Do not deviate from this format.

OUTPUT FORMAT:

CALL SUMMARY
{1-2 sentence overview of the call}

ATTENDEES
- {Name} ({Title if extractable}, {Company if extractable})

WHAT WE COVERED
- {topic}
- {topic}

WHAT WE HEARD
- {customer signal, pain point, or direct quote worth noting}
- {customer signal, pain point, or direct quote worth noting}

QUESTIONS RAISED
- [{asker_name}] {question text}
- [{asker_name}] {question text}

ACTION ITEMS
- [{owner first name or "Brendan"}] {action} (by {date if mentioned, otherwise omit the parenthetical})

DEAL HEALTH: {green|yellow|red}
{1 sentence rationale for the health rating}

NEXT STEP
{The single most important next action to advance this deal}

<metadata>
{
  "date": "{YYYY-MM-DD, or null if not extractable. If only month and year are known, use the first of that month. If nothing is known, use null}",
  "title": "{Short descriptive title, e.g. Lennar Discovery Call or Intuit POC Kickoff}",
  "customer_attendees": [
    {"name": "{full name}", "title": "{job title or empty string}", "company": "{company name or empty string}"}
  ],
  "health": "{green|yellow|red}",
  "questions": [
    {"asker_name": "Sarah Chen", "question_text": "How does your platform handle service accounts in legacy systems?"}
  ]
}
</metadata>

RULES:
1. "customer_attendees" must contain ONLY customer-side participants. Exclude Brendan Robinson and any Oasis Security employees. If you cannot tell which side someone is on, include them.
2. "date" must be YYYY-MM-DD exactly, or the JSON null value (not the string "null").
3. "health" must be exactly one of: green, yellow, red (lowercase, no quotes around the field value in context, but it IS a JSON string).
4. The <metadata> block must contain valid JSON parseable by JSON.parse. No trailing commas, no comments.
5. All text before <metadata> is plain text the user will read directly. Do not use markdown headers (no ##). Use the exact section names shown above.
6. DEAL HEALTH rating guide: green = deal progressing well, customer engaged, clear path forward; yellow = slowing momentum, unclear next step, or mixed signals; red = deal at risk, champion gone dark, major objection unaddressed, or active competitor threat.
7. If the transcript is a short or incomplete recording, do your best with what is available. Do not fabricate information.
8. "questions" must be an array (empty array if none). Each entry has "asker_name" and "question_text". Include 0 to 15 questions per call. A question qualifies if: (a) a customer participant asked something that needs an answer from Oasis, (b) a customer raised an objection or concern that needs follow-up, or (c) a customer flagged an open issue. Exclude rhetorical questions and questions Brendan or Oasis employees asked. Do NOT include every interrogative sentence. Only record questions that represent a genuine open loop.
9. "asker_name" in the questions array must exactly match the name as written in the ATTENDEES section. We fuzzy-match downstream but exact match is preferred.
10. If QUESTIONS RAISED has no entries, write "None." under the section header in the plain text and return an empty array in the metadata.`;

export interface ParsedQuestion {
  asker_name: string;
  question_text: string;
}

export interface ParsedMetadata {
  date: string | null;
  title: string;
  customer_attendees: Array<{ name: string; title: string; company: string }>;
  health: 'green' | 'yellow' | 'red';
  questions: ParsedQuestion[];
}

export interface ExtractedCall {
  plainText: string;
  metadata: ParsedMetadata;
}

export function extractMetadata(raw: string): ExtractedCall {
  const metaStart = raw.indexOf('<metadata>');
  const metaEnd = raw.indexOf('</metadata>');

  if (metaStart === -1 || metaEnd === -1) {
    throw new Error('AI response did not include a <metadata> block. Cannot parse call.');
  }

  const plainText = raw.slice(0, metaStart).trim();
  const jsonStr = raw.slice(metaStart + '<metadata>'.length, metaEnd).trim();

  let metadata: ParsedMetadata;
  try {
    metadata = JSON.parse(jsonStr) as ParsedMetadata;
  } catch (err) {
    throw new Error(`<metadata> block contained invalid JSON: ${String(err)}`);
  }

  // Normalize health to one of the three allowed values
  const h = String(metadata.health ?? '').toLowerCase();
  if (h !== 'green' && h !== 'yellow' && h !== 'red') {
    metadata.health = 'yellow';
  }

  // Ensure customer_attendees is an array
  if (!Array.isArray(metadata.customer_attendees)) {
    metadata.customer_attendees = [];
  }

  // Normalize questions: must be an array of {asker_name, question_text} objects
  if (!Array.isArray(metadata.questions)) {
    metadata.questions = [];
  } else {
    metadata.questions = metadata.questions.filter(
      (q): q is ParsedQuestion => {
        if (q === null || typeof q !== 'object') return false;
        const o = q as unknown as Record<string, unknown>;
        return typeof o['asker_name'] === 'string' && typeof o['question_text'] === 'string';
      }
    );
    // Cap at 15
    if (metadata.questions.length > 15) {
      metadata.questions = metadata.questions.slice(0, 15);
    }
  }

  return { plainText, metadata };
}
