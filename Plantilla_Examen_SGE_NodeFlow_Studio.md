# Plantilla de Examen — SGE NodeFlow Studio

## Datos del alumno

| Campo | Valor |
|-------|-------|
| **Nombre** | Luis Rodríguez Cedeño |
| **DNI** | 53945291X |
| **Asignatura** | Sistemas de Gestión Empresarial (SGE) |
| **Ciclo** | DAM2 · Curso 2025/26 |
| **Proyecto** | SGE NodeFlow Studio — Editor visual de procesos empresariales |

---

## 1. Introducción

SGE NodeFlow Studio es un editor visual de flujos de procesos empresariales inspirado en n8n, desarrollado como aplicación web full-stack con Flask + JavaScript puro + SQLite. Permite crear, conectar y ejecutar nodos de negocio (recepción de pedidos, validación de stock, facturación, etc.) en un lienzo interactivo con drag & drop, conexiones Bézier SVG y ejecución basada en ordenación topológica con trazabilidad completa.

**Stack técnico:** Python 3.11, Flask 3.x, SQLite 3, JavaScript vanilla, CSS3.  
**Puerto:** 5112 · **DB:** `nodeflow.sqlite3` (3 tablas)

---

## 2. Desarrollo técnico

### 2.1 Modelo de datos y persistencia

Se diseñan tres tablas normalizadas para almacenar flujos, ejecuciones y trazas por paso:

```sql
CREATE TABLE workflows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    canvas_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE workflow_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workflow_id INTEGER NOT NULL,
    status TEXT NOT NULL,
    summary_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(workflow_id) REFERENCES workflows(id)
);

CREATE TABLE workflow_run_steps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id INTEGER NOT NULL,
    step_index INTEGER NOT NULL,
    node_id TEXT NOT NULL,
    node_label TEXT NOT NULL,
    node_type TEXT NOT NULL,
    status TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(run_id) REFERENCES workflow_runs(id)
);
```

> **Explicación:** El canvas se serializa como JSON dentro de `canvas_json`, lo que permite almacenar un grafo con nodos y aristas de forma flexible. Cada ejecución genera un `workflow_run` con un resumen, y cada paso individual queda registrado en `workflow_run_steps` para auditoría detallada.

---

### 2.2 Catálogo de nodos empresariales

Se define un diccionario centralizado de tipos de nodo permitidos que funciona como catálogo del sistema:

```python
NODE_TYPES = {
    "trigger": "Inicio",
    "order_input": "Recepción de pedido",
    "customer_check": "Validación cliente",
    "stock_check": "Validación stock",
    "finance_approval": "Aprobación financiera",
    "invoice": "Generación de factura",
    "notify": "Notificación al cliente",
    "archive": "Archivo ERP",
    "ai_summary": "Resumen IA (ejemplo)",
    "conditional_check": "Decisión condicional",
    "data_transform": "Transformación de datos",
}
```

> **Explicación:** El diccionario `NODE_TYPES` actúa como validador: cualquier nodo que se envíe al backend debe tener un `type` que exista en este catálogo. Esto garantiza que solo se permitan nodos de negocio predefinidos y evita inyección de tipos no válidos. El frontend consulta este catálogo vía `/api/node-types` para renderizar la paleta de nodos.

---

### 2.3 Validación del canvas (parse_canvas)

Toda operación de guardado o ejecución pasa por una validación estricta del grafo:

```python
def parse_canvas(payload: dict) -> dict:
    nodes = payload.get("nodes")
    edges = payload.get("edges")
    if not isinstance(nodes, list) or not isinstance(edges, list):
        raise RuntimeError("El canvas debe incluir arrays válidos de nodes y edges")

    validated_nodes = []
    seen_ids = set()
    for node in nodes:
        node_id = str(node.get("id", "")).strip()
        node_type = str(node.get("type", "")).strip()
        if not node_id or not node_type:
            raise RuntimeError("Cada nodo debe tener id y type")
        if node_type not in NODE_TYPES:
            raise RuntimeError(f"Tipo de nodo no permitido: {node_type}")
        if node_id in seen_ids:
            raise RuntimeError(f"Nodo duplicado: {node_id}")
        seen_ids.add(node_id)
        validated_nodes.append({...})

    validated_edges = []
    seen_edges = set()
    for edge in edges:
        source = str(edge.get("source", "")).strip()
        target = str(edge.get("target", "")).strip()
        if source not in seen_ids or target not in seen_ids:
            raise RuntimeError("Todas las conexiones deben apuntar a nodos existentes")
        ...

    return {"nodes": validated_nodes, "edges": validated_edges}
```

