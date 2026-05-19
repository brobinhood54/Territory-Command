export type ColumnMappingResult = {
  mapping: { [tcField: string]: string | null };
  ambiguous: { [tcField: string]: string[] };
  unmapped: string[];
};

const TC_FIELD_ALIASES: { [tcField: string]: string[] } = {
  name: ['account name', 'name', 'company name'],
  sf_id: ['account id', 'salesforce id', 'sf id', 'id'],
  industry: ['industry'],
  state: ['billing state', 'shipping state', 'state', 'billing state province', 'state province'],
  status: ['type', 'status', 'account type', 'account status'],
  fortune_500: ['fortune 500', 'f500', 'fortune500'],
  fortune_1000: ['fortune 1000', 'f1000', 'fortune1000'],
  open_opps: ['open opportunities', 'open opps', 'active opportunities', 'open pipeline', 'open opps'],
  amount: ['annual revenue', 'amount', 'open pipeline value', 'open pipeline amount', 'revenue'],
  website: ['website', 'url'],
  linkedin_url: ['linkedin', 'linkedin url', 'linkedin profile'],
  prior_context: [],
};

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function detectColumnMapping(headers: string[]): ColumnMappingResult {
  const mapping: { [tcField: string]: string | null } = {};
  const ambiguous: { [tcField: string]: string[] } = {};
  const claimedHeaders = new Set<string>();

  for (const [tcField, aliases] of Object.entries(TC_FIELD_ALIASES)) {
    if (aliases.length === 0) {
      mapping[tcField] = null;
      continue;
    }

    const matches = headers.filter(h =>
      aliases.includes(normalizeHeader(h))
    );

    if (matches.length === 1) {
      mapping[tcField] = matches[0];
      claimedHeaders.add(matches[0]);
    } else if (matches.length > 1) {
      ambiguous[tcField] = matches;
      mapping[tcField] = null;
      matches.forEach(h => claimedHeaders.add(h));
    } else {
      mapping[tcField] = null;
    }
  }

  const unmapped = headers.filter(h => !claimedHeaders.has(h));

  return { mapping, ambiguous, unmapped };
}
