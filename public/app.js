const state = {
  leads: [],
  drafts: [],
  events: [],
  products: [],
  followups: [],
  templates: [],
  settings: [],
  selectedLeadId: null,
  selectedDraftId: null,
  editingLeadId: null,
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
  followupList: document.querySelector('#followupList'),
  templateList: document.querySelector('#templateList'),
  settingsForm: document.querySelector('#settingsForm'),
  searchInput: document.querySelector('#searchInput'),
  regionFilter: document.querySelector('#regionFilter'),
  leadDialog: document.querySelector('#leadDialog'),
  leadForm: document.querySelector('#leadForm'),
  productDialog: document.querySelector('#productDialog'),
  productForm: document.querySelector('#productForm')
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
      <td style="width: 18%">${escapeHtml(product.product_category || '')}</td>
      <td style="width: 18%">${escapeHtml(product.product_name || '待补充')}</td>
      <td style="width: 24%">${escapeHtml(product.product_type || '')}</td>
      <td style="width: 25%">${escapeHtml(product.main_applications || '')}</td>
      <td style="width: 15%">${escapeHtml(product.internal_notes || '')}</td>
    </tr>
  `).join('');

  els.productList.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>产品类别</th>
          <th>产品名称</th>
          <th>产品类型</th>
          <th>主要用途</th>
          <th>内部备注</th>
        </tr>
      </thead>
      <tbody>${rows || '<tr><td colspan="5"><p class="empty">暂无产品资料。</p></td></tr>'}</tbody>
    </table>
  `;
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
      <thead><tr><th>模板键</th><th>用途</th></tr></thead>
      <tbody>
        ${state.templates.map((template) => `
          <tr><td>${escapeHtml(template.key)}</td><td>${escapeHtml(template.label)}</td></tr>
        `).join('') || '<tr><td colspan="2"><p class="empty">模板加载中。</p></td></tr>'}
      </tbody>
    </table>
  `;
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
  renderProducts();
  renderFollowups();
  renderTemplates();
  fillSettingsForm();
}

async function loadData({ silent = false } = {}) {
  if (!silent) setNotice('');
  const [leadPayload, draftPayload, productPayload, followupPayload, templatePayload, settingPayload] = await Promise.all([
    api('/api/leads'),
    api('/api/drafts'),
    api('/api/products'),
    api('/api/followups'),
    api('/api/templates'),
    api('/api/settings')
  ]);
  state.leads = leadPayload.leads || [];
  state.drafts = draftPayload.drafts || [];
  state.products = productPayload.products || [];
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
  await withAction(async () => {
    const payload = await api('/api/drafts/generate', {
      method: 'POST',
      body: JSON.stringify({ lead_id: state.selectedLeadId })
    });
    state.selectedDraftId = normalizeId(payload.draft?.id);
    await loadData({ silent: true });
  }, '英文邮件草稿已生成。');
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

async function addProduct(event) {
  event.preventDefault();
  const input = formPayload(els.productForm);
  await withAction(async () => {
    await api('/api/products', {
      method: 'POST',
      body: JSON.stringify(input)
    });
    els.productForm.reset();
    els.productDialog.close();
    await loadData({ silent: true });
  }, '产品资料已保存。');
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
  document.querySelector('#addProductButton').addEventListener('click', () => openDialog(els.productDialog));
  document.querySelector('#generateDraftButton').addEventListener('click', generateDraft);
  document.querySelector('#refreshButton').addEventListener('click', () => withAction(() => loadData({ silent: true }), '数据已刷新。'));
  els.leadForm.addEventListener('submit', saveLead);
  els.productForm.addEventListener('submit', addProduct);
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
