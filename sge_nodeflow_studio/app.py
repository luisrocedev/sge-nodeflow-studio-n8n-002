import json
import sqlite3
import time
from collections import defaultdict, deque
from datetime import datetime, timezone
from pathlib import Path

from flask import Flask, jsonify, render_template, request

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "nodeflow.sqlite3"

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

app = Flask(__name__)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with get_db() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS workflows (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT DEFAULT '',
                canvas_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS workflow_runs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                workflow_id INTEGER NOT NULL,
                status TEXT NOT NULL,
                summary_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY(workflow_id) REFERENCES workflows(id)
            );

            CREATE TABLE IF NOT EXISTS workflow_run_steps (
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
            """
        )


DEFAULT_CANVAS = {
    "nodes": [
        {
            "id": "n-trigger",
            "type": "trigger",
            "label": "Inicio flujo",
            "x": 120,
            "y": 170,
            "config": {},
        },
        {
            "id": "n-order",
            "type": "order_input",
            "label": "Recepción pedido",
            "x": 360,
            "y": 170,
            "config": {"channel": "email"},
        },
        {
            "id": "n-stock",
            "type": "stock_check",
            "label": "Validación stock",
            "x": 600,
            "y": 170,
            "config": {"warehouse": "MAD-01"},
        },
        {
            "id": "n-notify",
            "type": "notify",
            "label": "Notificar cliente",
            "x": 840,
            "y": 170,
            "config": {"channel": "whatsapp"},
        },
    ],
    "edges": [
        {"id": "e-1", "source": "n-trigger", "target": "n-order"},
        {"id": "e-2", "source": "n-order", "target": "n-stock"},
        {"id": "e-3", "source": "n-stock", "target": "n-notify"},
    ],
}


def ensure_seed_workflow() -> None:
    with get_db() as conn:
        exists = conn.execute("SELECT id FROM workflows LIMIT 1").fetchone()
        if exists:
            return

        now = now_iso()
        conn.execute(
            """
            INSERT INTO workflows (name, description, canvas_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                "Flujo ERP de pedidos",
                "Ejemplo base de gestión de pedido: recepción, stock y notificación.",
                json.dumps(DEFAULT_CANVAS, ensure_ascii=False),
                now,
                now,
            ),
        )


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
        label = str(node.get("label", "")).strip() or NODE_TYPES.get(node_type, "Nodo")
        if not node_id or not node_type:
            raise RuntimeError("Cada nodo debe tener id y type")
        if node_type not in NODE_TYPES:
            raise RuntimeError(f"Tipo de nodo no permitido: {node_type}")
        if node_id in seen_ids:
            raise RuntimeError(f"Nodo duplicado: {node_id}")
        seen_ids.add(node_id)

        validated_nodes.append(
            {
                "id": node_id,
                "type": node_type,
                "label": label,
                "x": int(node.get("x", 80)),
                "y": int(node.get("y", 80)),
                "config": node.get("config") if isinstance(node.get("config"), dict) else {},
            }
        )

    validated_edges = []
    seen_edges = set()
    for edge in edges:
        edge_id = str(edge.get("id", "")).strip() or f"e-{len(validated_edges)+1}"
        source = str(edge.get("source", "")).strip()
        target = str(edge.get("target", "")).strip()
        if not source or not target:
            raise RuntimeError("Cada conexión debe tener source y target")
        if source not in seen_ids or target not in seen_ids:
            raise RuntimeError("Todas las conexiones deben apuntar a nodos existentes")
        key = (source, target)
        if key in seen_edges:
            continue
        seen_edges.add(key)
        validated_edges.append({"id": edge_id, "source": source, "target": target})

    return {"nodes": validated_nodes, "edges": validated_edges}


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
        raise RuntimeError("El flujo contiene ciclos. El editor de procesos requiere un grafo acíclico.")

    return order


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
        "archive": "Pedido archivado en el ERP documental.",
        "ai_summary": f"Resumen IA generado para dirección con tono {config.get('tone', 'profesional')}.",
        "conditional_check": f"Condición evaluada: {config.get('condition', 'amount > 0')} → resultado OK.",
        "data_transform": f"Datos transformados con formato {config.get('format', 'JSON')}.",
    }

    message = messages.get(node_type, f"Nodo ejecutado: {label}.")
    elapsed_ms = round((time.perf_counter() - t0) * 1000, 2)

    return {"status": "ok", "message": message, "duration_ms": elapsed_ms}


def run_workflow(canvas: dict) -> dict:
    nodes = canvas["nodes"]
    edges = canvas["edges"]
    order = topological_order(nodes, edges)
    by_id = {node["id"]: node for node in nodes}

    steps = []
    for idx, node_id in enumerate(order, start=1):
        node = by_id[node_id]
        outcome = execute_node(node)
        steps.append(
            {
                "step": idx,
                "nodeId": node_id,
                "nodeLabel": node["label"],
                "nodeType": node["type"],
                "status": outcome["status"],
                "message": outcome["message"],
            }
        )

    return {
        "status": "ok",
        "totalNodes": len(nodes),
        "totalEdges": len(edges),
        "steps": steps,
    }


@app.get("/")
def index():
    return render_template("index.html")


@app.get("/api/node-types")
def api_node_types():
    return jsonify({"ok": True, "types": NODE_TYPES})


@app.get("/api/workflows")
def api_list_workflows():
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT id, name, description, created_at, updated_at
            FROM workflows
            ORDER BY id DESC
            """
        ).fetchall()

    return jsonify({"ok": True, "items": [dict(row) for row in rows]})


@app.post("/api/workflows")
def api_create_workflow():
    body = request.get_json(silent=True) or {}
    name = str(body.get("name", "")).strip() or "Nuevo flujo empresarial"
    description = str(body.get("description", "")).strip()
    now = now_iso()

    with get_db() as conn:
        workflow_id = conn.execute(
            """
            INSERT INTO workflows (name, description, canvas_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (name, description, json.dumps({"nodes": [], "edges": []}), now, now),
        ).lastrowid

    return jsonify({"ok": True, "workflowId": workflow_id})