> **Explicación:** La función `parse_canvas` implementa cuatro validaciones clave: (1) cada nodo debe tener `id` y `type`, (2) el `type` debe existir en el catálogo `NODE_TYPES`, (3) no puede haber IDs duplicados, (4) las aristas solo pueden conectar nodos que existan en el canvas. Se usan sets (`seen_ids`, `seen_edges`) para detección eficiente de duplicados en O(1).

---

### 2.4 Ordenación topológica (algoritmo de Kahn)

La ejecución del flujo requiere determinar el orden correcto de procesamiento y detectar ciclos:

```python
def topological_order(nodes: list[dict], edges: list[dict]) -> list[str]:
    indegree = {node["id"]: 0 for node in nodes}
    graph = defaultdict(list)

    for edge in edges:
        graph[edge["source"]].append(edge["target"])
        indegree[edge["target"]] += 1

    queue = deque([node_id for node_id, degree in indegree.items() if degree == 0])
    order = []

    while queue:
        current = queue.popleft()
        order.append(current)
        for nxt in graph[current]:
            indegree[nxt] -= 1
            if indegree[nxt] == 0:
                queue.append(nxt)

    if len(order) != len(nodes):
        raise RuntimeError("El flujo contiene ciclos. El editor requiere un grafo acíclico.")

    return order
```

> **Explicación:** Se implementa el algoritmo de Kahn para BFS topológico. Primero se calcula el grado de entrada (`indegree`) de cada nodo. Se inicia la cola con nodos sin dependencias (grado 0). En cada iteración se procesa un nodo, se decrementan los grados de sus sucesores, y si llegan a 0 se añaden a la cola. Si al terminar no se han visitado todos los nodos, significa que existe un ciclo — se lanza excepción. Complejidad: O(V + E).

---

### 2.5 Ejecución de nodos con simulación

Cada tipo de nodo se ejecuta simulando su acción real en un contexto empresarial:

```python
def execute_node(node: dict) -> dict:
    node_type = node["type"]
    label = node["label"]
    config = node.get("config", {})
    t0 = time.perf_counter()

    messages = {
        "trigger": f"Inicio del flujo '{label}'.",
        "order_input": f"Pedido registrado desde canal {config.get('channel', 'web')}.",
        "customer_check": "Cliente verificado en CRM.",
        "stock_check": f"Stock validado en almacén {config.get('warehouse', 'principal')}.",
        "finance_approval": "Aprobación financiera concedida para el pedido.",
        "invoice": "Factura generada y vinculada al pedido.",
        "notify": f"Cliente notificado por {config.get('channel', 'email')}.",
        "conditional_check": f"Condición evaluada: {config.get('condition', 'amount > 0')} → resultado OK.",
        "data_transform": f"Datos transformados con formato {config.get('format', 'JSON')}.",
        ...
    }

    message = messages.get(node_type, f"Nodo ejecutado: {label}.")
    elapsed_ms = round((time.perf_counter() - t0) * 1000, 2)
    return {"status": "ok", "message": message, "duration_ms": elapsed_ms}
```

> **Explicación:** Cada nodo se ejecuta como una simulación que lee parámetros de `config` (canal, almacén, tono, condición, formato). Se mide el tiempo de ejecución con `time.perf_counter()` para obtener duración en milisegundos. Los mensajes son contextuales según el tipo de nodo, lo que permite validar en la traza que cada paso del flujo realizó la acción esperada.

---

### 2.6 Renderizado de conexiones SVG Bézier

Las aristas entre nodos se dibujan como curvas Bézier cúbicas sobre un `<svg>` overlay:

