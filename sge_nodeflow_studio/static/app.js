const state = {
  nodeTypes: {},
  workflows: [],
  currentWorkflowId: null,
  currentWorkflow: null,
  connectingFrom: null,
  selectedNodeId: null,
};

const $ = (id) => document.getElementById(id);

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

function randomNodeId() {
  return `n-${Math.random().toString(36).slice(2, 8)}`;
}

function defaultConfigByType(type) {
  if (type === 'order_input') return { channel: 'web' };
  if (type === 'stock_check') return { warehouse: 'MAD-01' };
  if (type === 'notify') return { channel: 'email' };
  if (type === 'ai_summary') return { tone: 'profesional' };
  return {};
}

function getNodeById(nodeId) {
  return getCanvas().nodes.find((n) => n.id === nodeId) || null;
}

function updateConnectionUI() {
  const help = $('connection-help');
  const pill = $('connection-pill');
  if (!state.connectingFrom) {
    help.textContent = 'Pulsa “Conectar” en un nodo origen y luego en nodo destino.';
    pill.textContent = 'Modo normal';
    pill.className = 'pill';
    return;
  }
  const sourceNode = getNodeById(state.connectingFrom);
  const sourceLabel = sourceNode?.label || state.connectingFrom;
  help.textContent = `Origen seleccionado: ${sourceLabel}. Elige nodo destino.`;
  pill.textContent = 'Modo conectar';
  pill.className = 'pill connecting';
}

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
    card.innerHTML = `<strong>${item.name}</strong><div>${item.description || 'Sin descripción'}</div>`;
    card.addEventListener('click', () => loadWorkflow(item.id));
    list.appendChild(card);
  }
}

function renderPalette() {
  const palette = $('node-palette');
  palette.innerHTML = '';
  Object.entries(state.nodeTypes).forEach(([type, label]) => {
    const item = document.createElement('article');
    item.className = 'palette-item';
    item.innerHTML = `<span>${label}</span>`;

    const btn = document.createElement('button');
    btn.className = 'btn-mini';
    btn.textContent = 'Añadir';
    btn.addEventListener('click', () => addNode(type, label));

    item.appendChild(btn);
    palette.appendChild(item);
  });
}

function getCanvas() {
  return state.currentWorkflow?.canvas || { nodes: [], edges: [] };
}

function addNode(type, label) {
  if (!state.currentWorkflow) return;
  const canvas = getCanvas();
  const canvasEl = $('canvas');
  const width = Math.max(canvasEl.clientWidth || 900, 900);
  const columns = Math.max(Math.floor(width / 280), 1);
  const idx = canvas.nodes.length;
  canvas.nodes.push({
    id: randomNodeId(),
    type,
    label,
    x: 80 + (idx % columns) * 260,
    y: 90 + Math.floor(idx / columns) * 160,
    config: defaultConfigByType(type),
  });
  state.selectedNodeId = canvas.nodes[canvas.nodes.length - 1].id;
  renderCanvas();
}

