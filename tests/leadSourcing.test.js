import test from 'node:test';
import assert from 'node:assert/strict';
import { collectPublicUrl, crawlPublicSite, extractEmails, parseLeadCsv, scoreLead } from '../src/services/leadSourcing.js';

test('CSV import maps common lead columns and scores fiberglass fit', () => {
  const rows = parseLeadCsv(`company_name,website,email,country_region,industry
Example Composites,https://example.com,info@example.com,USA,fiberglass composite materials`);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].company_name, 'Example Composites');
  assert.equal(rows[0].email, 'info@example.com');
  assert.equal(rows[0].product_fit, 'Both');
  assert.ok(rows[0].match_score > 0);
});

test('email extraction ignores image-like false positives', () => {
  assert.deepEqual(extractEmails('Contact sales@example.com or logo@2x.png'), ['sales@example.com']);
});

test('public URL collection extracts title, email, and fit keywords', async () => {
  const fetcher = async () => ({
    ok: true,
    async text() {
      return '<title>Example Fiberglass Distributor</title><main>Fiberglass fabric and mesh fabric supplier. Contact info@example.com</main>';
    }
  });

  const lead = await collectPublicUrl('https://example.com', { source_type: 'Website' }, fetcher);

  assert.equal(lead.company_name, 'Example Fiberglass Distributor');
  assert.equal(lead.email, 'info@example.com');
  assert.equal(lead.product_fit, 'Fiberglass Fabric');
  assert.ok(lead.match_score >= 40);
});

test('lead scoring returns low score when no fit terms are present', () => {
  const score = scoreLead({ company_name: 'General Trading Co.' });

  assert.equal(score.match_score, 0);
  assert.match(score.fit_reason, /review manually/i);
});

test('public site crawler follows same-domain priority links', async () => {
  const pages = new Map([
    ['https://example.com/', '<title>Example Materials</title><a href="/contact">Contact</a><a href="/products">Products</a><a href="https://other.example/contact">Other</a>'],
    ['https://example.com/contact', '<main>Email sales@example.com</main>'],
    ['https://example.com/products', '<main>Fiberglass fabric, mesh fabric, insulation materials</main>']
  ]);
  const fetched = [];
  const fetcher = async (url) => {
    fetched.push(url);
    return {
      ok: pages.has(url),
      async text() {
        return pages.get(url) || '';
      }
    };
  };

  const lead = await crawlPublicSite('https://example.com/', { max_pages: 3 }, fetcher);

  assert.equal(lead.company_name, 'Example Materials');
  assert.equal(lead.email, 'sales@example.com');
  assert.equal(lead.product_fit, 'Fiberglass Fabric');
  assert.ok(lead.match_score >= 40);
  assert.equal(fetched.includes('https://other.example/contact'), false);
});
