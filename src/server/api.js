import { config } from '../config.js';
import { createDraft, getDraft, listDrafts, listDraftsForLead, updateDraft } from '../repositories/drafts.js';
import { createEvent, listEventsForLead } from '../repositories/events.js';
import { createLead, deleteLead, getLead, listLeads, updateLead } from '../repositories/leads.js';
import { createProduct, deleteProduct, getProduct, listProducts, updateProduct } from '../repositories/products.js';
import { getSettingsMap, listSettings, setSettings } from '../repositories/settings.js';
import { createSourcedLead, deleteSourcedLead, findSourcedLeadDuplicate, getSourcedLead, listSourcedLeads, updateSourcedLead } from '../repositories/sourcedLeads.js';
import { createTemplate, deleteTemplate, getTemplate, getTemplateByKey, listTemplates, updateTemplate } from '../repositories/templates.js';
import { generateDraft } from '../services/aiDraft.js';
import { validateDraftForSend } from '../services/compliance.js';
import { listDueFollowups, nextFollowUpDate } from '../services/followups.js';
import { collectPublicUrl, crawlPublicSite, parseLeadCsv } from '../services/leadSourcing.js';
import { sendSingleEmail } from '../services/smtpMailer.js';
import { renderDraftFromTemplate } from '../services/templates.js';
import { readJson, sendJson } from './router.js';

function numericId(match) {
  return Number(match[1]);
}

function badRequest(response, error) {
  return sendJson(response, 400, { error });
}

function settingValue(settings, key, fallback) {
  return settings[key] ? settings[key] : fallback;
}

function selectedProduct(db, productId) {
  if (!productId) return null;
  return getProduct(db, Number(productId));
}

function selectedTemplate(db, templateId, templateKey) {
  if (templateId) return getTemplate(db, Number(templateId));
  if (templateKey) return getTemplateByKey(db, templateKey);
  return null;
}

function existingLeadForSourcedLead(db, sourcedLead) {
  if (sourcedLead.email) {
    const byEmail = db.prepare('SELECT * FROM leads WHERE email = ? LIMIT 1').get(sourcedLead.email);
    if (byEmail) return byEmail;
  }
  if (sourcedLead.website) {
    const byWebsite = db.prepare('SELECT * FROM leads WHERE website = ? LIMIT 1').get(sourcedLead.website);
    if (byWebsite) return byWebsite;
  }
  if (sourcedLead.company_name) {
    return db.prepare('SELECT * FROM leads WHERE lower(company_name) = lower(?) LIMIT 1').get(sourcedLead.company_name);
  }
  return undefined;
}

function effectiveConfig(db, runtimeConfig) {
  const settings = getSettingsMap(db, { includeSecrets: true });
  return {
    ...runtimeConfig,
    company: {
      name: settingValue(settings, 'COMPANY_NAME', runtimeConfig.company.name),
      website: settingValue(settings, 'COMPANY_WEBSITE', runtimeConfig.company.website),
      address: settingValue(settings, 'COMPANY_ADDRESS', runtimeConfig.company.address)
    },
    smtp: {
      host: settingValue(settings, 'SMTP_HOST', runtimeConfig.smtp.host),
      port: Number(settingValue(settings, 'SMTP_PORT', runtimeConfig.smtp.port)),
      secure: String(settingValue(settings, 'SMTP_SECURE', runtimeConfig.smtp.secure)) === 'true',
      user: settingValue(settings, 'SMTP_USER', runtimeConfig.smtp.user),
      pass: settingValue(settings, 'SMTP_PASS', runtimeConfig.smtp.pass),
      from: settingValue(settings, 'SMTP_FROM', runtimeConfig.smtp.from)
    },
    ai: {
      provider: settingValue(settings, 'AI_PROVIDER', runtimeConfig.ai.provider),
      apiKey: settingValue(settings, 'AI_API_KEY', runtimeConfig.ai.apiKey),
      model: settingValue(settings, 'AI_MODEL', runtimeConfig.ai.model)
    }
  };
}

