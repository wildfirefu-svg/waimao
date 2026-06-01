const SOURCE_TYPES = new Set(['Trade Show', 'Website', 'B2B', 'Customs Data', 'LinkedIn']);

const PRODUCT_TERMS = [
  'fiberglass',
  'fibreglass',
  'glass fiber',
  'glass fibre',
  'e-glass',
  'woven fabric',
  'mesh fabric',
  'fiberglass yarn',
  'glass yarn',
  'roving',
  'composite',
  'insulation',
  'fireproof',
  'construction material'
];

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const URL_RE = /^https?:\/\//i;
const PRIORITY_LINK_RE = /contact|about|product|company|supplier|fabric|fiberglass|fibreglass|glass-fiber|glass-fibre/i;

export function normalizeSourceType(value) {
  const text = String(value || '').trim();
  return SOURCE_TYPES.has(text) ? text : 'Website';
}

export function normalizeUrl(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (URL_RE.test(text)) return text;
  return `https://${text}`;
}

export function extractEmails(text = '') {
  return [...new Set(String(text).match(EMAIL_RE) || [])]
    .filter((email) => !/\.(png|jpg|jpeg|gif|webp|svg)$/i.test(email));
}

function stripHtml(html = '') {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function htmlTitle(html = '') {
  const match = String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? stripHtml(match[1]).slice(0, 160) : '';
}

function pageLinks(html = '', baseUrl = '') {
  const links = [];
  const hrefRe = /href\s*=\s*["']([^"']+)["']/gi;
  let match = hrefRe.exec(String(html));
  while (match) {
    try {
      const nextUrl = new URL(match[1], baseUrl);
      if (nextUrl.protocol === 'http:' || nextUrl.protocol === 'https:') {
        nextUrl.hash = '';
        links.push(nextUrl.toString());
      }
    } catch {
      // Ignore malformed href values from public pages.
    }
    match = hrefRe.exec(String(html));
  }
  return [...new Set(links)];
}

function sameHost(url, seedUrl) {
  try {
    return new URL(url).hostname.replace(/^www\./, '') === new URL(seedUrl).hostname.replace(/^www\./, '');
  } catch {
    return false;
  }
}

function domainName(url = '') {
  try {
    const { hostname } = new URL(url);
    return hostname.replace(/^www\./, '').split('.')[0].replace(/[-_]+/g, ' ');
  } catch {
    return '';
  }
}

export function scoreLead(input = {}) {
  const text = [
    input.company_name,
    input.industry,
    input.fit_reason,
    input.notes,
    input.raw_text
  ].join(' ').toLowerCase();
  const hits = PRODUCT_TERMS.filter((term) => text.includes(term));
  const hasEmail = Boolean(input.email);
  const hasWebsite = Boolean(input.website);
  const score = Math.min(100, hits.length * 12 + (hasEmail ? 18 : 0) + (hasWebsite ? 10 : 0));
  let productFit = 'Both';
  if (/yarn|roving/.test(text) && !/fabric|mesh|cloth/.test(text)) productFit = 'Fiberglass Yarn';
  if (/fabric|mesh|cloth|textile/.test(text) && !/yarn|roving/.test(text)) productFit = 'Fiberglass Fabric';
  const fitReason = hits.length
    ? `Matched keywords: ${hits.slice(0, 6).join(', ')}`
    : 'No fiberglass keywords found yet; review manually.';

  return { match_score: score, product_fit: productFit, fit_reason: fitReason };
}

function normalizeRow(row = {}, defaults = {}) {
  const lower = Object.fromEntries(Object.entries(row).map(([key, value]) => [key.trim().toLowerCase(), value]));
  const sourceUrl = lower.source_url || lower['source url'] || lower.url || lower['来源url'] || lower['来源链接'] || '';
  const website = lower.website || lower['公司网站'] || lower['官网'] || sourceUrl;
  const normalized = {
    source_type: normalizeSourceType(lower.source_type || lower['source type'] || lower['来源类型'] || defaults.source_type),
    source_name: lower.source_name || lower['source name'] || lower['来源名称'] || defaults.source_name || '',
    company_name: lower.company_name || lower['company name'] || lower.company || lower['公司名称'] || lower['公司'] || '',
    country_region: lower.country_region || lower['country region'] || lower.country || lower['国家'] || lower['国家/地区'] || '',
    market_region: lower.market_region || lower['market region'] || lower.market || lower['市场区域'] || defaults.market_region || '',
    website: normalizeUrl(website),
    source_url: normalizeUrl(sourceUrl || website),
    contact_name: lower.contact_name || lower['contact name'] || lower.contact || lower['联系人'] || '',
    email: lower.email || lower['邮箱'] || '',
    industry: lower.industry || lower['行业'] || '',
    notes: lower.notes || lower['备注'] || '',
    raw_text: Object.values(row).join(' ')
  };
  const score = scoreLead(normalized);
  return { ...normalized, ...score };
}

function parseCsvLine(line) {
  const cells = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      cells.push(cell);
      cell = '';
    } else {
      cell += char;
    }
  }
  cells.push(cell);
  return cells.map((value) => value.trim());
}

