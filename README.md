# Apheleia

Sistema de agentes para la gestión de riesgo, trazabilidad y continuidad del cuidado
entre profesional y paciente crónico.

**Claude Impact Lab · Longevidad 2026** — Línea 03: Continuidad y Medicina de Precisión

---

## Qué es

Apheleia complementa el **vacío de información que existe entre una consulta médica y la
siguiente** en pacientes crónicos y post-urgencia.

No diagnostica ni reemplaza la evaluación clínica: evalúa riesgo según parámetros y
hábitos definidos por el profesional, acompaña al paciente entre controles y mantiene
informado al equipo de salud — dando infraestructura a las modalidades de *seguimiento a
distancia* y *transición del cuidado* que ECICEP ya define.

**Dos ejes que hoy están desconectados:**

| Eje | Qué dice | Cadencia |
|-----|----------|----------|
| Estrato ECICEP (G0–G3) | Cuánto cuidado necesita la persona | Lento — se define en el control |
| Estado dinámico | Si está siguiendo su plan o se desvía ahora | Rápido — entre controles |

---

## Metodología: Spec-Driven Development

Este repositorio sigue [spec-kit](https://github.com/github/spec-kit). El orden importa:

```
constitution → specify → clarify → plan → tasks → implement
```

**Lee primero**: [`.specify/memory/constitution.md`](.specify/memory/constitution.md)

La constitución gobierna todo. Ante conflicto entre una spec y la constitución, prevalece
la constitución. Los principios I a V son **no negociables**.

---

## Estructura

```
.specify/
├── memory/constitution.md          ← LEER PRIMERO
└── templates/                      ← plantillas spec-kit

specs/001-continuidad-cuidado/
├── spec.md                         ← qué se construye (user stories P1–P3)
├── plan.md                         ← cómo: stack, arquitectura, fases
├── data-model.md                   ← entidades y separación de identidad
├── contracts/tools.md              ← EL PACTO ENTRE VÉRTICES
└── tasks.md                        ← se genera con /speckit.tasks

src/
├── core/       lógica determinista — SIN llamadas a modelo
├── agents/     agentes con modelo + system prompts
├── tools/      tools MCP
├── api/        FastAPI
└── data/       schema, generador sintético, planes validados

web/            interfaces paciente y clínica
tests/
docs/           documentación de apoyo y decisiones
```

**Regla de separación**: `src/core/` no importa el SDK de Anthropic. Hay un test que lo
verifica. Esta frontera hace comprobable el Principio VI.

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Backend | Python 3.11+, FastAPI, LangGraph |
| Interfaz clínica (dupla gestora) | React |
| App paciente | React Native + Expo |
| Datos | Supabase (PostgreSQL) + pgvector |
| Embeddings | Voyage 4 — `voyage-4-large` (biblioteca clínica), `voyage-4-lite` (memoria y consultas) |
| Modelo | Claude (API de Anthropic) |

## Arranque rápido

Orden real de dependencias — cada paso asume el anterior hecho.

### 1. Clonar y configurar

```bash
git clone <url-del-repo>
cd apheleia

cp .env.example .env
# completar: ANTHROPIC_API_KEY, VOYAGE_API_KEY, SUPABASE_URL, SUPABASE_KEY
```

### 2. Backend (Python)

```bash
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Base de datos

```bash
# Aplicar el schema en el proyecto Supabase (SQL editor o psql)
psql "$SUPABASE_URL" -f src/data/schema.sql
```

### 4. Verificar que todo quedó bien

```bash
python3 scripts/verificar_setup.py
```

Comprueba rama de git, variables de entorno, dependencias e imports internos.
**Si reporta errores, corrígelos antes de seguir** — son los problemas que rompen
el arranque más adelante de forma confusa.

### 5. Datos de arranque

```bash
# Verificar la estratificación determinista (no requiere BD ni API keys)
python3 src/core/estratificacion.py
python3 tests/test_estratificacion.py

# Generar cohorte sintética
python3 src/data/seed_sintetico.py 200
# → falta el loader que la inserta en Supabase (tasks.md, T010)

# Cargar biblioteca clínica MOCK (requiere VOYAGE_API_KEY + Supabase con schema aplicado)
python3 src/data/seed_biblioteca_mock.py
```

### 6. Probar el flujo de agente end-to-end

```bash
# Requiere ANTHROPIC_API_KEY + biblioteca cargada (paso 5)
python3 src/agents/conversacion_minima.py
```

### 7. Frontends

`web/` y `mobile/` son landing zones — ver el `README.md` de cada carpeta.
Jonathan está construyendo ambos proyectos por separado; una vez integrados
(scaffold de Vite/similar en `web/`, scaffold de Expo en `mobile/`):

```bash
# Interfaz clínica (React)
cd web && npm install && npm run dev

# App paciente (React Native + Expo)
cd mobile && npm install && npx expo start
```

Ambos consumen los endpoints documentados en
[`contracts/tools.md`](specs/001-continuidad-cuidado/contracts/tools.md) — pueden
construirse contra ejemplos JSON del contrato antes de que el backend esté listo,
sin esperar a que ninguna de las dos piezas exista primero.

### 8. Tu rama de trabajo

Ver [`docs/FLUJO-GIT.md`](docs/FLUJO-GIT.md) — una rama por vértice, no por
persona.

```bash
git checkout -b 001-continuidad-cuidado/<tu-vertice>
```

### 9. Qué hacer primero

Ver [`specs/001-continuidad-cuidado/tasks.md`](specs/001-continuidad-cuidado/tasks.md)
para la lista completa. La Fase 2 (Foundational) bloquea todo lo demás — hasta que
`v_bandeja_clinica` devuelva datos reales, las historias de usuario no pueden
avanzar en paralelo.

---

## Equipo

| Persona | Vértice | Decide |
|---------|---------|--------|
| Joaquín Garrido | Criterio clínico | Qué es riesgo, planes por tramo, umbrales de derivación |
| Gerardo Vergara | Riesgo y operación | Matriz de priorización, realismo operativo |
| Patricio Arias | Datos y agentes | Arquitectura, contratos, clasificador |
| Jonathan | Interfaces | Superficie paciente + clínica, demo |

**Regla de coordinación**: se especifican los contratos entre personas, no el interior
del trabajo de cada persona.

---

## Estado actual

**Listo:**
- Constitución con guardrails clínicos
- Spec con user stories priorizadas y criterios de aceptación
- Plan técnico y fases
- Modelo de datos + schema SQL con constraints que hacen cumplir los principios
- Contratos de tools y endpoints
- Estratificación ECICEP determinista, con tests
- Generador de cohorte sintética
- Bloque de guardrails para system prompts
- RAG con Voyage 4 (dos tiers) + prompt caching por tramo, resuelto PD-11
- Camino vertical mínimo: biblioteca mock + Claude real funcionando end-to-end
  (`src/agents/conversacion_minima.py`)
- Plan de tareas (`tasks.md`) y flujo git por vértice (`docs/FLUJO-GIT.md`)

**Pendiente de definición** — ver tabla en [`spec.md`](specs/001-continuidad-cuidado/spec.md):

| ID | Pendiente | Responsable |
|----|-----------|-------------|
| PD-01…05 | Señales, criterios de estado, planes por tramo, umbrales, síntomas de alarma | Joaquín |
| PD-06 | Matriz de priorización de la bandeja | Gerardo |
| PD-07 | Distribución de la cohorte sintética | Patricio + Joaquín |
| PD-08…10 | Orquestación de agentes, máquina de estados como tool, uso de modelo capaz | Patricio |

Ninguno de estos bloquea el arranque — ver `tasks.md` Fase 5A: se construye con
mock y se reemplaza el contenido cuando lleguen las definiciones.

---

## Datos

**Exclusivamente sintéticos.** Cero PII real, ni en el dataset, ni en el prompt, ni en la
demo. El RCE es la fuente clínica oficial: Apheleia lo referencia, nunca lo reemplaza.

---

## Normativa base

- Marco Operativo ECICEP 2025 (MINSAL) — estratificación y modalidades de cuidado
- Ley 21.719 — protección de datos personales (vigencia plena 1 dic 2026)
- Ley 20.584 — derechos y deberes del paciente
