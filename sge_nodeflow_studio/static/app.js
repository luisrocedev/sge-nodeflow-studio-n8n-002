/* ══════════════════════════════════════════════════════
   SGE NodeFlow Studio — n8n-inspired frontend
   ══════════════════════════════════════════════════════ */

const state = {
  nodeTypes: {},
  workflows: [],
  currentWorkflowId: null,
  currentWorkflow: null,
  connectingFrom: null,
  selectedNodeId: null,
  zoom: 1,
};

const $ = (id) => document.getElementById(id);

/* ── Node visual config (n8n style) ────────────────── */

const NODE_COLORS = {
  trigger:            '#ff6d5a',
  order_input:        '#3b82f6',
  customer_check:     '#06b6d4',
  stock_check:        '#f59e0b',
  finance_approval:   '#8b5cf6',
  invoice:            '#10b981',
  notify:             '#06b6d4',
  archive:            '#6b7280',
  ai_summary:         '#ec4899',
  conditional_check:  '#eab308',
  data_transform:     '#a855f7',
};

const NODE_ICONS = {
  trigger:            '\u26A1',
  order_input:        '\uD83D\uDCE6',
  customer_check:     '\uD83D\uDC64',
  stock_check:        '\uD83D\uDCCA',
  finance_approval:   '\uD83D\uDCB0',
  invoice:            '\uD83E\uDDFE',
  notify:             '\uD83D\uDCE7',
  archive:            '\uD83D\uDDC4\uFE0F',
  ai_summary:         '\uD83E\uDD16',
  conditional_check:  '\u2753',
  data_transform:     '\uD83D\uDD04',
};

/* ── Toast notifications ─────────────────────────────── */

function showToast(message, type = 'info') {
  const container = $('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 2600);
}

/* ── API helper ──────────────────────────────────────── */

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error(data.error || 'Error de API');
  }
  return data;
}

/* ── Utilities ───────────────────────────────────────── */

function randomNodeId() {
  return `n-${Math.random().toString(36).slice(2, 8)}`;
}

function defaultConfigByType(type) {
  const configs = {
    order_input:       { channel: 'web' },
    stock_check:       { warehouse: 'MAD-01' },
    notify:            { channel: 'email' },
    ai_summary:        { tone: 'profesional' },
    conditional_check: { condition: 'amount > 100' },
    data_transform:    { format: 'JSON' },
  };
  return configs[type] || {};
}

function getNodeById(nodeId) {
  return getCanvas().nodes.find((n) => n.id === nodeId) || null;
}

function getCanvas() {
  return state.currentWorkflow?.canvas || { nodes: [], edges: [] };
}

/* ── Connection UI ───────────────────────────────────── */

function updateConnectionUI() {
  const help = $('connection-help');
  const pill = $('connection-pill');
  if (!state.connectingFrom) {
    help.textContent = 'Haz clic en el puerto de salida y luego en el puerto de entrada.';
    pill.textContent = 'Modo normal';
    pill.className = 'pill';
    return;
  }
  const sourceNode = getNodeById(state.connectingFrom);
  const sourceLabel = sourceNode?.label || state.connectingFrom;
  help.textContent = `Conectando desde: ${sourceLabel}`;
  pill.textContent = 'Conectando...';
  pill.className = 'pill connecting';
}

/* ── Inspector ───────────────────────────────────────── */

function renderInspector() {
  const empty = $('inspector-empty');
  const form = $('inspector-form');
  if (!state.selectedNodeId) {
    empty.classList.remove('hidden');
    form.classList.add('hidden');
    return;
  }
  const node = getNodeById(state.selectedNodeId);
  if (!node) {
    state.selectedNodeId = null;
    empty.classList.remove('hidden');
    form.classList.add('hidden');
    return;
  }
  empty.classList.add('hidden');
  form.classList.remove('hidden');
  $('inp-node-type').value = state.nodeTypes[node.type] || node.type;
  $('inp-node-label').value = node.label || '';
  $('inp-node-config').value = JSON.stringify(node.config || {}, null, 2);
}

function applyNodeEdits() {
  if (!state.selectedNodeId) return;
  const node = getNodeById(state.selectedNodeId);
  if (!node) return;
  node.label = $('inp-node-label').value.trim() || node.label;
  try {
    const raw = $('inp-node-config').value.trim();
    node.config = raw ? JSON.parse(raw) : {};
  } catch (_) {
    showToast('JSON no valido', 'danger');
    return;
  }
  renderCanvas();
}

