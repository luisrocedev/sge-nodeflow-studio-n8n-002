# Actividad 002 · Editor de nodos n8n (Sistemas de Gestión Empresarial)

## 1. Introducción

En esta actividad se desarrolla una aplicación web propia denominada **SGE NodeFlow Studio**, orientada a representar y ejecutar procesos empresariales con un editor visual de nodos inspirado en n8n, pero adaptado al contexto ERP/CRM de la asignatura. El objetivo principal es demostrar dominio técnico en modelado de procesos, persistencia de datos y presentación visual profesional.

Se parte de una implementación desde cero con arquitectura cliente-servidor, persistencia SQLite y simulación de ejecución de flujos para poder validar trazabilidad paso a paso.

## 2. Desarrollo detallado

### 2.1 Arquitectura implementada

La solución se estructura en tres capas:

- **Presentación**: `templates/index.html` + `static/styles.css` + `static/app.js`.
- **Lógica de negocio**: `app.py` (API REST, validaciones, ejecución del flujo).
- **Persistencia**: SQLite (`nodeflow.sqlite3`) con tablas normalizadas.

### 2.2 Modelo de datos y cambios funcionales

Se diseña un modelo con tres tablas:

- `workflows`: metadatos del flujo y estado del canvas serializado.
- `workflow_runs`: cada ejecución lanzada desde UI con resumen JSON.
- `workflow_run_steps`: traza detallada por nodo ejecutado.

Este diseño añade una mejora clave frente a un editor básico: **auditoría histórica de ejecuciones**.

### 2.3 API y validaciones

Rutas principales:

- `GET /api/node-types`: catálogo de nodos permitidos.
- `GET/POST /api/workflows`: listado y creación de flujos.
- `GET/PUT /api/workflows/<id>`: lectura y actualización del canvas.
- `POST /api/workflows/<id>/run`: ejecución con orden topológico.
- `GET /api/workflows/<id>/runs`: histórico de ejecuciones.

Validaciones críticas implementadas:

- nodos con `id` y `type` obligatorios,
- tipos solo dentro del catálogo permitido,
- conexiones con origen/destino existentes,
- detección de ciclos para impedir ejecución inválida.

### 2.4 Interfaz visual profesional

Mejoras visuales y de usabilidad aplicadas:

- distribución tipo “command center” (sidebar + canvas + paneles inferiores),
- nodos con estilo tarjeta, acciones contextuales y etiquetas claras,
- drag & drop para posicionamiento libre,
- conexiones curvas SVG renderizadas en tiempo real,
- feedback de ejecución mediante badges y tarjetas de pasos,
- **inspector de nodo** para editar etiqueta y configuración JSON,
- **modo conectar guiado** con indicador de estado,
- rediseño visual completo con paleta **cálida/blanco** y estética limpia inspirada en ChatGPT.

### 2.5 Lógica de ejecución

Cada nodo empresarial simula una acción real:

- recepción de pedido,
- validación de stock,
- aprobación financiera,
- generación de factura,
- notificación al cliente,
- archivado ERP.

La ejecución se calcula por orden topológico y se registra completa en base de datos para análisis posterior.

Además, se incorpora un nuevo nodo de ejemplo para simular automatización inteligente:

- **`ai_summary`**: genera un resumen IA para dirección en función de parámetros de configuración (por ejemplo, tono ejecutivo/profesional).

### 2.6 Flujo de ejemplo para pruebas en clase

Para facilitar la demostración práctica, se añade un botón de **“Cargar flujo demo n8n”** en la interfaz. Este flujo crea automáticamente un escenario funcional con nodos conectados:

1. Inicio (Webhook)
2. Captura pedido web
3. Consulta de stock ERP
4. Resumen IA para dirección
5. Notificación al cliente

Con esto, el profesor o cualquier compañero puede ejecutar la actividad en segundos y comprobar la traza completa sin crear el diagrama desde cero.

## 3. Aplicación práctica

Caso aplicado: flujo de gestión de pedidos.

1. Se crea o carga un flujo en el editor.
2. Se añaden nodos de negocio desde la paleta.
3. Se conectan para definir el proceso.
4. Se guarda el diseño en SQLite.
5. Se ejecuta y se revisan trazas por pasos.

Este flujo es reutilizable para escenarios de SGE como circuito de ventas, validación documental o aprobación presupuestaria.

Adicionalmente, el flujo demo permite mostrar de forma inmediata la similitud metodológica con n8n (nodos + conexiones + ejecución) y las adaptaciones específicas al dominio ERP/CRM.

## 4. Conclusión

La actividad cumple los criterios técnicos y funcionales exigidos:

- implementación real con backend y frontend integrados,
- cambios estéticos relevantes (interfaz moderna y clara),
- cambios funcionales profundos (grafo, validación, ejecución y auditoría),
- aplicación directa al ámbito de sistemas ERP/CRM.

También queda preparado para defensa oral en clase gracias al flujo demo integrado y al nodo IA de ejemplo, que evidencian tanto la parte técnica como la experiencia de usuario.

Como mejora futura, se propone añadir ramas condicionales avanzadas y exportación/importación JSON de plantillas de proceso.