export function parseLeadCsv(csvText = '', defaults = {}) {
  const lines = String(csvText).split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    const row = Object.fromEntries(headers.map((header, index) => [header, cells[index] || '']));
    return normalizeRow(row, defaults);
  }).filter((lead) => lead.company_name || lead.website || lead.email);
}

export async function collectPublicUrl(url, defaults = {}, fetcher = fetch) {
  const sourceUrl = normalizeUrl(url);
  if (!URL_RE.test(sourceUrl)) throw new Error('Only public http/https URLs are supported.');
  const response = await fetcher(sourceUrl, {
    headers: { 'User-Agent': 'HengdaLeadResearchMVP/0.1' },
    redirect: 'follow'
  });
  if (!response.ok) throw new Error(`URL fetch failed: ${response.status}`);

  const html = await response.text();
  const text = stripHtml(html).slice(0, 4000);
  const emails = extractEmails(text);
  const title = htmlTitle(html);
  const normalized = {
    source_type: normalizeSourceType(defaults.source_type || 'Website'),
    source_name: defaults.source_name || '',
    company_name: title || domainName(sourceUrl),
    country_region: defaults.country_region || '',
    market_region: defaults.market_region || '',
    website: sourceUrl,
    source_url: sourceUrl,
    contact_name: '',
    email: emails[0] || '',
    industry: defaults.industry || '',
    notes: defaults.notes || '',
    raw_text: text
  };
  const score = scoreLead(normalized);
  return { ...normalized, ...score };
}

export async function crawlPublicSite(url, defaults = {}, fetcher = fetch) {
  const seedUrl = normalizeUrl(url);
  if (!URL_RE.test(seedUrl)) throw new Error('Only public http/https URLs are supported.');

  const maxPages = Math.min(Math.max(Number(defaults.max_pages || 5), 1), 12);
  const visited = new Set();
  const queue = [seedUrl];
  const texts = [];
  const titles = [];
  const emails = new Set();

  while (queue.length && visited.size < maxPages) {
    const currentUrl = queue.shift();
    if (!currentUrl || visited.has(currentUrl) || !sameHost(currentUrl, seedUrl)) continue;
    visited.add(currentUrl);

    const response = await fetcher(currentUrl, {
      headers: { 'User-Agent': 'HengdaLeadCrawlerMVP/0.1' },
      redirect: 'follow'
    });
    if (!response.ok) continue;

    const html = await response.text();
    const title = htmlTitle(html);
    if (title) titles.push(title);
    const text = stripHtml(html).slice(0, 2500);
    if (text) texts.push(text);
    extractEmails(text).forEach((email) => emails.add(email));

    const nextLinks = pageLinks(html, currentUrl)
      .filter((nextUrl) => sameHost(nextUrl, seedUrl) && !visited.has(nextUrl))
      .sort((a, b) => Number(PRIORITY_LINK_RE.test(b)) - Number(PRIORITY_LINK_RE.test(a)));
    queue.push(...nextLinks);
  }

  const rawText = texts.join(' ').slice(0, 8000);
  const normalized = {
    source_type: normalizeSourceType(defaults.source_type || 'Website'),
    source_name: defaults.source_name || '同域公开爬虫',
    company_name: titles[0] || domainName(seedUrl),
    country_region: defaults.country_region || '',
    market_region: defaults.market_region || '',
    website: seedUrl,
    source_url: seedUrl,
    contact_name: '',
    email: [...emails][0] || '',
    industry: defaults.industry || '',
    notes: [
      defaults.notes || '',
      `Crawler pages: ${visited.size}`
    ].filter(Boolean).join('\n'),
    raw_text: rawText
  };
  const score = scoreLead(normalized);
  return { ...normalized, ...score };
}