```javascript
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
```

> **Explicación:** Para cada arista se calcula el punto de salida (borde derecho del nodo origen, centrado verticalmente) y el punto de entrada (borde izquierdo del destino). Se construye una curva Bézier cúbica con puntos de control desplazados 70px horizontalmente (`cx1 = x1+70`, `cx2 = x2-70`), lo que produce una curva suave tipo "S" similar a n8n. Las coordenadas se calculan relativas al canvas usando `getBoundingClientRect()`.

---

### 2.7 Sistema de drag & drop

Los nodos se pueden arrastrar libremente por el lienzo con actualización en tiempo real de las aristas:

```javascript
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
```

> **Explicación:** Se implementa drag & drop manual sin librerías. En `mousedown` se calcula el offset entre el cursor y la esquina de la tarjeta. En `mousemove` se actualizan las coordenadas `node.x`/`node.y` (con mínimo de 10px para evitar que salga del canvas) y se reposiciona la tarjeta. La llamada a `renderEdgesSvg()` en cada movimiento actualiza las curvas Bézier en tiempo real. Los listeners se registran en `window` para capturar movimiento fuera del elemento.

---

### 2.8 Modo conectar entre nodos

El sistema de conexión funciona en dos clics (origen → destino):

```javascript
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
```

> **Explicación:** El modo conectar es una máquina de estados simple. Primer clic: si no hay origen seleccionado, se guarda `state.connectingFrom` y se resalta el nodo visualmente. Segundo clic: si es el mismo nodo, se cancela; si es diferente, se comprueba que no exista ya esa arista (`some()` sobre edges) y se crea la conexión. RenderCanvas repinta todo incluyendo las nuevas aristas SVG.

---

### 2.9 API REST — CRUD y ejecución

El backend expone una API REST completa para gestionar flujos:

```python
@app.post("/api/workflows/<int:workflow_id>/run")
def api_run_workflow(workflow_id: int):
    with get_db() as conn:
        workflow = conn.execute(
            "SELECT id, canvas_json FROM workflows WHERE id = ?",
            (workflow_id,),
        ).fetchone()

        if not workflow:
            return jsonify({"ok": False, "error": "Flujo no encontrado"}), 404

        canvas = json.loads(workflow["canvas_json"])
        clean_canvas = parse_canvas(canvas)
        result = run_workflow(clean_canvas)

        run_id = conn.execute(
            "INSERT INTO workflow_runs (workflow_id, status, summary_json, created_at) VALUES (?, ?, ?, ?)",
            (workflow_id, result["status"], json.dumps(result), now_iso()),
        ).lastrowid

        for step in result["steps"]:
            conn.execute(
                "INSERT INTO workflow_run_steps (...) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (run_id, step["step"], step["nodeId"], ...),
            )

    return jsonify({"ok": True, "runId": run_id, "result": result})
```

> **Explicación:** El endpoint `/run` ejecuta la cadena completa: (1) carga el canvas desde SQLite, (2) lo valida con `parse_canvas`, (3) ejecuta cada nodo en orden topológico con `run_workflow`, (4) almacena la ejecución en `workflow_runs`, (5) graba cada paso individual en `workflow_run_steps`. Todo ocurre dentro de un context manager `with get_db()` que gestiona transacciones automáticamente.

---

### 2.10 Renderizado del canvas con templates HTML

Los nodos se renderizan clonando un `<template>` nativo del DOM:

```javascript
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

    card.addEventListener('click', (ev) => {
      if (ev.target.closest('button')) return;
      state.selectedNodeId = node.id;
      renderCanvas();
    });

    makeDraggable(card, node);
    canvasEl.appendChild(fragment);
  });

  updateConnectionUI();
  renderInspector();
  renderEdgesList();
  updateNodeCounter();
  requestAnimationFrame(renderEdgesSvg);
}
```