/* ── Header / Lists ──────────────────────────────────── */

function updateHeader() {
  const title = $('editor-title');
  const subtitle = $('editor-subtitle');
  if (!state.currentWorkflow) {
    title.textContent = 'Sin flujo seleccionado';
    subtitle.textContent = 'Selecciona o crea un flujo para empezar.';
    return;
  }
  title.textContent = state.currentWorkflow.name;
  subtitle.textContent = state.currentWorkflow.description || 'Editor visual activo';
}

function renderWorkflowList() {
  const list = $('workflow-list');
  list.innerHTML = '';
  for (const item of state.workflows) {
    const card = document.createElement('article');
    card.className = 'workflow-item' + (item.id === state.currentWorkflowId ? ' active' : '');
    card.innerHTML = `
      <div class="workflow-item-body">
        <strong>${item.name}</strong>
        <div>${item.description || 'Sin descripcion'}</div>
      </div>
      <div class="workflow-item-actions">
        <button class="btn-mini" data-dup="${item.id}" title="Duplicar">\u29C9</button>
        <button class="btn-mini danger" data-del="${item.id}" title="Eliminar">\u2715</button>
      </div>`;
    card.addEventListener('click', (ev) => {
      if (ev.target.closest('button')) return;
      loadWorkflow(item.id);
    });
    card.querySelector(`[data-del="${item.id}"]`).addEventListener('click', () => deleteWorkflow(item.id));
    card.querySelector(`[data-dup="${item.id}"]`).addEventListener('click', () => duplicateWorkflow(item.id));
    list.appendChild(card);
  }
}

function renderPalette() {
  const palette = $('node-palette');
  palette.innerHTML = '';
  Object.entries(state.nodeTypes).forEach(([type, label]) => {
    const item = document.createElement('article');
    item.className = 'palette-item';
    const color = NODE_COLORS[type] || '#6b7280';
    const icon = NODE_ICONS[type] || '\u2B21';
    item.innerHTML = `
      <div class="palette-icon" style="background: ${color}15; border: 1px solid ${color}30">${icon}</div>
      <span class="palette-label">${label}</span>
      <button class="palette-add">+ Anadir</button>`;
    item.querySelector('.palette-add').addEventListener('click', () => addNode(type, label));
    palette.appendChild(item);
  });
}

/* ── Node operations ─────────────────────────────────── */

function addNode(type, label) {
  if (!state.currentWorkflow) return;
  const canvas = getCanvas();
  const wrap = document.querySelector('.canvas-wrap');
  const scrollX = wrap.scrollLeft;
  const scrollY = wrap.scrollTop;
  const centerX = scrollX + wrap.clientWidth / 2 - 100;
  const centerY = scrollY + wrap.clientHeight / 2 - 30;
  const offset = canvas.nodes.length * 30;
  canvas.nodes.push({
    id: randomNodeId(),
    type,
    label,
    x: Math.round((centerX + offset) / state.zoom),
    y: Math.round((centerY + (offset % 120)) / state.zoom),
    config: defaultConfigByType(type),
  });
  state.selectedNodeId = canvas.nodes[canvas.nodes.length - 1].id;
  renderCanvas();
  showToast(`Nodo "${label}" anadido`);
}

function deleteNode(nodeId) {
  if (!state.currentWorkflow) return;
  const canvas = getCanvas();
  canvas.nodes = canvas.nodes.filter((n) => n.id !== nodeId);
  canvas.edges = canvas.edges.filter((e) => e.source !== nodeId && e.target !== nodeId);
  if (state.connectingFrom === nodeId) state.connectingFrom = null;
  if (state.selectedNodeId === nodeId) state.selectedNodeId = null;
  renderCanvas();
}

/* ── Port-based connections (n8n style) ──────────────── */

function startConnection(nodeId) {
  if (!state.currentWorkflow) return;
  state.connectingFrom = nodeId;
  renderCanvas();
}