export async function handleApi(request, response, db, url, runtimeConfig = config) {
  if (request.method === 'GET' && url.pathname === '/api/leads') {
    return sendJson(response, 200, { leads: listLeads(db) });
  }

  if (request.method === 'POST' && url.pathname === '/api/leads') {
    const body = await readJson(request);
    if (!body.company_name) return badRequest(response, 'Company name is required.');
    return sendJson(response, 201, { lead: createLead(db, body) });
  }

  const leadMatch = url.pathname.match(/^\/api\/leads\/(\d+)$/);
  if (leadMatch && request.method === 'GET') {
    const lead = getLead(db, numericId(leadMatch));
    if (!lead) return sendJson(response, 404, { error: 'Lead not found.' });
    return sendJson(response, 200, { lead });
  }

  if (leadMatch && request.method === 'PUT') {
    const body = await readJson(request);
    const lead = updateLead(db, numericId(leadMatch), body);
    if (!lead) return sendJson(response, 404, { error: 'Lead not found.' });
    return sendJson(response, 200, { lead });
  }

  if (leadMatch && request.method === 'DELETE') {
    if (!deleteLead(db, numericId(leadMatch))) {
      return sendJson(response, 404, { error: 'Lead not found.' });
    }
    return sendJson(response, 200, { ok: true });
  }

  const leadEventsMatch = url.pathname.match(/^\/api\/leads\/(\d+)\/events$/);
  if (leadEventsMatch && request.method === 'GET') {
    return sendJson(response, 200, { events: listEventsForLead(db, numericId(leadEventsMatch)) });
  }

  if (leadEventsMatch && request.method === 'POST') {
    const leadId = numericId(leadEventsMatch);
    if (!getLead(db, leadId)) return sendJson(response, 404, { error: 'Lead not found.' });

    const body = await readJson(request);
    if (!body.event_type) return badRequest(response, 'Event type is required.');
    return sendJson(response, 201, {
      event: createEvent(db, {
        lead_id: leadId,
        email_draft_id: body.email_draft_id,
        event_type: body.event_type,
        event_time: body.event_time,
        notes: body.notes,
        created_by: body.created_by
      })
    });
  }

  const leadDraftsMatch = url.pathname.match(/^\/api\/leads\/(\d+)\/drafts$/);
  if (leadDraftsMatch && request.method === 'GET') {
    return sendJson(response, 200, { drafts: listDraftsForLead(db, numericId(leadDraftsMatch)) });
  }

  if (request.method === 'GET' && url.pathname === '/api/products') {
    return sendJson(response, 200, { products: listProducts(db) });
  }

  if (request.method === 'GET' && url.pathname === '/api/sourced-leads') {
    return sendJson(response, 200, { sourced_leads: listSourcedLeads(db) });
  }

  if (request.method === 'POST' && url.pathname === '/api/sourced-leads/import-csv') {
    const body = await readJson(request);
    const rows = parseLeadCsv(body.csv_text || '', {
      source_type: body.source_type,
      source_name: body.source_name,
      market_region: body.market_region
    });
    const created = [];
    const skipped = [];
    for (const row of rows) {
      const duplicate = findSourcedLeadDuplicate(db, row);
      if (duplicate) {
        skipped.push(duplicate);
      } else {
        created.push(createSourcedLead(db, row));
      }
    }
    return sendJson(response, 201, { created, skipped });
  }

  if (request.method === 'POST' && url.pathname === '/api/sourced-leads/collect-url') {
    const body = await readJson(request);
    const urls = Array.isArray(body.urls)
      ? body.urls
      : String(body.urls || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const created = [];
    const skipped = [];
    const errors = [];
    for (const sourceUrl of urls.slice(0, 20)) {
      try {
        const row = await collectPublicUrl(sourceUrl, {
          source_type: body.source_type,
          source_name: body.source_name,
          market_region: body.market_region,
          country_region: body.country_region,
          industry: body.industry,
          notes: body.notes
        });
        const duplicate = findSourcedLeadDuplicate(db, row);
        if (duplicate) {
          skipped.push(duplicate);
        } else {
          created.push(createSourcedLead(db, row));
        }
      } catch (error) {
        errors.push({ url: sourceUrl, error: error.message });
      }
    }
    return sendJson(response, 201, { created, skipped, errors });
  }

  if (request.method === 'POST' && url.pathname === '/api/sourced-leads/crawl-site') {
    const body = await readJson(request);
    const urls = Array.isArray(body.urls)
      ? body.urls
      : String(body.urls || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const created = [];
    const skipped = [];
    const errors = [];
    for (const sourceUrl of urls.slice(0, 10)) {
      try {
        const row = await crawlPublicSite(sourceUrl, {
          source_type: body.source_type,
          source_name: body.source_name,
          market_region: body.market_region,
          country_region: body.country_region,
          industry: body.industry,
          notes: body.notes,
          max_pages: body.max_pages
        });
        const duplicate = findSourcedLeadDuplicate(db, row);
        if (duplicate) {
          skipped.push(duplicate);
        } else {
          created.push(createSourcedLead(db, row));
        }
      } catch (error) {
        errors.push({ url: sourceUrl, error: error.message });
      }
    }
    return sendJson(response, 201, { created, skipped, errors });
  }

  if (request.method === 'GET' && url.pathname === '/api/templates') {
    return sendJson(response, 200, { templates: listTemplates(db) });
  }

  if (request.method === 'GET' && url.pathname === '/api/followups') {
    return sendJson(response, 200, { leads: listDueFollowups(listLeads(db)) });
  }

  if (request.method === 'POST' && url.pathname === '/api/followups/draft') {
    const body = await readJson(request);
    const lead = getLead(db, Number(body.lead_id));
    if (!lead) return sendJson(response, 404, { error: 'Lead not found.' });
    const templateName = body.template_name === 'finalFollowup' ? 'finalFollowup' : 'followup';
    const template = selectedTemplate(db, body.template_id, templateName);
    if (!template) return sendJson(response, 404, { error: 'Template not found.' });
    const product = selectedProduct(db, body.product_id);
    if (body.product_id && !product) return sendJson(response, 404, { error: 'Product not found.' });
    const activeConfig = effectiveConfig(db, runtimeConfig);
    const generated = renderDraftFromTemplate(lead, activeConfig.company, template, product);
    const draft = createDraft(db, { lead_id: lead.id, ...generated });
    createEvent(db, {
      lead_id: lead.id,
      email_draft_id: draft.id,
      event_type: 'Draft Created',
      notes: templateName
    });
    updateLead(db, lead.id, { status: 'Drafted' });
    return sendJson(response, 201, { draft });
  }

  if (request.method === 'POST' && url.pathname === '/api/products') {
    const body = await readJson(request);
    if (!body.product_category) return badRequest(response, 'Product category is required.');
    return sendJson(response, 201, { product: createProduct(db, body) });
  }

  const productMatch = url.pathname.match(/^\/api\/products\/(\d+)$/);
  if (productMatch && request.method === 'PUT') {
    const body = await readJson(request);
    const product = updateProduct(db, numericId(productMatch), body);
    if (!product) return sendJson(response, 404, { error: 'Product not found.' });
    return sendJson(response, 200, { product });
  }

  if (productMatch && request.method === 'DELETE') {
    if (!deleteProduct(db, numericId(productMatch))) {
      return sendJson(response, 404, { error: 'Product not found.' });
    }
    return sendJson(response, 200, { ok: true });
  }

  const sourcedLeadMatch = url.pathname.match(/^\/api\/sourced-leads\/(\d+)$/);
  if (sourcedLeadMatch && request.method === 'PUT') {
    const body = await readJson(request);
    const sourcedLead = updateSourcedLead(db, numericId(sourcedLeadMatch), body);
    if (!sourcedLead) return sendJson(response, 404, { error: 'Sourced lead not found.' });
    return sendJson(response, 200, { sourced_lead: sourcedLead });
  }

  if (sourcedLeadMatch && request.method === 'DELETE') {
    if (!deleteSourcedLead(db, numericId(sourcedLeadMatch))) {
      return sendJson(response, 404, { error: 'Sourced lead not found.' });
    }
    return sendJson(response, 200, { ok: true });
  }

  const sourcedLeadImportMatch = url.pathname.match(/^\/api\/sourced-leads\/(\d+)\/import$/);
  if (sourcedLeadImportMatch && request.method === 'POST') {
    const sourcedLead = getSourcedLead(db, numericId(sourcedLeadImportMatch));
    if (!sourcedLead) return sendJson(response, 404, { error: 'Sourced lead not found.' });
    const existing = existingLeadForSourcedLead(db, sourcedLead);
    if (existing) {
      const updated = updateSourcedLead(db, sourcedLead.id, {
        status: 'Imported',
        imported_lead_id: existing.id
      });
      return sendJson(response, 200, { lead: existing, sourced_lead: updated, duplicate: true });
    }

    const lead = createLead(db, {
      company_name: sourcedLead.company_name || sourcedLead.website || 'Unnamed sourced lead',
      country_region: sourcedLead.country_region,
      market_region: sourcedLead.market_region,
      website: sourcedLead.website,
      source_url: sourcedLead.source_url,
      contact_name: sourcedLead.contact_name,
      email: sourcedLead.email,
      industry: sourcedLead.industry,
      product_fit: sourcedLead.product_fit,
      fit_reason: sourcedLead.fit_reason,
      status: 'New',
      notes: [
        `Source: ${sourcedLead.source_type}${sourcedLead.source_name ? ` - ${sourcedLead.source_name}` : ''}`,
        sourcedLead.notes
      ].filter(Boolean).join('\n')
    });
    const updated = updateSourcedLead(db, sourcedLead.id, {
      status: 'Imported',
      imported_lead_id: lead.id
    });
    return sendJson(response, 201, { lead, sourced_lead: updated, duplicate: false });
  }

  if (request.method === 'POST' && url.pathname === '/api/templates') {
    const body = await readJson(request);
    if (!body.template_key && !body.label) return badRequest(response, 'Template key or label is required.');
    if (!body.subject) return badRequest(response, 'Template subject is required.');
    if (!body.body) return badRequest(response, 'Template body is required.');
    return sendJson(response, 201, { template: createTemplate(db, body) });
  }

  const templateMatch = url.pathname.match(/^\/api\/templates\/(\d+)$/);
  if (templateMatch && request.method === 'PUT') {
    const body = await readJson(request);
    const template = updateTemplate(db, numericId(templateMatch), body);
    if (!template) return sendJson(response, 404, { error: 'Template not found.' });
    return sendJson(response, 200, { template });
  }

  if (templateMatch && request.method === 'DELETE') {
    const result = deleteTemplate(db, numericId(templateMatch));
    if (result.reason === 'missing') return sendJson(response, 404, { error: 'Template not found.' });
    if (result.reason === 'builtin') return sendJson(response, 400, { error: 'Built-in templates cannot be deleted.' });
    return sendJson(response, 200, { ok: true });
  }

  if (request.method === 'GET' && url.pathname === '/api/drafts') {
    return sendJson(response, 200, { drafts: listDrafts(db) });
  }

  if (request.method === 'POST' && url.pathname === '/api/drafts/generate') {
    const body = await readJson(request);
    const lead = getLead(db, Number(body.lead_id));
    if (!lead) return sendJson(response, 404, { error: 'Lead not found.' });

    const activeConfig = effectiveConfig(db, runtimeConfig);
    const product = selectedProduct(db, body.product_id);
    if (body.product_id && !product) return sendJson(response, 404, { error: 'Product not found.' });
    const template = selectedTemplate(db, body.template_id, body.template_name);
    if ((body.template_id || body.template_name) && !template) return sendJson(response, 404, { error: 'Template not found.' });
    const useAi = body.generation_mode === 'ai';
    const generated = useAi
      ? await generateDraft(lead, activeConfig.company, activeConfig.ai, template, product)
      : renderDraftFromTemplate(lead, activeConfig.company, template, product);
    const draft = createDraft(db, { lead_id: lead.id, ...generated });
    createEvent(db, {
      lead_id: lead.id,
      email_draft_id: draft.id,
      event_type: 'Draft Created',
      notes: generated.fallback_reason || generated.template_name || generated.ai_provider
    });
    updateLead(db, lead.id, { status: 'Drafted' });

    return sendJson(response, 201, { draft });
  }

  const draftMatch = url.pathname.match(/^\/api\/drafts\/(\d+)$/);
  if (draftMatch && request.method === 'PUT') {
    const body = await readJson(request);
    const draft = updateDraft(db, numericId(draftMatch), body);
    if (!draft) return sendJson(response, 404, { error: 'Draft not found.' });
    return sendJson(response, 200, { draft });
  }

  const sendMatch = url.pathname.match(/^\/api\/drafts\/(\d+)\/send$/);
  if (sendMatch && request.method === 'POST') {
    const draft = getDraft(db, numericId(sendMatch));
    if (!draft) return sendJson(response, 404, { error: 'Draft not found.' });

    const lead = getLead(db, draft.lead_id);
    const activeConfig = effectiveConfig(db, runtimeConfig);
    const check = validateDraftForSend(lead, draft, activeConfig.smtp);
    if (!check.ok) {
      return sendJson(response, 400, { errors: check.errors, warnings: check.warnings });
    }

    try {
      const result = await sendSingleEmail(activeConfig.smtp, {
        to: lead.email,
        subject: draft.subject,
        body: draft.body
      });
      const sentAt = new Date().toISOString();
      const updatedDraft = updateDraft(db, draft.id, { status: 'Sent', sent_at: sentAt });
      updateLead(db, lead.id, {
        status: 'Sent',
        last_contacted_at: sentAt,
        next_follow_up_at: nextFollowUpDate(new Date(sentAt))
      });
      createEvent(db, {
        lead_id: lead.id,
        email_draft_id: draft.id,
        event_type: 'Email Sent',
        notes: result.messageId || result.response || 'SMTP accepted message'
      });
      return sendJson(response, 200, { draft: updatedDraft, warnings: check.warnings });
    } catch (error) {
      const failedDraft = updateDraft(db, draft.id, { status: 'Failed' });
      return sendJson(response, 502, { error: error.message, draft: failedDraft });
    }
  }

  if (request.method === 'GET' && url.pathname === '/api/settings') {
    return sendJson(response, 200, { settings: listSettings(db) });
  }

  if (request.method === 'PUT' && url.pathname === '/api/settings') {
    const body = await readJson(request);
    return sendJson(response, 200, { settings: setSettings(db, body.settings || body) });
  }

  return false;
}