@app.get("/api/workflows/<int:workflow_id>")
def api_get_workflow(workflow_id: int):
    with get_db() as conn:
        row = conn.execute(
            """
            SELECT id, name, description, canvas_json, created_at, updated_at
            FROM workflows
            WHERE id = ?
            """,
            (workflow_id,),
        ).fetchone()

    if not row:
        return jsonify({"ok": False, "error": "Flujo no encontrado"}), 404

    payload = dict(row)
    payload["canvas"] = json.loads(payload.pop("canvas_json"))
    return jsonify({"ok": True, "workflow": payload})


@app.put("/api/workflows/<int:workflow_id>")
def api_update_workflow(workflow_id: int):
    body = request.get_json(silent=True) or {}
    name = str(body.get("name", "")).strip() or "Flujo empresarial"
    description = str(body.get("description", "")).strip()
    canvas = body.get("canvas") if isinstance(body.get("canvas"), dict) else {}

    try:
        clean_canvas = parse_canvas(canvas)
    except Exception as exc:
        return jsonify({"ok": False, "error": str(exc)}), 400

    with get_db() as conn:
        row = conn.execute("SELECT id FROM workflows WHERE id = ?", (workflow_id,)).fetchone()
        if not row:
            return jsonify({"ok": False, "error": "Flujo no encontrado"}), 404

        conn.execute(
            """
            UPDATE workflows
            SET name = ?, description = ?, canvas_json = ?, updated_at = ?
            WHERE id = ?
            """,
            (name, description, json.dumps(clean_canvas, ensure_ascii=False), now_iso(), workflow_id),
        )

    return jsonify({"ok": True})


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

        try:
            clean_canvas = parse_canvas(canvas)
            result = run_workflow(clean_canvas)
        except Exception as exc:
            return jsonify({"ok": False, "error": str(exc)}), 400

        run_id = conn.execute(
            """
            INSERT INTO workflow_runs (workflow_id, status, summary_json, created_at)
            VALUES (?, ?, ?, ?)
            """,
            (workflow_id, result["status"], json.dumps(result, ensure_ascii=False), now_iso()),
        ).lastrowid

        for step in result["steps"]:
            conn.execute(
                """
                INSERT INTO workflow_run_steps (run_id, step_index, node_id, node_label, node_type, status, message, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    run_id,
                    step["step"],
                    step["nodeId"],
                    step["nodeLabel"],
                    step["nodeType"],
                    step["status"],
                    step["message"],
                    now_iso(),
                ),
            )

    return jsonify({"ok": True, "runId": run_id, "result": result})


@app.get("/api/workflows/<int:workflow_id>/runs")
def api_list_runs(workflow_id: int):
    with get_db() as conn:
        runs = conn.execute(
            """
            SELECT id, status, summary_json, created_at
            FROM workflow_runs
            WHERE workflow_id = ?
            ORDER BY id DESC
            LIMIT 20
            """,
            (workflow_id,),
        ).fetchall()

    items = []
    for row in runs:
        payload = dict(row)
        payload["summary"] = json.loads(payload.pop("summary_json"))
        items.append(payload)

    return jsonify({"ok": True, "items": items})


# ── Nuevos endpoints ──────────────────────────────────────────


@app.delete("/api/workflows/<int:workflow_id>")
def api_delete_workflow(workflow_id: int):
    with get_db() as conn:
        row = conn.execute("SELECT id FROM workflows WHERE id = ?", (workflow_id,)).fetchone()
        if not row:
            return jsonify({"ok": False, "error": "Flujo no encontrado"}), 404

        conn.execute("DELETE FROM workflow_run_steps WHERE run_id IN (SELECT id FROM workflow_runs WHERE workflow_id = ?)", (workflow_id,))
        conn.execute("DELETE FROM workflow_runs WHERE workflow_id = ?", (workflow_id,))
        conn.execute("DELETE FROM workflows WHERE id = ?", (workflow_id,))

    return jsonify({"ok": True})


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


@app.post("/api/workflows/<int:workflow_id>/duplicate")
def api_duplicate_workflow(workflow_id: int):
    with get_db() as conn:
        row = conn.execute(
            "SELECT name, description, canvas_json FROM workflows WHERE id = ?",
            (workflow_id,),
        ).fetchone()

        if not row:
            return jsonify({"ok": False, "error": "Flujo no encontrado"}), 404

        now = now_iso()
        new_id = conn.execute(
            """
            INSERT INTO workflows (name, description, canvas_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (f"{row['name']} (copia)", row["description"], row["canvas_json"], now, now),
        ).lastrowid

    return jsonify({"ok": True, "workflowId": new_id})


@app.get("/api/stats")
def api_stats():
    with get_db() as conn:
        total_workflows = conn.execute("SELECT COUNT(*) FROM workflows").fetchone()[0]
        total_runs = conn.execute("SELECT COUNT(*) FROM workflow_runs").fetchone()[0]
        total_steps = conn.execute("SELECT COUNT(*) FROM workflow_run_steps").fetchone()[0]

    return jsonify({
        "ok": True,
        "stats": {
            "totalWorkflows": total_workflows,
            "totalRuns": total_runs,
            "totalSteps": total_steps,
            "nodeTypesAvailable": len(NODE_TYPES),
        },
    })


if __name__ == "__main__":
    init_db()
    ensure_seed_workflow()
    app.run(debug=True, port=5112)