function completeConnection(nodeId) {
  if (!state.currentWorkflow || !state.connectingFrom) return;
  if (state.connectingFrom === nodeId) {
    state.connectingFrom = null;
    renderCanvas();
    return;
  }
  const canvas = getCanvas();
  const dup = canvas.edges.some(
    (e) => e.source === state.connectingFrom && e.target === nodeId
  );
  if (!dup) {
    canvas.edges.push({
      id: `e-${Math.random().toString(36).slice(2, 8)}`,
      source: state.connectingFrom,
      target: nodeId,
    });
    showToast('Conexion creada');
  }
  state.connectingFrom = null;
  renderCanvas();
}

function removeEdge(edgeId) {
  if (!state.currentWorkflow) return;
  const canvas = getCanvas();
  canvas.edges = canvas.edges.filter((edge) => edge.id !== edgeId);
  renderCanvas();
}

/* ── Demo flow (spider-web layout) ───────────────────── */

function loadDemoFlow() {
  if (!state.currentWorkflow) return;
  state.currentWorkflow.canvas = {
    nodes: [
      { id: 'n-trigger',   type: 'trigger',           label: 'Webhook Inicio',        x: 120, y: 300, config: {} },
      { id: 'n-order',     type: 'order_input',       label: 'Captura pedido',        x: 380, y: 180, config: { channel: 'web' } },
      { id: 'n-customer',  type: 'customer_check',    label: 'Validar cliente CRM',   x: 380, y: 420, config: {} },
      { id: 'n-stock',     type: 'stock_check',       label: 'Consultar stock',       x: 640, y: 100, config: { warehouse: 'MAD-01' } },
      { id: 'n-condition', type: 'conditional_check',  label: 'Stock suficiente?',    x: 640, y: 300, config: { condition: 'stock > 0' } },
      { id: 'n-finance',   type: 'finance_approval',  label: 'Aprobacion financiera', x: 640, y: 500, config: {} },
      { id: 'n-invoice',   type: 'invoice',           label: 'Generar factura',       x: 900, y: 200, config: {} },
      { id: 'n-ai',        type: 'ai_summary',        label: 'Resumen IA direccion',  x: 900, y: 420, config: { tone: 'ejecutivo' } },
      { id: 'n-transform', type: 'data_transform',    label: 'Exportar JSON/XML',     x: 1160, y: 300, config: { format: 'JSON' } },
      { id: 'n-notify',    type: 'notify',            label: 'Notificar cliente',     x: 1420, y: 200, config: { channel: 'whatsapp' } },
      { id: 'n-archive',   type: 'archive',           label: 'Archivar en ERP',       x: 1420, y: 420, config: {} },
    ],
    edges: [
      { id: 'e-1',  source: 'n-trigger',   target: 'n-order' },
      { id: 'e-2',  source: 'n-trigger',   target: 'n-customer' },
      { id: 'e-3',  source: 'n-order',     target: 'n-stock' },
      { id: 'e-4',  source: 'n-order',     target: 'n-condition' },
      { id: 'e-5',  source: 'n-customer',  target: 'n-condition' },
      { id: 'e-6',  source: 'n-customer',  target: 'n-finance' },
      { id: 'e-7',  source: 'n-stock',     target: 'n-invoice' },
      { id: 'e-8',  source: 'n-condition', target: 'n-invoice' },
      { id: 'e-9',  source: 'n-condition', target: 'n-ai' },
      { id: 'e-10', source: 'n-finance',   target: 'n-ai' },
      { id: 'e-11', source: 'n-invoice',   target: 'n-transform' },
      { id: 'e-12', source: 'n-ai',        target: 'n-transform' },
      { id: 'e-13', source: 'n-transform', target: 'n-notify' },
      { id: 'e-14', source: 'n-transform', target: 'n-archive' },
    ],
  };
  state.selectedNodeId = null;
  state.connectingFrom = null;
  renderCanvas();
  showToast('Flujo demo cargado - 11 nodos, 14 conexiones', 'ok');
}

/* ── Edge rendering (SVG Bezier from ports) ──────────── */

