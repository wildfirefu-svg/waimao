const state = {
  leads: [],
  drafts: [],
  events: [],
  products: [],
  sourcedLeads: [],
  followups: [],
  templates: [],
  settings: [],
  selectedLeadId: null,
  selectedDraftId: null,
  editingLeadId: null,
  editingProductId: null,
  editingTemplateId: null,
  search: '',
  region: '',
  busy: false
};

const els = {
  notice: document.querySelector('#notice'),
  metrics: document.querySelector('#metrics'),
  leadTable: document.querySelector('#leadTable'),
  draftPanel: document.querySelector('#draftPanel'),
  draftModeTag: document.querySelector('#draftModeTag'),
  eventList: document.querySelector('#eventList'),
  productList: document.querySelector('#productList'),
  sourcedLeadList: document.querySelector('#sourcedLeadList'),
  followupList: document.querySelector('#followupList'),
  templateList: document.querySelector('#templateList'),
  settingsForm: document.querySelector('#settingsForm'),
  searchInput: document.querySelector('#searchInput'),
  regionFilter: document.querySelector('#regionFilter'),
  leadDialog: document.querySelector('#leadDialog'),
  leadForm: document.querySelector('#leadForm'),
  productDialog: document.querySelector('#productDialog'),
  productDialogTitle: document.querySelector('#productDialogTitle'),
  productForm: document.querySelector('#productForm'),
  draftProductDialog: document.querySelector('#draftProductDialog'),
  draftProductForm: document.querySelector('#draftProductForm'),
  draftProductSelect: document.querySelector('#draftProductSelect'),
  draftModeSelect: document.querySelector('#draftModeSelect'),
  draftTemplateSelect: document.querySelector('#draftTemplateSelect'),
  templateDialog: document.querySelector('#templateDialog'),
  templateDialogTitle: document.querySelector('#templateDialogTitle'),
  templateForm: document.querySelector('#templateForm'),
  sourceCsvForm: document.querySelector('#sourceCsvForm'),
  sourceUrlForm: document.querySelector('#sourceUrlForm'),
  sourceCrawlerForm: document.querySelector('#sourceCrawlerForm'),
  sourceCsvFile: document.querySelector('#sourceCsvFile')
};

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let payload = {};
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { error: text };
    }
  }
  if (!response.ok) {
    const message = payload.error || (payload.errors || []).join('\n') || `请求失败：${response.status}`;
    throw new Error(message);
  }
  return payload;
}

function setNotice(message = '', type = '') {
  els.notice.hidden = !message;
  els.notice.className = `notice ${type}`.trim();
  els.notice.textContent = message;
}

