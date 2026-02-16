# SGE NodeFlow Studio

Editor visual de procesos empresariales estilo n8n, adaptado a la materia de Sistemas de Gestión Empresarial.

## Funcionalidades

- Gestión de flujos (crear/listar/cargar).
- Lienzo visual con nodos movibles (drag & drop).
- Conexión entre nodos desde la interfaz.
- Persistencia en SQLite (`nodeflow.sqlite3`).
- Simulación de ejecución secuencial del flujo.
- Historial de ejecuciones y trazas por pasos.

## Stack

- Backend: Flask + SQLite
- Frontend: HTML + CSS + JavaScript puro

## Arranque

```bash
cd sge_nodeflow_studio
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

Abrir en navegador: http://127.0.0.1:5112