function renderEdgesSvg() {
  const svg = $('edge-layer');
  const defs = svg.querySelector('defs');
  svg.innerHTML = '';
  if (defs) svg.appendChild(defs);

  const canvasEl = $('canvas');
  const canvasRect = canvasEl.getBoundingClientRect();
  const portMap = new Map();

  canvasEl.querySelectorAll('.node-card').forEach((card) => {
    const id = card.dataset.nodeId;
    const portOut = card.querySelector('.port-out');
    const portIn = card.querySelector('.port-in');
    if (!portOut || !portIn) return;

    const outRect = portOut.getBoundingClientRect();
    const inRect = portIn.getBoundingClientRect();

    portMap.set(id, {
      outX: outRect.left + outRect.width / 2 - canvasRect.left,
      outY: outRect.top + outRect.height / 2 - canvasRect.top,
      inX: inRect.left + inRect.width / 2 - canvasRect.left,
      inY: inRect.top + inRect.height / 2 - canvasRect.top,
    });
  });

  const canvas = getCanvas();
  canvas.edges.forEach((edge) => {
    const src = portMap.get(edge.source);
    const tgt = portMap.get(edge.target);
    if (!src || !tgt) return;

    const x1 = src.outX;
    const y1 = src.outY;
    const x2 = tgt.inX;
    const y2 = tgt.inY;

    const dx = Math.abs(x2 - x1);
    const cpOffset = Math.max(50, Math.min(dx * 0.45, 180));

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('class', 'edge-path');
    path.setAttribute('d', `M ${x1} ${y1} C ${x1 + cpOffset} ${y1}, ${x2 - cpOffset} ${y2}, ${x2} ${y2}`);
    path.setAttribute('marker-end', 'url(#arrowhead)');
    svg.appendChild(path);
  });
}

/* ── Drag & Drop ─────────────────────────────────────── */

function makeDraggable(card, node) {
  let isDragging = false;
  let offsetX = 0;
  let offsetY = 0;

  const onMove = (ev) => {
    if (!isDragging) return;
    const canvasRect = $('canvas').getBoundingClientRect();
    const newX = Math.max(10, (ev.clientX - offsetX - canvasRect.left) / state.zoom);
    const newY = Math.max(10, (ev.clientY - offsetY - canvasRect.top) / state.zoom);
    node.x = Math.round(newX);
    node.y = Math.round(newY);
    card.style.left = `${node.x}px`;
    card.style.top = `${node.y}px`;
    renderEdgesSvg();
  };

  const stopDrag = () => {
    if (!isDragging) return;
    isDragging = false;
    card.style.zIndex = '';
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', stopDrag);
  };

  card.addEventListener('mousedown', (ev) => {
    if (ev.target.closest('button') || ev.target.closest('.port')) return;
    isDragging = true;
    card.style.zIndex = '100';
    const rect = card.getBoundingClientRect();
    offsetX = ev.clientX - rect.left;
    offsetY = ev.clientY - rect.top;
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', stopDrag);
  });
}

/* ── Edge list (bottom panel) ────────────────────────── */

function renderEdgesList() {
  const list = $('edge-list');
  list.innerHTML = '';
  const canvas = getCanvas();
  const labels = new Map(canvas.nodes.map((n) => [n.id, n.label]));

  canvas.edges.forEach((edge) => {
    const row = document.createElement('article');
    row.className = 'edge-item';
    row.innerHTML = `<div>${labels.get(edge.source) || '?'} \u2192 ${labels.get(edge.target) || '?'}</div>`;
    const btn = document.createElement('button');
    btn.className = 'btn-mini danger';
    btn.textContent = '\u2715';
    btn.addEventListener('click', () => removeEdge(edge.id));
    row.appendChild(btn);
    list.appendChild(row);
  });
}

/* ── Canvas rendering ────────────────────────────────── */

