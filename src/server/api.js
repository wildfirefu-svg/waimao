import { config } from '../config.js';
import { createDraft, getDraft, listDrafts, listDraftsForLead, updateDraft } from '../repositories/drafts.js';
import { createEvent, listEventsForLead } from '../repositories/events.js';
import { createLead, deleteLead, getLead, listLeads, updateLead } from '../repositories/leads.js';
import { createProduct, listProducts, updateProduct } from '../repositories/products.js';
import { getSettingsMap, listSettings, setSettings } from '../repositories/settings.js';
import { generateDraft } from '../services/aiDraft.js';
import { validateDraftForSend } from '../services/compliance.js';
import { listDueFollowups, nextFollowUpDate } from '../services/followups.js';
import { sendSingleEmail } from '../services/smtpMailer.js';
import { listTemplateCategories, renderDraftFromTemplate } from '../services/templates.js';
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

  if (request.method === 'GET' && url.pathname === '/api/templates') {
    return sendJson(response, 200, { templates: listTemplateCategories() });
  }

  if (request.method === 'GET' && url.pathname === '/api/followups') {
    return sendJson(response, 200, { leads: listDueFollowups(listLeads(db)) });
  }

  if (request.method === 'POST' && url.pathname === '/api/followups/draft') {
    const body = await readJson(request);
    const lead = getLead(db, Number(body.lead_id));
    if (!lead) return sendJson(response, 404, { error: 'Lead not found.' });
    const templateName = body.template_name === 'finalFollowup' ? 'finalFollowup' : 'followup';
    const activeConfig = effectiveConfig(db, runtimeConfig);
    const generated = renderDraftFromTemplate(lead, activeConfig.company, templateName);
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

  if (request.method === 'GET' && url.pathname === '/api/drafts') {
    return sendJson(response, 200, { drafts: listDrafts(db) });
  }

  if (request.method === 'POST' && url.pathname === '/api/drafts/generate') {
    const body = await readJson(request);
    const lead = getLead(db, Number(body.lead_id));
    if (!lead) return sendJson(response, 404, { error: 'Lead not found.' });

    const activeConfig = effectiveConfig(db, runtimeConfig);
    const generated = await generateDraft(lead, activeConfig.company, activeConfig.ai, body.template_name);
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