function loadDemoFlow() {
  if (!state.currentWorkflow) return;
  state.currentWorkflow.canvas = {
    nodes: [
      {
        id: 'n-demo-trigger',
        type: 'trigger',
        label: 'Inicio (Webhook)',
        x: 80,
        y: 120,
        config: {},
      },
      {
        id: 'n-demo-order',
        type: 'order_input',
        label: 'Captura pedido web',
        x: 360,
        y: 120,
        config: { channel: 'web' },
      },
      {
        id: 'n-demo-stock',
        type: 'stock_check',
        label: 'Consultar stock ERP',
        x: 640,
        y: 120,
        config: { warehouse: 'MAD-01' },
      },
      {
        id: 'n-demo-ai',
        type: 'ai_summary',
        label: 'Resumen IA para dirección',
        x: 640,
        y: 300,
        config: { tone: 'ejecutivo' },
      },
      {
        id: 'n-demo-notify',
        type: 'notify',
        label: 'Notificar cliente',
        x: 920,
        y: 120,
        config: { channel: 'email' },
      },
    ],
    edges: [
      { id: 'e-demo-1', source: 'n-demo-trigger', target: 'n-demo-order' },
      { id: 'e-demo-2', source: 'n-demo-order', target: 'n-demo-stock' },
      { id: 'e-demo-3', source: 'n-demo-stock', target: 'n-demo-ai' },
      { id: 'e-demo-4', source: 'n-demo-ai', target: 'n-demo-notify' },
    ],
  };
  state.selectedNodeId = 'n-demo-ai';
  state.connectingFrom = null;
  renderCanvas();
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

function startOrCompleteConnection(nodeId) {
  if (!state.currentWorkflow) return;
  const canvas = getCanvas();

  if (!state.connectingFrom) {
    state.connectingFrom = nodeId;
    renderCanvas();
    return;
  }

  if (state.connectingFrom === nodeId) {
    state.connectingFrom = null;
    renderCanvas();
    return;
  }

  const duplicate = canvas.edges.some(
    (edge) => edge.source === state.connectingFrom && edge.target === nodeId
  );

  if (!duplicate) {
    canvas.edges.push({
      id: `e-${Math.random().toString(36).slice(2, 8)}`,
      source: state.connectingFrom,
      target: nodeId,
    });
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

function renderEdgesSvg() {
  const svg = $('edge-layer');
  svg.innerHTML = '';

  const canvasEl = $('canvas');
  const canvasRect = canvasEl.getBoundingClientRect();
  const nodeMap = new Map();

  canvasEl.querySelectorAll('.node-card').forEach((el) => {
    const id = el.dataset.nodeId;
    const rect = el.getBoundingClientRect();
    nodeMap.set(id, {
      x: rect.left - canvasRect.left,
      y: rect.top - canvasRect.top,
      width: rect.width,
      height: rect.height,
    });
  });

  const canvas = getCanvas();
  canvas.edges.forEach((edge) => {
    const src = nodeMap.get(edge.source);
    const tgt = nodeMap.get(edge.target);
    if (!src || !tgt) return;

    const x1 = src.x + src.width;
    const y1 = src.y + src.height / 2;
    const x2 = tgt.x;
    const y2 = tgt.y + tgt.height / 2;

    const cx1 = x1 + 70;
    const cx2 = x2 - 70;

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('class', 'edge-path');
    path.setAttribute('d', `M ${x1} ${y1} C ${cx1} ${y1}, ${cx2} ${y2}, ${x2} ${y2}`);
    svg.appendChild(path);
  });
}

function makeDraggable(card, node) {
  let isDragging = false;
  let offsetX = 0;
  let offsetY = 0;

  const onMove = (ev) => {
    if (!isDragging) return;
    const canvasRect = $('canvas').getBoundingClientRect();
    node.x = Math.max(10, ev.clientX - offsetX - canvasRect.left);
    node.y = Math.max(10, ev.clientY - offsetY - canvasRect.top);
    card.style.left = `${node.x}px`;
    card.style.top = `${node.y}px`;
    renderEdgesSvg();
  };

  const stopDrag = () => {
    if (!isDragging) return;
    isDragging = false;
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', stopDrag);
  };

  card.addEventListener('mousedown', (ev) => {
    if (ev.target.closest('button')) return;
    isDragging = true;
    const rect = card.getBoundingClientRect();
    offsetX = ev.clientX - rect.left;
    offsetY = ev.clientY - rect.top;
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', stopDrag);
  });
}

function renderEdgesList() {
  const list = $('edge-list');
  list.innerHTML = '';
  const canvas = getCanvas();
  const labels = new Map(canvas.nodes.map((n) => [n.id, n.label]));

  canvas.edges.forEach((edge) => {
    const row = document.createElement('article');
    row.className = 'edge-item';
    row.innerHTML = `<div><strong>${labels.get(edge.source) || edge.source}</strong> → <strong>${labels.get(edge.target) || edge.target}</strong></div>`;

    const btn = document.createElement('button');
    btn.className = 'btn-mini danger';
    btn.textContent = 'Eliminar';
    btn.addEventListener('click', () => removeEdge(edge.id));

    row.appendChild(btn);
    list.appendChild(row);
  });
}

function renderCanvas() {
  const canvasEl = $('canvas');
  canvasEl.innerHTML = '';

  const canvas = getCanvas();
  const template = document.getElementById('node-template');

  canvas.nodes.forEach((node) => {
    const fragment = template.content.cloneNode(true);
    const card = fragment.querySelector('.node-card');

    card.dataset.nodeId = node.id;
    card.style.left = `${node.x}px`;
    card.style.top = `${node.y}px`;

    fragment.querySelector('.tag').textContent = state.nodeTypes[node.type] || node.type;
    fragment.querySelector('.node-label').textContent = node.label;
    fragment.querySelector('.node-id').textContent = node.id;

    const connectBtn = fragment.querySelector('.connect');
    const deleteBtn = fragment.querySelector('.delete');

    card.addEventListener('click', (ev) => {
      if (ev.target.closest('button')) return;
      state.selectedNodeId = node.id;
      renderCanvas();
    });

    connectBtn.addEventListener('click', () => startOrCompleteConnection(node.id));
    deleteBtn.addEventListener('click', () => deleteNode(node.id));

    if (state.connectingFrom === node.id) {
      card.classList.add('connecting');
    }

    if (state.selectedNodeId === node.id) {
      card.classList.add('selected');
    }

    makeDraggable(card, node);
    canvasEl.appendChild(fragment);
  });

  updateConnectionUI();
  renderInspector();
  renderEdgesList();
  requestAnimationFrame(renderEdgesSvg);
}

function applyNodeEdits() {
  if (!state.selectedNodeId) return;
  const node = getNodeById(state.selectedNodeId);
  if (!node) return;

  node.label = $('inp-node-label').value.trim() || node.label;

  try {
    const raw = $('inp-node-config').value.trim();
    node.config = raw ? JSON.parse(raw) : {};
  } catch (_error) {
    alert('La configuración JSON no es válida');
    return;
  }

  renderCanvas();
}

function renderRunResult(result) {
  const status = $('run-status');
  const steps = $('run-steps');

  status.textContent = result.status === 'ok' ? 'Ejecución correcta' : 'Error en ejecución';
  status.className = 'badge ' + (result.status === 'ok' ? 'ok' : 'error');

  steps.innerHTML = '';
  result.steps.forEach((step) => {
    const row = document.createElement('article');
    row.className = 'step-item';
    row.innerHTML = `<strong>Paso ${step.step}: ${step.nodeLabel}</strong><div>${step.message}</div>`;
    steps.appendChild(row);
  });
}

async function refreshRuns() {
  if (!state.currentWorkflowId) return;
  const data = await api(`/api/workflows/${state.currentWorkflowId}/runs`);
  if (!data.items.length) return;
  renderRunResult(data.items[0].summary);
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
}

async function runCurrentWorkflow() {
  if (!state.currentWorkflowId) return;
  await saveCurrentWorkflow();
  const data = await api(`/api/workflows/${state.currentWorkflowId}/run`, { method: 'POST' });
  renderRunResult(data.result);
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
  await api('/api/workflows', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
  input.value = '';
  await loadWorkflows();
}

async function boot() {
  const typeData = await api('/api/node-types');
  state.nodeTypes = typeData.types;
  renderPalette();

  $('btn-new-workflow').addEventListener('click', createWorkflow);
  $('btn-save').addEventListener('click', saveCurrentWorkflow);
  $('btn-run').addEventListener('click', runCurrentWorkflow);
  $('btn-demo-flow').addEventListener('click', loadDemoFlow);
  $('btn-apply-node').addEventListener('click', applyNodeEdits);

  await loadWorkflows();
}

boot().catch((err) => {
  $('editor-subtitle').textContent = `Error de carga: ${err.message}`;
});