function renderCanvas() {
  const canvasEl = $('canvas');
  canvasEl.innerHTML = '';

  const canvas = getCanvas();
  const template = document.getElementById('node-template');

  canvas.nodes.forEach((node) => {
    const fragment = template.content.cloneNode(true);
    const card = fragment.querySelector('.node-card');
    const color = NODE_COLORS[node.type] || '#6b7280';
    const icon = NODE_ICONS[node.type] || '\u2B21';

    card.dataset.nodeId = node.id;
    card.style.left = `${node.x}px`;
    card.style.top = `${node.y}px`;
    card.style.setProperty('--node-color', color);

    // Color strip
    fragment.querySelector('.node-color-strip').style.background = color;

    // Icon
    const iconEl = fragment.querySelector('.node-icon');
    iconEl.textContent = icon;
    iconEl.style.background = `${color}18`;
    iconEl.style.borderColor = `${color}30`;

    // Labels
    fragment.querySelector('.node-label').textContent = node.label;
    fragment.querySelector('.node-tag').textContent = state.nodeTypes[node.type] || node.type;
    fragment.querySelector('.node-id-label').textContent = node.id;

    // Port events (n8n-style: output -> input)
    const portOut = fragment.querySelector('.port-out');
    const portIn = fragment.querySelector('.port-in');

    portOut.addEventListener('click', (ev) => {
      ev.stopPropagation();
      startConnection(node.id);
    });

    portIn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      if (state.connectingFrom) {
        completeConnection(node.id);
      }
    });

    // Delete
    const deleteBtn = fragment.querySelector('.delete');
    deleteBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      deleteNode(node.id);
      showToast('Nodo eliminado');
    });

    // Select
    card.addEventListener('click', (ev) => {
      if (ev.target.closest('button') || ev.target.closest('.port')) return;
      state.selectedNodeId = node.id;
      renderCanvas();
    });

    // Visual states
    if (state.connectingFrom === node.id) card.classList.add('connecting');
    if (state.selectedNodeId === node.id) card.classList.add('selected');

    makeDraggable(card, node);
    canvasEl.appendChild(fragment);
  });

  updateConnectionUI();
  renderInspector();
  renderEdgesList();
  updateNodeCounter();
  requestAnimationFrame(renderEdgesSvg);
}

/* ── Node counter ────────────────────────────────────── */

function updateNodeCounter() {
  const el = $('node-counter');
  if (!el) return;
  const canvas = getCanvas();
  el.textContent = `${canvas.nodes.length} nodos \u00B7 ${canvas.edges.length} conexiones`;
}

/* ── Run result ──────────────────────────────────────── */

function renderRunResult(result) {
  const status = $('run-status');
  const steps = $('run-steps');
  status.textContent = result.status === 'ok' ? '\u2713 Ejecucion correcta' : '\u2715 Error';
  status.className = 'badge ' + (result.status === 'ok' ? 'ok' : 'error');
  steps.innerHTML = '';
  result.steps.forEach((step) => {
    const row = document.createElement('article');
    row.className = 'step-item';
    row.innerHTML = `<strong>${step.step}. ${step.nodeLabel}</strong><div>${step.message}</div>`;
    steps.appendChild(row);
  });
}

/* ── Workflow management ────────────────────────────── */

async function deleteWorkflow(id) {
  if (!confirm('Eliminar este flujo y todas sus ejecuciones?')) return;
  await api(`/api/workflows/${id}`, { method: 'DELETE' });
  showToast('Flujo eliminado', 'danger');
  if (state.currentWorkflowId === id) {
    state.currentWorkflowId = null;
    state.currentWorkflow = null;
  }
  await loadWorkflows();
}

async function duplicateWorkflow(id) {
  await api(`/api/workflows/${id}/duplicate`, { method: 'POST' });
  showToast('Flujo duplicado');
  await loadWorkflows();
}

