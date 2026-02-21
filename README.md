<p align="center">
  <img src="https://img.shields.io/badge/SGE_NodeFlow_Studio-v2.0-10a37f?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiPjxjaXJjbGUgY3g9IjEyIiBjeT0iMTIiIHI9IjMiLz48cGF0aCBkPSJNMTIgMnYyTTEyIDIwdjJNMiAxMmgyTTIwIDEyaDIiLz48L3N2Zz4=" alt="SGE NodeFlow Studio" />
</p>

<h1 align="center">SGE NodeFlow Studio</h1>

<p align="center">
  <strong>Editor visual de procesos empresariales estilo n8n</strong><br/>
  Diseñado para la asignatura de Sistemas de Gestión Empresarial · DAM2 2025/26
</p>

<p align="center">
  <img src="https://img.shields.io/badge/python-3.11+-3776AB?logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/Flask-3.x-000000?logo=flask&logoColor=white" alt="Flask" />
  <img src="https://img.shields.io/badge/SQLite-3-003B57?logo=sqlite&logoColor=white" alt="SQLite" />
  <img src="https://img.shields.io/badge/JavaScript-Vanilla-F7DF1E?logo=javascript&logoColor=black" alt="JavaScript" />
  <img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License" />
</p>

---

## 🎯 Descripción