function setBusy(busy) {
  state.busy = busy;
  document.querySelectorAll('button, input, textarea, select').forEach((control) => {
    if (control.closest('.modal') && control.type !== 'submit') return;
    control.disabled = busy;
  });
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

function formatDate(value) {
  if (!value) return '暂无';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
}

function normalizeId(value) {
  return value == null ? null : Number(value);
}

function selectedLead() {
  return state.leads.find((lead) => normalizeId(lead.id) === state.selectedLeadId) || null;
}

function selectedDraft() {
  const lead = selectedLead();
  const leadDrafts = lead ? state.drafts.filter((draft) => normalizeId(draft.lead_id) === normalizeId(lead.id)) : [];
  return leadDrafts.find((draft) => normalizeId(draft.id) === state.selectedDraftId) || leadDrafts[0] || null;
}

function filteredLeads() {
  const keyword = state.search.trim().toLowerCase();
  return state.leads.filter((lead) => {
    const region = lead.market_region || lead.country_region || '';
    const matchesRegion = !state.region || region === state.region;
    const text = [
      lead.company_name,
      lead.country_region,
      lead.market_region,
      lead.email,
      lead.industry,
      lead.product_fit
    ].join(' ').toLowerCase();
    return matchesRegion && (!keyword || text.includes(keyword));
  });
}

function statusLabel(status) {
  return {
    New: '新线索',
    Drafted: '已生成草稿',
    Sent: '已发送',
    Replied: '已回复',
    'Not Interested': '无兴趣',
    Unsubscribed: '已退订'
  }[status] || status || '新线索';
}

function statusClass(status) {
  return {
    New: 'blue',
    Drafted: 'amber',
    Sent: 'green',
    Replied: 'teal',
    'Not Interested': 'red',
    Unsubscribed: 'red'
  }[status] || '';
}

function productFitLabel(value) {
  return {
    Both: '玻纤纱 + 玻纤布',
    'Fiberglass Yarn': '玻纤纱',
    'Fiberglass Fabric': '玻纤布'
  }[value] || value || '待判断';
}

function regionLabel(value) {
  return {
    USA: '美国',
    Europe: '欧洲',
    'Middle East': '中东',
    'Southeast Asia': '东南亚'
  }[value] || value || '';
}

function productOptionLabel(product) {
  const parts = [
    product.product_category,
    product.product_name || product.product_type || '未命名产品',
    product.model_specification
  ].filter(Boolean);
  return parts.join(' · ');
}

function templateOptionLabel(template) {
  return `${template.is_builtin ? '内置' : '自定义'} · ${template.label || template.template_key}`;
}

function sourceTypeLabel(value) {
  return {
    'Trade Show': '展会',
    Website: '官网',
    B2B: 'B2B',
    'Customs Data': '海关数据',
    LinkedIn: 'LinkedIn'
  }[value] || value || '官网';
}

function sourceStatusLabel(value) {
  return {
    Review: '待审核',
    Imported: '已导入',
    Skipped: '已跳过'
  }[value] || value || '待审核';
}

function scoreClass(score) {
  if (Number(score) >= 70) return 'green';
  if (Number(score) >= 40) return 'amber';
  return 'blue';
}

function isEuropeRegion(value) {
  const text = String(value || '').toLowerCase();
  return [
    'europe',
    'eu',
    'european union',
    'united kingdom',
    'uk',
    'germany',
    'france',
    'italy',
    'spain',
    'netherlands',
    'poland',
    'belgium',
    'sweden',
    'norway',
    'denmark',
    'finland',
    'ireland',
    'austria',
    'switzerland'
  ].some((term) => text === term || text.includes(term));
}

function renderMetrics() {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const dueCount = state.leads.filter((lead) => {
    if (!lead.next_follow_up_at) return false;
    const due = new Date(lead.next_follow_up_at);
    return !Number.isNaN(due.getTime()) && due <= today;
  }).length;
  const items = [
    ['新客户线索', state.leads.filter((lead) => lead.status === 'New').length, '等待判断产品匹配', ''],
    ['待发送草稿', state.drafts.filter((draft) => draft.status !== 'Sent').length, '人工审核后单封发送', ''],
    ['今日需跟进', dueCount, '按跟进日期提醒', 'warning'],
    ['已退订客户', state.leads.filter((lead) => lead.status === 'Unsubscribed' || lead.unsubscribed_at).length, '系统禁止再次发送', 'danger']
  ];
  els.metrics.innerHTML = items.map(([label, value, note, tone]) => `
    <div class="metric ${tone}">
      <div class="metric-top"><span>${label}</span><span>MVP</span></div>
      <div class="metric-value">${value}</div>
      <div class="metric-note">${note}</div>
      <div class="metric-accent"></div>
    </div>
  `).join('');
}

function renderLeadTable() {
  const leads = filteredLeads();
  const rows = leads.map((lead) => {
    const id = normalizeId(lead.id);
    const region = lead.market_region || lead.country_region || '';
    return `
      <tr class="selectable ${id === state.selectedLeadId ? 'selected' : ''}" data-lead-id="${id}">
        <td style="width: 28%">
          <div class="company">${escapeHtml(lead.company_name || '未命名公司')}</div>
          <div class="sub">${escapeHtml(lead.contact_name || '联系人待补充')} · ${escapeHtml(lead.email || '邮箱待补充')}</div>
        </td>
        <td style="width: 12%">${escapeHtml(regionLabel(region))}</td>
        <td style="width: 15%">${escapeHtml(lead.industry || '待补充')}</td>
        <td style="width: 18%"><span class="tag teal">${escapeHtml(productFitLabel(lead.product_fit))}</span></td>
        <td style="width: 14%"><span class="tag ${statusClass(lead.status)}">${escapeHtml(statusLabel(lead.status))}</span></td>
        <td style="width: 13%">${lead.source_url ? '<span class="tag green">已记录</span>' : '<span class="tag red">缺少来源</span>'}</td>
      </tr>
    `;
  }).join('');

  els.leadTable.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>公司</th>
          <th>区域</th>
          <th>行业</th>
          <th>匹配产品</th>
          <th>状态</th>
          <th>来源</th>
        </tr>
      </thead>
      <tbody>${rows || '<tr><td colspan="6"><p class="empty">暂无客户线索。</p></td></tr>'}</tbody>
    </table>
  `;

  els.leadTable.querySelectorAll('[data-lead-id]').forEach((row) => {
    row.addEventListener('click', () => selectLead(Number(row.dataset.leadId)));
  });
}

function renderDraftPanel() {
  const lead = selectedLead();
  const draft = selectedDraft();
  const leadDrafts = lead ? state.drafts.filter((item) => normalizeId(item.lead_id) === normalizeId(lead.id)) : [];
  els.draftModeTag.textContent = draft ? `${draft.draft_mode || 'template'} · ${draft.status || 'Draft'}` : '待生成';
  els.draftModeTag.className = `tag ${draft?.draft_mode === 'ai' ? 'teal' : 'blue'}`;

  if (!lead) {
    els.draftPanel.innerHTML = '<p class="empty">请选择客户线索。</p>';
    return;
  }

  const body = draft?.body || '';
  const checks = [
    [Boolean(lead.source_url), '客户来源链接已保存，后续可以追溯。'],
    [lead.status !== 'Unsubscribed' && !lead.unsubscribed_at, '未命中退订名单，可以继续人工审核。'],
    [/unsubscribe/i.test(body), '邮件包含退订说明，标题没有夸大或误导。']
  ];
  const europeWarning = isEuropeRegion(`${lead.market_region || ''} ${lead.country_region || ''}`)
    ? '<div class="check-row"><span class="check-box warn">!</span><span>欧洲客户：发送前确认来源、退订说明和联系必要性。</span></div>'
    : '';

  els.draftPanel.innerHTML = `
    <div class="selected-lead">
      <strong>${escapeHtml(lead.company_name || '未命名公司')}</strong>
      <span>${escapeHtml(regionLabel(lead.market_region || lead.country_region))} · ${escapeHtml(lead.industry || '行业待补充')} · ${escapeHtml(lead.email || '邮箱待补充')}</span>
    </div>
    ${leadDrafts.length > 1 ? `
      <div class="draft-list">
        ${leadDrafts.map((item) => `
          <button class="draft-chip ${normalizeId(item.id) === normalizeId(draft?.id) ? 'active' : ''}" type="button" data-draft-id="${normalizeId(item.id)}">
            #${escapeHtml(item.id)} ${escapeHtml(item.subject || 'Untitled')}
          </button>
        `).join('')}
      </div>
    ` : ''}
    <label class="field">英文邮件标题
      <input class="input" id="draftSubject" value="${escapeHtml(draft?.subject || '')}" ${draft ? '' : 'disabled'}>
    </label>
    <label class="field">英文邮件正文
      <textarea id="draftBody" ${draft ? '' : 'disabled'}>${escapeHtml(body)}</textarea>
    </label>
    <div class="checklist">
      ${checks.map(([ok, text]) => `
        <div class="check-row"><span class="check-box ${ok ? '' : 'warn'}">${ok ? '✓' : '!'}</span><span>${text}</span></div>
      `).join('')}
      ${europeWarning}
    </div>
    <div class="send-actions">
      <button class="btn" id="saveDraftButton" type="button" ${draft ? '' : 'disabled'}>保存草稿</button>
      <button class="btn" id="copyDraftButton" type="button" ${draft ? '' : 'disabled'}>复制邮件</button>
      <button class="btn primary" id="sendDraftButton" type="button" ${draft ? '' : 'disabled'}>发送单封邮件</button>
    </div>
  `;

  els.draftPanel.querySelectorAll('[data-draft-id]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedDraftId = Number(button.dataset.draftId);
      render();
    });
  });
  document.querySelector('#saveDraftButton')?.addEventListener('click', saveDraft);
  document.querySelector('#copyDraftButton')?.addEventListener('click', copyDraft);
  document.querySelector('#sendDraftButton')?.addEventListener('click', sendDraft);
}

function renderEvents() {
  if (!state.selectedLeadId) {
    els.eventList.innerHTML = '<p class="empty">请选择客户查看跟进记录。</p>';
    return;
  }
  els.eventList.innerHTML = state.events.map((event) => `
    <div class="timeline-item">
      <div class="time">${escapeHtml(formatDate(event.event_time))}</div>
      <div>
        <strong>${escapeHtml(event.event_type || 'Contact Event')}</strong>
        <p>${escapeHtml(event.notes || '')}</p>
      </div>
    </div>
  `).join('') || '<p class="empty">暂无跟进记录。</p>';
}

function renderProducts() {
  const rows = state.products.map((product) => `
    <tr>
      <td style="width: 15%">${escapeHtml(product.product_category || '')}</td>
      <td style="width: 17%">${escapeHtml(product.product_name || '待补充')}</td>
      <td style="width: 18%">${escapeHtml(product.product_type || '')}</td>
      <td style="width: 22%">${escapeHtml(product.model_specification || product.main_applications || '')}</td>
      <td style="width: 16%">${escapeHtml(product.internal_notes || '')}</td>
      <td style="width: 12%">
        <button class="btn compact-action" type="button" data-product-id="${normalizeId(product.id)}">编辑</button>
        <button class="btn compact-action danger-action" type="button" data-delete-product-id="${normalizeId(product.id)}">删除</button>
      </td>
    </tr>
  `).join('');

  els.productList.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>产品类别</th>
          <th>产品名称</th>
          <th>产品类型</th>
          <th>规格/用途</th>
          <th>内部备注</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>${rows || '<tr><td colspan="6"><p class="empty">暂无产品资料。</p></td></tr>'}</tbody>
    </table>
  `;

  els.productList.querySelectorAll('[data-product-id]').forEach((button) => {
    button.addEventListener('click', () => {
      const product = state.products.find((item) => normalizeId(item.id) === Number(button.dataset.productId));
      setProductDialogMode(product);
    });
  });
  els.productList.querySelectorAll('[data-delete-product-id]').forEach((button) => {
    button.addEventListener('click', () => deleteProduct(Number(button.dataset.deleteProductId)));
  });
}

function renderSourcedLeads() {
  const rows = state.sourcedLeads.map((lead) => `
    <tr>
      <td style="width: 11%"><span class="tag blue">${escapeHtml(sourceTypeLabel(lead.source_type))}</span></td>
      <td style="width: 22%">
        <div class="company">${escapeHtml(lead.company_name || '待补充公司')}</div>
        <div class="sub">${escapeHtml(lead.website || lead.source_url || '缺少网址')}</div>
      </td>
      <td style="width: 10%">${escapeHtml(regionLabel(lead.market_region) || lead.country_region || '待判断')}</td>
      <td style="width: 15%">${escapeHtml(lead.email || '未提取')}</td>
      <td style="width: 14%"><span class="tag teal">${escapeHtml(productFitLabel(lead.product_fit))}</span></td>
      <td style="width: 10%"><span class="tag ${scoreClass(lead.match_score)}">${escapeHtml(lead.match_score || 0)}</span></td>
      <td style="width: 8%"><span class="tag ${lead.status === 'Imported' ? 'green' : 'amber'}">${escapeHtml(sourceStatusLabel(lead.status))}</span></td>
      <td style="width: 10%">
        <button class="btn compact-action" type="button" data-import-source-id="${normalizeId(lead.id)}" ${lead.status === 'Imported' ? 'disabled' : ''}>导入</button>
        <button class="btn compact-action danger-action" type="button" data-delete-source-id="${normalizeId(lead.id)}">删除</button>
      </td>
    </tr>
  `).join('');

  els.sourcedLeadList.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>来源</th>
          <th>公司/网址</th>
          <th>区域</th>
          <th>邮箱</th>
          <th>匹配产品</th>
          <th>评分</th>
          <th>状态</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>${rows || '<tr><td colspan="8"><p class="empty">暂无采集线索。可以粘贴CSV或输入公开URL开始。</p></td></tr>'}</tbody>
    </table>
  `;

  els.sourcedLeadList.querySelectorAll('[data-import-source-id]').forEach((button) => {
    button.addEventListener('click', () => importSourcedLead(Number(button.dataset.importSourceId)));
  });
  els.sourcedLeadList.querySelectorAll('[data-delete-source-id]').forEach((button) => {
    button.addEventListener('click', () => deleteSourcedLead(Number(button.dataset.deleteSourceId)));
  });
}

function renderDraftProductSelect() {
  els.draftProductSelect.innerHTML = `
    <option value="">不引用产品资料</option>
    ${state.products.map((product) => `
      <option value="${normalizeId(product.id)}">${escapeHtml(productOptionLabel(product))}</option>
    `).join('')}
  `;
}

function renderDraftTemplateSelect() {
  els.draftTemplateSelect.innerHTML = state.templates.map((template) => `
    <option value="${normalizeId(template.id)}">${escapeHtml(templateOptionLabel(template))}</option>
  `).join('');
}

function renderFollowups() {
  els.followupList.innerHTML = `
    <table>
      <thead>
        <tr><th>公司</th><th>区域</th><th>状态</th><th>跟进日期</th><th>操作</th></tr>
      </thead>
      <tbody>
        ${state.followups.map((lead) => `
          <tr>
            <td>${escapeHtml(lead.company_name)}</td>
            <td>${escapeHtml(regionLabel(lead.market_region || lead.country_region))}</td>
            <td><span class="tag ${statusClass(lead.status)}">${escapeHtml(statusLabel(lead.status))}</span></td>
            <td>${escapeHtml(formatDate(lead.next_follow_up_at))}</td>
            <td>
              <button class="btn compact-action" type="button" data-followup-id="${lead.id}" data-template="followup">跟进草稿</button>
              <button class="btn compact-action" type="button" data-followup-id="${lead.id}" data-template="finalFollowup">最终跟进</button>
            </td>
          </tr>
        `).join('') || '<tr><td colspan="5"><p class="empty">暂无到期跟进任务。</p></td></tr>'}
      </tbody>
    </table>
  `;
  els.followupList.querySelectorAll('[data-followup-id]').forEach((button) => {
    button.addEventListener('click', () => generateFollowupDraft(Number(button.dataset.followupId), button.dataset.template));
  });
}

function renderTemplates() {
  els.templateList.innerHTML = `
    <table>
      <thead><tr><th>模板键</th><th>用途</th><th>标题</th><th>类型</th><th>操作</th></tr></thead>
      <tbody>
        ${state.templates.map((template) => `
          <tr>
            <td style="width: 16%">${escapeHtml(template.template_key)}</td>
            <td style="width: 22%">${escapeHtml(template.label)}</td>
            <td style="width: 32%">${escapeHtml(template.subject)}</td>
            <td style="width: 10%"><span class="tag ${template.is_builtin ? 'blue' : 'teal'}">${template.is_builtin ? '内置' : '自定义'}</span></td>
            <td style="width: 20%">
              <button class="btn compact-action" type="button" data-template-id="${normalizeId(template.id)}">编辑</button>
              <button class="btn compact-action danger-action" type="button" data-delete-template-id="${normalizeId(template.id)}" ${template.is_builtin ? 'disabled' : ''}>删除</button>
            </td>
          </tr>
        `).join('') || '<tr><td colspan="5"><p class="empty">模板加载中。</p></td></tr>'}
      </tbody>
    </table>
  `;

  els.templateList.querySelectorAll('[data-template-id]').forEach((button) => {
    button.addEventListener('click', () => {
      const template = state.templates.find((item) => normalizeId(item.id) === Number(button.dataset.templateId));
      setTemplateDialogMode(template);
    });
  });
  els.templateList.querySelectorAll('[data-delete-template-id]').forEach((button) => {
    button.addEventListener('click', () => deleteTemplate(Number(button.dataset.deleteTemplateId)));
  });
}

function fillSettingsForm() {
  const values = Object.fromEntries(state.settings.map((setting) => [setting.key, setting.value]));
  for (const control of els.settingsForm.elements) {
    if (!control.name) continue;
    if (control.type === 'password') {
      control.value = '';
    } else if (Object.hasOwn(values, control.name)) {
      control.value = values[control.name];
    }
  }
}

function render() {
  renderMetrics();
  renderLeadTable();
  renderDraftPanel();
  renderEvents();
  renderSourcedLeads();
  renderProducts();
  renderDraftProductSelect();
  renderDraftTemplateSelect();
  renderFollowups();
  renderTemplates();
  fillSettingsForm();
}

async function loadData({ silent = false } = {}) {
  if (!silent) setNotice('');
  const [leadPayload, draftPayload, productPayload, sourcedLeadPayload, followupPayload, templatePayload, settingPayload] = await Promise.all([
    api('/api/leads'),
    api('/api/drafts'),
    api('/api/products'),
    api('/api/sourced-leads'),
    api('/api/followups'),
    api('/api/templates'),
    api('/api/settings')
  ]);
  state.leads = leadPayload.leads || [];
  state.drafts = draftPayload.drafts || [];
  state.products = productPayload.products || [];
  state.sourcedLeads = sourcedLeadPayload.sourced_leads || [];
  state.followups = followupPayload.leads || [];
  state.templates = templatePayload.templates || [];
  state.settings = settingPayload.settings || [];
  if (!state.selectedLeadId || !state.leads.some((lead) => normalizeId(lead.id) === state.selectedLeadId)) {
    state.selectedLeadId = normalizeId(state.leads[0]?.id);
  }
  syncSelectedDraft();
  await loadEvents();
  render();
}

async function loadEvents() {
  if (!state.selectedLeadId) {
    state.events = [];
    return;
  }
  const payload = await api(`/api/leads/${state.selectedLeadId}/events`);
  state.events = payload.events || [];
}

function syncSelectedDraft() {
  const lead = selectedLead();
  if (!lead) {
    state.selectedDraftId = null;
    return;
  }
  const leadDrafts = state.drafts.filter((draft) => normalizeId(draft.lead_id) === normalizeId(lead.id));
  if (!leadDrafts.some((draft) => normalizeId(draft.id) === state.selectedDraftId)) {
    state.selectedDraftId = normalizeId(leadDrafts[0]?.id);
  }
}

async function selectLead(id) {
  state.selectedLeadId = id;
  syncSelectedDraft();
  try {
    await loadEvents();
    setNotice('');
  } catch (error) {
    state.events = [];
    setNotice(error.message, 'error');
  }
  render();
}

async function withAction(action, successMessage) {
  try {
    setBusy(true);
    await action();
    if (successMessage) setNotice(successMessage, 'success');
  } catch (error) {
    setNotice(error.message, 'error');
  } finally {
    setBusy(false);
    render();
  }
}

function formPayload(form) {
  const data = new FormData(form);
  return Object.fromEntries([...data.entries()].map(([key, value]) => [key, String(value).trim()]));
}

function setLeadDialogMode(lead) {
  state.editingLeadId = normalizeId(lead?.id);
  els.leadForm.reset();
  for (const control of els.leadForm.elements) {
    if (!control.name) continue;
    control.value = lead?.[control.name] || control.defaultValue || '';
  }
  if (lead?.next_follow_up_at) {
    const date = new Date(lead.next_follow_up_at);
    if (!Number.isNaN(date.getTime())) {
      els.leadForm.elements.next_follow_up_at.value = date.toISOString().slice(0, 16);
    }
  }
  openDialog(els.leadDialog);
}

async function saveLead(event) {
  event.preventDefault();
  const input = formPayload(els.leadForm);
  if (input.next_follow_up_at) input.next_follow_up_at = new Date(input.next_follow_up_at).toISOString();
  await withAction(async () => {
    const path = state.editingLeadId ? `/api/leads/${state.editingLeadId}` : '/api/leads';
    const method = state.editingLeadId ? 'PUT' : 'POST';
    const payload = await api(path, {
      method,
      body: JSON.stringify({
        ...input,
        status: input.status || 'New',
        owner_name: input.owner_name || 'Default'
      })
    });
    state.selectedLeadId = normalizeId(payload.lead?.id);
    els.leadForm.reset();
    els.leadDialog.close();
    await loadData({ silent: true });
  }, '线索已保存。');
}

async function generateDraft() {
  if (!state.selectedLeadId) {
    setNotice('请先选择客户。', 'error');
    return;
  }
  renderDraftProductSelect();
  renderDraftTemplateSelect();
  els.draftProductForm.reset();
  syncDraftModeControls();
  openDialog(els.draftProductDialog);
}

async function createDraftWithProduct(event) {
  event.preventDefault();
  if (!state.selectedLeadId) {
    setNotice('请先选择客户。', 'error');
    return;
  }
  const input = formPayload(els.draftProductForm);
  const generationMode = input.generation_mode === 'template' ? 'template' : 'ai';
  await withAction(async () => {
    const payload = await api('/api/drafts/generate', {
      method: 'POST',
      body: JSON.stringify({
        lead_id: state.selectedLeadId,
        generation_mode: generationMode,
        template_id: generationMode === 'template' ? input.template_id : '',
        product_id: input.product_id || ''
      })
    });
    state.selectedDraftId = normalizeId(payload.draft?.id);
    els.draftProductDialog.close();
    await loadData({ silent: true });
  }, '英文邮件草稿已生成。');
}

function syncDraftModeControls() {
  const useTemplate = els.draftModeSelect.value === 'template';
  els.draftTemplateSelect.disabled = !useTemplate;
}

async function generateFollowupDraft(leadId, templateName) {
  await withAction(async () => {
    const payload = await api('/api/followups/draft', {
      method: 'POST',
      body: JSON.stringify({ lead_id: leadId, template_name: templateName })
    });
    state.selectedLeadId = leadId;
    state.selectedDraftId = normalizeId(payload.draft?.id);
    await loadData({ silent: true });
    document.querySelector('#draftSection')?.scrollIntoView({ block: 'start' });
  }, '跟进邮件草稿已生成。');
}

async function persistDraft() {
  const draft = selectedDraft();
  if (!draft) return;
  const subject = document.querySelector('#draftSubject').value.trim();
  const body = document.querySelector('#draftBody').value.trim();
  const payload = await api(`/api/drafts/${draft.id}`, {
    method: 'PUT',
    body: JSON.stringify({ subject, body, status: draft.status || 'Draft' })
  });
  state.selectedDraftId = normalizeId(payload.draft?.id || draft.id);
  await loadData({ silent: true });
}

async function saveDraft() {
  if (!selectedDraft()) return;
  await withAction(async () => {
    await persistDraft();
  }, '草稿已保存。');
}

async function copyDraft() {
  const draft = selectedDraft();
  if (!draft) return;
  const subject = document.querySelector('#draftSubject').value;
  const body = document.querySelector('#draftBody').value;
  try {
    await navigator.clipboard.writeText(`${subject}\n\n${body}`);
    setNotice('邮件内容已复制。', 'success');
  } catch {
    setNotice('浏览器未允许剪贴板写入，请手动复制正文。', 'error');
  }
}

async function sendDraft() {
  const draft = selectedDraft();
  if (!draft) return;
  const lead = selectedLead();
  if (isEuropeRegion(`${lead?.market_region || ''} ${lead?.country_region || ''}`)) {
    const confirmed = window.confirm('欧洲客户联系前请确认来源记录、退订说明和联系必要性。确认继续发送？');
    if (!confirmed) {
      setNotice('已取消发送。');
      return;
    }
  }
  await withAction(async () => {
    await persistDraft();
    await api(`/api/drafts/${draft.id}/send`, { method: 'POST' });
    await loadData({ silent: true });
  }, '单封邮件已发送。');
}

async function saveSettings(event) {
  event.preventDefault();
  const input = formPayload(els.settingsForm);
  const settings = {};
  for (const [key, value] of Object.entries(input)) {
    if ((key === 'SMTP_PASS' || key === 'AI_API_KEY') && !value) continue;
    settings[key] = {
      value,
      is_secret: key === 'SMTP_PASS' || key === 'AI_API_KEY'
    };
  }
  await withAction(async () => {
    await api('/api/settings', {
      method: 'PUT',
      body: JSON.stringify({ settings })
    });
    await loadData({ silent: true });
  }, '系统设置已保存。');
}

function setProductDialogMode(product) {
  state.editingProductId = normalizeId(product?.id);
  els.productDialogTitle.textContent = product ? '编辑产品资料' : '新增产品资料';
  els.productForm.reset();
  for (const control of els.productForm.elements) {
    if (!control.name) continue;
    control.value = product?.[control.name] || control.defaultValue || '';
  }
  openDialog(els.productDialog);
}

async function saveProduct(event) {
  event.preventDefault();
  const input = formPayload(els.productForm);
  const isEditing = Boolean(state.editingProductId);
  await withAction(async () => {
    const path = state.editingProductId ? `/api/products/${state.editingProductId}` : '/api/products';
    const method = state.editingProductId ? 'PUT' : 'POST';
    await api(path, {
      method,
      body: JSON.stringify(input)
    });
    els.productForm.reset();
    state.editingProductId = null;
    els.productDialog.close();
    await loadData({ silent: true });
  }, isEditing ? '产品资料已更新。' : '产品资料已保存。');
}

async function importCsvSourcedLeads(event) {
  event.preventDefault();
  const input = formPayload(els.sourceCsvForm);
  if (!input.csv_text) {
    setNotice('请先粘贴CSV内容。', 'error');
    return;
  }
  await withAction(async () => {
    const payload = await api('/api/sourced-leads/import-csv', {
      method: 'POST',
      body: JSON.stringify(input)
    });
    els.sourceCsvForm.elements.csv_text.value = '';
    await loadData({ silent: true });
    setNotice(`已导入 ${payload.created.length} 条采集线索，跳过 ${payload.skipped.length} 条重复。`, 'success');
  });
}

async function collectUrlSourcedLeads(event) {
  event.preventDefault();
  const input = formPayload(els.sourceUrlForm);
  if (!input.urls) {
    setNotice('请先输入公开URL。', 'error');
    return;
  }
  await withAction(async () => {
    const payload = await api('/api/sourced-leads/collect-url', {
      method: 'POST',
      body: JSON.stringify(input)
    });
    els.sourceUrlForm.elements.urls.value = '';
    await loadData({ silent: true });
    const errorText = payload.errors.length ? `，失败 ${payload.errors.length} 条` : '';
    setNotice(`已采集 ${payload.created.length} 条，跳过 ${payload.skipped.length} 条重复${errorText}。`, payload.errors.length ? '' : 'success');
  });
}

async function crawlSiteSourcedLeads(event) {
  event.preventDefault();
  const input = formPayload(els.sourceCrawlerForm);
  if (!input.urls) {
    setNotice('请先输入起始URL。', 'error');
    return;
  }
  await withAction(async () => {
    const payload = await api('/api/sourced-leads/crawl-site', {
      method: 'POST',
      body: JSON.stringify(input)
    });
    els.sourceCrawlerForm.elements.urls.value = '';
    await loadData({ silent: true });
    const errorText = payload.errors.length ? `，失败 ${payload.errors.length} 个站点` : '';
    setNotice(`爬虫已生成 ${payload.created.length} 条线索，跳过 ${payload.skipped.length} 条重复${errorText}。`, payload.errors.length ? '' : 'success');
  });
}

async function importSourcedLead(id) {
  await withAction(async () => {
    const payload = await api(`/api/sourced-leads/${id}/import`, { method: 'POST' });
    state.selectedLeadId = normalizeId(payload.lead?.id);
    await loadData({ silent: true });
    document.querySelector('#leadSection')?.scrollIntoView({ block: 'start' });
  }, '采集线索已导入CRM。');
}

async function deleteSourcedLead(id) {
  const sourcedLead = state.sourcedLeads.find((item) => normalizeId(item.id) === id);
  if (!sourcedLead) return;
  const confirmed = window.confirm(`确认删除采集线索“${sourcedLead.company_name || sourcedLead.website || sourcedLead.source_url}”？`);
  if (!confirmed) return;
  await withAction(async () => {
    await api(`/api/sourced-leads/${id}`, { method: 'DELETE' });
    await loadData({ silent: true });
  }, '采集线索已删除。');
}

async function deleteProduct(id) {
  const product = state.products.find((item) => normalizeId(item.id) === id);
  if (!product) return;
  const confirmed = window.confirm(`确认删除产品资料“${product.product_name || product.product_category}”？历史草稿不会受影响。`);
  if (!confirmed) return;
  await withAction(async () => {
    await api(`/api/products/${id}`, { method: 'DELETE' });
    await loadData({ silent: true });
  }, '产品资料已删除。');
}

function setTemplateDialogMode(template) {
  state.editingTemplateId = normalizeId(template?.id);
  els.templateDialogTitle.textContent = template ? '编辑邮件模板' : '新增邮件模板';
  els.templateForm.reset();
  for (const control of els.templateForm.elements) {
    if (!control.name) continue;
    control.value = template?.[control.name] || control.defaultValue || '';
  }
  openDialog(els.templateDialog);
}

async function saveTemplate(event) {
  event.preventDefault();
  const input = formPayload(els.templateForm);
  const isEditing = Boolean(state.editingTemplateId);
  await withAction(async () => {
    const path = state.editingTemplateId ? `/api/templates/${state.editingTemplateId}` : '/api/templates';
    const method = state.editingTemplateId ? 'PUT' : 'POST';
    await api(path, {
      method,
      body: JSON.stringify(input)
    });
    els.templateForm.reset();
    state.editingTemplateId = null;
    els.templateDialog.close();
    await loadData({ silent: true });
  }, isEditing ? '邮件模板已更新。' : '邮件模板已新增。');
}

async function deleteTemplate(id) {
  const template = state.templates.find((item) => normalizeId(item.id) === id);
  if (!template) return;
  const confirmed = window.confirm(`确认删除邮件模板“${template.label || template.template_key}”？`);
  if (!confirmed) return;
  await withAction(async () => {
    await api(`/api/templates/${id}`, { method: 'DELETE' });
    await loadData({ silent: true });
  }, '邮件模板已删除。');
}

function openDialog(dialog) {
  if (typeof dialog.showModal === 'function') {
    dialog.showModal();
  } else {
    setNotice('当前浏览器不支持弹窗表单。', 'error');
  }
}

function bindEvents() {
  document.querySelector('#addLeadButton').addEventListener('click', () => setLeadDialogMode(null));
  document.querySelector('#editLeadButton').addEventListener('click', () => {
    const lead = selectedLead();
    if (!lead) return setNotice('请先选择客户。', 'error');
    setLeadDialogMode(lead);
  });
  document.querySelector('#addProductButton').addEventListener('click', () => setProductDialogMode(null));
  document.querySelector('#addTemplateButton').addEventListener('click', () => setTemplateDialogMode(null));
  document.querySelector('#generateDraftButton').addEventListener('click', generateDraft);
  document.querySelector('#refreshButton').addEventListener('click', () => withAction(() => loadData({ silent: true }), '数据已刷新。'));
  els.leadForm.addEventListener('submit', saveLead);
  els.productForm.addEventListener('submit', saveProduct);
  els.sourceCsvForm.addEventListener('submit', importCsvSourcedLeads);
  els.sourceUrlForm.addEventListener('submit', collectUrlSourcedLeads);
  els.sourceCrawlerForm.addEventListener('submit', crawlSiteSourcedLeads);
  els.sourceCsvFile.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    els.sourceCsvForm.elements.csv_text.value = await file.text();
    event.target.value = '';
  });
  els.draftProductForm.addEventListener('submit', createDraftWithProduct);
  els.draftModeSelect.addEventListener('change', syncDraftModeControls);
  els.templateForm.addEventListener('submit', saveTemplate);
  els.settingsForm.addEventListener('submit', saveSettings);
  els.searchInput.addEventListener('input', (event) => {
    state.search = event.target.value;
    renderLeadTable();
  });
  els.regionFilter.addEventListener('change', (event) => {
    state.region = event.target.value;
    renderLeadTable();
  });
  document.querySelectorAll('[data-close-dialog]').forEach((button) => {
    button.addEventListener('click', () => document.querySelector(`#${button.dataset.closeDialog}`)?.close());
  });
  document.querySelectorAll('.nav-item[data-target]').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach((item) => item.classList.remove('active'));
      button.classList.add('active');
      document.querySelector(`#${button.dataset.target}`)?.scrollIntoView({ block: 'start' });
    });
  });
}

function renderInitialState() {
  render();
  setNotice('正在连接本地API。');
}

bindEvents();
renderInitialState();
loadData().catch((error) => {
  state.leads = [];
  state.drafts = [];
  state.events = [];
  state.products = [];
  state.followups = [];
  state.templates = [];
  state.settings = [];
  render();
  setNotice(`无法加载API数据：${error.message}`, 'error');
});
