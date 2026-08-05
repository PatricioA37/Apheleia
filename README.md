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

## Arranque rápido

```bash
# Verificar la estratificación determinista
python3 src/core/estratificacion.py

# Generar cohorte sintética (200 pacientes por defecto)
python3 src/data/seed_sintetico.py 200

# Correr tests
python3 tests/test_estratificacion.py
```

Base de datos: aplicar `src/data/schema.sql` en Supabase.

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

**Pendiente de definición** — ver tabla en [`spec.md`](specs/001-continuidad-cuidado/spec.md):

| ID | Pendiente | Responsable |
|----|-----------|-------------|
| PD-01…05 | Señales, criterios de estado, planes por tramo, umbrales, síntomas de alarma | Joaquín |
| PD-06 | Matriz de priorización de la bandeja | Gerardo |
| PD-07 | Distribución de la cohorte sintética | Patricio + Joaquín |
| PD-08…10 | Orquestación de agentes, máquina de estados como tool, uso de modelo capaz | Patricio |

---

## Datos

**Exclusivamente sintéticos.** Cero PII real, ni en el dataset, ni en el prompt, ni en la
demo. El RCE es la fuente clínica oficial: Apheleia lo referencia, nunca lo reemplaza.

---

## Normativa base

- Marco Operativo ECICEP 2025 (MINSAL) — estratificación y modalidades de cuidado
- Ley 21.719 — protección de datos personales (vigencia plena 1 dic 2026)
- Ley 20.584 — derechos y deberes del paciente