async function exportWorkflow() {
  if (!state.currentWorkflowId) return;
  const data = await api(`/api/workflows/${state.currentWorkflowId}/export`);
  const blob = new Blob([JSON.stringify(data.export, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(data.export.name || 'workflow').replace(/\s+/g, '_')}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Flujo exportado como JSON');
}

async function loadStats() {
  try {
    const data = await api('/api/stats');
    const el = $('stats-bar');
    if (!el) return;
    const s = data.stats;
    el.innerHTML = `
      <span class="stat-item">\uD83D\uDCCA ${s.totalWorkflows} flujos</span>
      <span class="stat-item">\u25B6 ${s.totalRuns} ejecuciones</span>
      <span class="stat-item">\uD83E\uDDE9 ${s.nodeTypesAvailable} tipos de nodo</span>`;
  } catch (_) {}
}

async function refreshRuns() {
  if (!state.currentWorkflowId) return;
  try {
    const data = await api(`/api/workflows/${state.currentWorkflowId}/runs`);
    if (data.items.length) renderRunResult(data.items[0].summary);
  } catch (_) {}
}

async function saveCurrentWorkflow() {
  if (!state.currentWorkflow) return;
  await api(`/api/workflows/${state.currentWorkflow.id}`, {
    method: 'PUT',
    body: JSON.stringify({
      name: state.currentWorkflow.name,
      description: state.currentWorkflow.description,
      canvas: state.currentWorkflow.canvas,
    }),
  });
  showToast('Flujo guardado correctamente');
}

async function runCurrentWorkflow() {
  if (!state.currentWorkflowId) return;
  await saveCurrentWorkflow();
  const data = await api(`/api/workflows/${state.currentWorkflowId}/run`, { method: 'POST' });
  renderRunResult(data.result);
  showToast('Ejecucion completada', 'ok');
  loadStats();
}

async function loadWorkflow(id) {
  const data = await api(`/api/workflows/${id}`);
  state.currentWorkflowId = id;
  state.currentWorkflow = data.workflow;
  state.connectingFrom = null;
  state.selectedNodeId = null;
  updateHeader();
  renderWorkflowList();
  renderCanvas();
  await refreshRuns();
}

async function loadWorkflows() {
  const data = await api('/api/workflows');
  state.workflows = data.items;
  renderWorkflowList();
  if (state.workflows.length && !state.currentWorkflowId) {
    await loadWorkflow(state.workflows[0].id);
  }
}

async function createWorkflow() {
  const input = $('workflow-name');
  const name = input.value.trim() || 'Nuevo flujo empresarial';
  await api('/api/workflows', { method: 'POST', body: JSON.stringify({ name }) });
  input.value = '';
  await loadWorkflows();
}

/* ── Zoom controls ───────────────────────────────────── */

function applyZoom() {
  const canvas = $('canvas');
  canvas.style.transform = `scale(${state.zoom})`;
  canvas.style.transformOrigin = '0 0';
  const label = $('zoom-label');
  if (label) label.textContent = `${Math.round(state.zoom * 100)}%`;
  requestAnimationFrame(renderEdgesSvg);
}

function zoomIn()  { state.zoom = Math.min(2, +(state.zoom + 0.1).toFixed(1)); applyZoom(); }
function zoomOut() { state.zoom = Math.max(0.3, +(state.zoom - 0.1).toFixed(1)); applyZoom(); }
function zoomReset() { state.zoom = 1; applyZoom(); }

/* ── Boot ────────────────────────────────────────────── */

async function boot() {
  const typeData = await api('/api/node-types');
  state.nodeTypes = typeData.types;
  renderPalette();

  // Buttons
  $('btn-new-workflow').addEventListener('click', createWorkflow);
  $('btn-save').addEventListener('click', saveCurrentWorkflow);
  $('btn-run').addEventListener('click', runCurrentWorkflow);
  $('btn-demo-flow').addEventListener('click', loadDemoFlow);
  $('btn-apply-node').addEventListener('click', applyNodeEdits);
  $('btn-export')?.addEventListener('click', exportWorkflow);
  $('btn-zoom-in')?.addEventListener('click', zoomIn);
  $('btn-zoom-out')?.addEventListener('click', zoomOut);
  $('btn-zoom-reset')?.addEventListener('click', zoomReset);

  // Mouse wheel zoom on canvas
  document.querySelector('.canvas-wrap')?.addEventListener('wheel', (ev) => {
    if (ev.ctrlKey || ev.metaKey) {
      ev.preventDefault();
      if (ev.deltaY < 0) zoomIn();
      else zoomOut();
    }
  }, { passive: false });

  // Keyboard shortcuts
  document.addEventListener('keydown', (ev) => {
    if (ev.target.closest('input, textarea')) return;
    if (ev.key === 'Delete' || ev.key === 'Backspace') {
      if (state.selectedNodeId) {
        deleteNode(state.selectedNodeId);
        showToast('Nodo eliminado');
      }
    }
    if ((ev.ctrlKey || ev.metaKey) && ev.key === 's') {
      ev.preventDefault();
      saveCurrentWorkflow();
    }
    if (ev.key === 'Escape') {
      if (state.connectingFrom) {
        state.connectingFrom = null;
        renderCanvas();
      }
    }
  });

  // Cancel connection on canvas click
  $('canvas').addEventListener('click', (ev) => {
    if (ev.target === $('canvas') && state.connectingFrom) {
      state.connectingFrom = null;
      renderCanvas();
    }
  });

  await loadWorkflows();
  loadStats();
}

boot().catch((err) => {
  $('editor-subtitle').textContent = `Error de carga: ${err.message}`;
});