> **Explicación:** Se usa la API de `<template>` nativa del navegador para clonar tarjetas de nodo sin manipulación de strings HTML. Cada tarjeta se posiciona con `position: absolute` y coordenadas `left`/`top` del modelo de datos. Se conectan eventos de selección, drag, conexión y eliminación. Tras renderizar los nodos, se actualiza la UI de conexiones, el inspector, la lista de aristas, el contador y las curvas SVG — todo sincronizado mediante `requestAnimationFrame`.

---

### 2.11 Notificaciones toast y atajos de teclado

Se implementa un sistema de feedback visual y atajos para mejorar la experiencia:

```javascript
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

// Atajos de teclado en boot()
document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Delete' && state.selectedNodeId && !ev.target.closest('input, textarea')) {
    deleteNode(state.selectedNodeId);
  }
  if ((ev.ctrlKey || ev.metaKey) && ev.key === 's') {
    ev.preventDefault();
    saveCurrentWorkflow();
  }
});
```

> **Explicación:** Las notificaciones toast usan transiciones CSS (`opacity` + `translateX`) con `requestAnimationFrame` para garantizar el frame de animación. Se auto-eliminan tras 2.6 segundos. Los atajos de teclado se gestionan en un listener global de `keydown`, con comprobación `ev.target.closest('input, textarea')` para no interferir cuando el usuario escribe en campos de formulario. `Ctrl+S`/`Cmd+S` previene el guardado nativo del navegador.

---

### 2.12 Exportación y duplicación de flujos

Se añaden operaciones avanzadas de gestión:

```python
@app.get("/api/workflows/<int:workflow_id>/export")
def api_export_workflow(workflow_id: int):
    with get_db() as conn:
        row = conn.execute(
            "SELECT name, description, canvas_json FROM workflows WHERE id = ?",
            (workflow_id,),
        ).fetchone()

    if not row:
        return jsonify({"ok": False, "error": "Flujo no encontrado"}), 404

    export = {
        "name": row["name"],
        "description": row["description"],
        "canvas": json.loads(row["canvas_json"]),
        "exported_at": now_iso(),
        "format": "sge-nodeflow-v1",
    }
    return jsonify({"ok": True, "export": export})
```

```javascript
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
}
```

> **Explicación:** La exportación genera un JSON con formato versionado (`sge-nodeflow-v1`) que incluye nombre, descripción, canvas completo y timestamp. En el frontend se usa la API `Blob` + `URL.createObjectURL` para generar un archivo descargable sin servidor. La duplicación en backend copia nombre (con sufijo "copia"), descripción y canvas completo en una nueva fila.

---

## 3. Presentación y defensa

Flujo de demostración:

1. **Arrancar** el servidor con `python app.py` → abrir `http://127.0.0.1:5112`
2. **Cargar flujo demo** con el botón "Cargar flujo demo n8n" → muestra 5 nodos conectados
3. **Ejecutar** el flujo → se muestra la traza paso a paso con badges de estado
4. **Editar** un nodo desde el inspector (cambiar almacén, canal, condición)
5. **Mover** nodos por drag & drop → las curvas Bézier se actualizan en tiempo real
6. **Exportar** el flujo como JSON descargable
7. **Crear nuevo flujo** desde cero, añadiendo nodos de la paleta y conectándolos
8. **Verificar** auditoría completa en base de datos SQLite

---

## 4. Conclusión

SGE NodeFlow Studio demuestra:

- **Arquitectura cliente-servidor** REST completa con Flask + JavaScript vanilla
- **Persistencia relacional** con SQLite y 3 tablas normalizadas
- **Algoritmo de grafos** (Kahn) para ordenación topológica con detección de ciclos
- **Interfaz profesional** con drag & drop, SVG Bézier, inspector y paleta de nodos
- **Gestión completa** de flujos: CRUD, ejecución, exportación, duplicación y auditoría
- **11 tipos de nodos** empresariales con configuración dinámica
- **UX cuidada**: notificaciones toast, atajos teclado, contador en tiempo real, diseño responsive

El proyecto evidencia competencias en desarrollo web full-stack, modelado de procesos empresariales y diseño de interfaces interactivas, alineadas con los criterios de evaluación de SGE.

---

## 5. Repositorio

- https://github.com/luisrocedev/sge-nodeflow-studio-n8n-002