**SGE NodeFlow Studio** es una aplicación web full-stack que permite diseñar, conectar y ejecutar flujos de procesos empresariales en un lienzo visual interactivo. Inspirado en la filosofía de [n8n](https://n8n.io/), está adaptado al dominio ERP/CRM para la materia de Sistemas de Gestión Empresarial.

El usuario puede arrastrar nodos de negocio, conectarlos con aristas Bézier y ejecutar el flujo completo con trazabilidad paso a paso — todo desde el navegador, sin dependencias externas.

---

## 🏗️ Arquitectura

```
┌──────────────────────────────────────────────────────┐
│                    PRESENTACIÓN                       │
│  index.html  ·  styles.css  ·  app.js (vanilla)     │
│  Canvas SVG  ·  Drag & Drop  ·  Inspector de nodo   │
└────────────────────────┬─────────────────────────────┘
                         │ fetch / REST
┌────────────────────────▼─────────────────────────────┐
│                   LÓGICA (Flask)                      │
│  CRUD workflows  ·  Validación canvas  ·  Ejecución │
│  Orden topológico (Kahn)  ·  Detección de ciclos     │
└────────────────────────┬─────────────────────────────┘
                         │ sqlite3
┌────────────────────────▼─────────────────────────────┐
│                 PERSISTENCIA (SQLite)                 │
│  workflows  ·  workflow_runs  ·  workflow_run_steps  │
└──────────────────────────────────────────────────────┘
```

---

## 🧩 Catálogo de Nodos Empresariales

| Tipo                | Etiqueta                | Descripción                                 |
| ------------------- | ----------------------- | ------------------------------------------- |
| `trigger`           | Inicio                  | Punto de entrada del flujo                  |
| `order_input`       | Recepción de pedido     | Captura de pedidos desde canal configurable |
| `customer_check`    | Validación cliente      | Verificación CRM del cliente                |
| `stock_check`       | Validación stock        | Consulta de existencias por almacén         |
| `finance_approval`  | Aprobación financiera   | Autorización de gasto                       |
| `invoice`           | Generación de factura   | Emisión de factura vinculada                |
| `notify`            | Notificación al cliente | Envío por email/WhatsApp/SMS                |
| `archive`           | Archivo ERP             | Almacenamiento documental                   |
| `ai_summary`        | Resumen IA              | Generación de resumen inteligente           |
| `conditional_check` | Decisión condicional    | Evaluación de regla de negocio              |
| `data_transform`    | Transformación de datos | Conversión de formato (JSON/XML/CSV)        |

---

## 🔌 API REST

| Método   | Endpoint                       | Descripción                       |
| -------- | ------------------------------ | --------------------------------- |
| `GET`    | `/`                            | Interfaz principal                |
| `GET`    | `/api/node-types`              | Catálogo de tipos de nodo         |
| `GET`    | `/api/workflows`               | Listar todos los flujos           |
| `POST`   | `/api/workflows`               | Crear nuevo flujo                 |
| `GET`    | `/api/workflows/:id`           | Obtener flujo por ID              |
| `PUT`    | `/api/workflows/:id`           | Actualizar canvas del flujo       |
| `DELETE` | `/api/workflows/:id`           | Eliminar flujo y ejecuciones      |
| `POST`   | `/api/workflows/:id/run`       | Ejecutar flujo (orden topológico) |
| `GET`    | `/api/workflows/:id/runs`      | Historial de ejecuciones          |
| `GET`    | `/api/workflows/:id/export`    | Exportar flujo como JSON          |
| `POST`   | `/api/workflows/:id/duplicate` | Duplicar flujo existente          |
| `GET`    | `/api/stats`                   | Estadísticas globales             |

---

## ✨ Funcionalidades Principales

### Editor Visual

- **Lienzo interactivo** con fondo de cuadrícula de puntos
- **Drag & drop** para posicionar nodos libremente
- **Conexiones Bézier SVG** con curvas suaves entre nodos
- **Modo conectar** guiado (clic origen → clic destino)
- **Inspector de nodo** para editar etiqueta y configuración JSON
- **Paleta de nodos** lateral con todos los tipos disponibles

### Gestión de Flujos

- Crear, guardar, duplicar, eliminar y exportar flujos
- Flujo demo precargado con 5 nodos empresariales
- Flujo semilla automático al iniciar por primera vez
- Exportación JSON con formato `sge-nodeflow-v1`

### Motor de Ejecución

- **Ordenación topológica** (algoritmo de Kahn) para ejecutar en secuencia correcta
- **Detección de ciclos** para impedir grafos no válidos
- **Simulación realista** de cada nodo con mensajes contextuales
- **Auditoría completa**: cada ejecución queda registrada con trazas por paso
- **Medición de rendimiento** con timestamps por nodo

### Experiencia de Usuario

- **Notificaciones toast** para feedback inmediato
- **Atajos de teclado**: `Delete` (eliminar nodo), `Ctrl+S` (guardar)
- **Contador de nodos/conexiones** en tiempo real
- **Barra de estadísticas** con métricas globales
- **Diseño responsive** para escritorio y tablet
- **Paleta cálida/blanca** con estética limpia inspirada en ChatGPT

---

## 🚀 Instalación y Arranque

```bash
# Clonar el repositorio
git clone https://github.com/luisrocedev/sge-nodeflow-studio-n8n-002.git
cd sge-nodeflow-studio-n8n-002/sge_nodeflow_studio

# Crear entorno virtual
python3 -m venv .venv
source .venv/bin/activate    # macOS/Linux
# .venv\Scripts\activate     # Windows

# Instalar dependencias
pip install -r requirements.txt

# Arrancar el servidor
python app.py
```

Abrir en el navegador: **http://127.0.0.1:5112**

---

## 📁 Estructura del Proyecto

```
sge-nodeflow-studio-n8n-002/
├── README.md                                    ← Este archivo
├── Actividad_EditorNodosN8N_53945291X.md        ← Memoria de la actividad
├── Plantilla_Examen_SGE_NodeFlow_Studio.md      ← Plantilla de defensa oral
└── sge_nodeflow_studio/
    ├── app.py                                   ← Backend Flask (API + lógica)
    ├── requirements.txt                         ← Flask==3.0.3
    ├── static/
    │   ├── app.js                               ← Frontend vanilla JS
    │   └── styles.css                           ← Estilos CSS (paleta cálida)
    └── templates/
        └── index.html                           ← Plantilla HTML principal
```

---

## 🗃️ Modelo de Datos

```sql
-- Flujos de trabajo
CREATE TABLE workflows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    canvas_json TEXT NOT NULL,           -- JSON con nodos y aristas
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Ejecuciones registradas
CREATE TABLE workflow_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workflow_id INTEGER NOT NULL,
    status TEXT NOT NULL,
    summary_json TEXT NOT NULL,          -- Resumen completo de la ejecución
    created_at TEXT NOT NULL,
    FOREIGN KEY(workflow_id) REFERENCES workflows(id)
);

-- Trazas por paso de ejecución
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

---

## 🎓 Contexto Académico

| Campo          | Valor                                 |
| -------------- | ------------------------------------- |
| **Asignatura** | Sistemas de Gestión Empresarial (SGE) |
| **Ciclo**      | DAM2 · Curso 2025/26                  |
| **Actividad**  | 002 — Editor de nodos n8n             |
| **Alumno**     | Luis Rodríguez Cedeño                 |
| **DNI**        | 53945291X                             |

---

## 📄 Licencia

Proyecto académico desarrollado para el módulo de SGE en DAM2.

<p align="center"><em>SGE NodeFlow Studio — Editor visual de procesos empresariales</em></p>
