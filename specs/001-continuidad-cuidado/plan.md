# Implementation Plan: Sistema de Continuidad del Cuidado Crónico

**Branch**: `001-continuidad-cuidado` | **Date**: 2026-08-04 | **Spec**: `./spec.md`

---

## Summary

Sistema de agentes que hace visible el intervalo entre controles médicos. Estratifica
pacientes según criterio oficial ECICEP (regla determinista), clasifica su estado
dinámico entre controles, y notifica al equipo clínico cuando corresponde — siempre con
validación humana y sin emitir diagnóstico.

Enfoque técnico: separación estricta entre lógica determinista (estratificación, reglas
de estado) y razonamiento de modelo (conversación, evaluación de casos ambiguos,
redacción de alertas). El modelo entra donde aporta juicio, no en el camino de rutina.

---

## Technical Context

**Language/Version**: Python 3.11+ (backend, agentes) · TypeScript + React (interfaz
clínica) · TypeScript + React Native/Expo (app paciente)

**Primary Dependencies**:
- Orquestación de agentes: **LangGraph**
- Modelo: **Claude** (API de Anthropic) — motor principal, requisito del Lab
- Backend: FastAPI
- App paciente: **React Native + Expo**
- Interfaz clínica: **React** (web)

**Storage**: **Supabase (PostgreSQL)** · **pgvector** para el RAG del perfil del paciente

**Embeddings**: por definir. Candidatos: Voyage, OpenAI, o modelo open-source
self-hosted. Criterio: el contrato de `perfil_vectorial` fija la dimensión del vector, así
que la decisión debe tomarse antes de crear la tabla.

**Testing**: pytest (backend) · validación guiada por acceptance scenarios

**Target Platform**:
- Paciente: app móvil (iOS + Android vía Expo)
- Clínica: navegador
- Backend: contenedor

**Project Type**: App móvil + web app + backend de agentes

**Constraints**:
- Datos sintéticos exclusivamente. Cero PII.
- Claude como motor principal (requisito del Lab).
- Ventana de construcción: jornadas del evento.

**Scale/Scope**: MVP demostrable. Cohorte sintética suficiente para mostrar los cuatro
tramos y los estados. El escalamiento poblacional es proyección documentada, no
implementación.

**Stack confirmado**: Python (backend) · React (clínica) · React Native + Expo
(paciente) · Supabase/pgvector (datos) · Voyage 4 (embeddings, PD-11 resuelto) ·
LangGraph (orquestación) · Claude (motor de razonamiento).

---

## Constitution Check

*GATE: debe pasar antes de implementar.*

| Principio | Gate | Cómo se verifica |
|-----------|------|------------------|
| I. Nunca diagnostica | Todo system prompt incluye el límite; batería de intentos de inducción a diagnóstico | Test manual documentado |
| II. Humano en el circuito | `alerta.validada_por` NOT NULL para cerrar | Constraint en BD |
| III. Acompaña, no fiscaliza | No existe ruta de código que egrese por silencio | Revisión de código |
| IV. Cita o di no sé | Planes provienen de biblioteca validada, no de generación libre | Diseño de prompt |
| V. Privacidad | Dominio clínico sin PII; `pseudonym_id` como única llave | Modelo de datos |
| VI. Cómputo proporcional | Estratificación sin llamada a modelo | Revisión de código |
| VII. Trazabilidad | Toda evaluación registra evaluador y consumo | Schema |

---

## Project Structure

```
src/
├── core/                    # Lógica determinista — SIN llamadas a modelo
│   ├── estratificacion.py   # G0–G3 por conteo (ECICEP)
│   ├── estados.py           # Máquina de estados dinámicos
│   ├── clasificador.py      # Clasificador determinista de estado
│   └── reglas_alerta.py     # Reglas estado × tramo → destino
│
├── graph/                   # Orquestación LangGraph
│   ├── grafo.py             # Definición del grafo de agentes
│   ├── estado_grafo.py      # Estado compartido entre nodos
│   └── nodos/               # Un nodo por agente
│       ├── conversacion.py
│       ├── plan.py
│       ├── evaluacion.py
│       └── notificacion.py
│
├── agents/
│   └── prompts/             # System prompts (guardrails)
│
├── tools/                   # Tools deterministas consumidos por los nodos
│   ├── estratificar.py
│   ├── consultar_estado.py
│   ├── consultar_plan.py
│   └── evaluar_criterio.py
│
├── rag/
│   ├── embeddings.py        # Cliente de embeddings (PD-11)
│   └── perfil.py            # Construcción y recuperación del perfil
│
├── api/                     # FastAPI — sirve a app móvil y web clínica
│   ├── paciente.py
│   └── clinica.py
│
└── data/
    ├── schema.sql
    ├── seed_sintetico.py
    └── planes/              # Biblioteca de planes por tramo (PD-03)

mobile/                      # App paciente — React Native + Expo
├── app/                     # Rutas (expo-router)
│   ├── medicamentos/
│   ├── controles/
│   └── chat/
├── components/
└── lib/api.ts               # Cliente contra contracts/tools.md

web/                         # Interfaz clínica — React (dupla gestora)
├── src/
│   ├── pages/ (o routes/)   # según router elegido
│   │   ├── bandeja/         # US1 — pacientes por tramo y estado
│   │   └── alertas/         # US5 — validación humana obligatoria
│   ├── components/
│   └── lib/api.ts           # Cliente contra contracts/tools.md

specs/001-continuidad-cuidado/
├── spec.md
├── plan.md
├── data-model.md
├── contracts/               # Contratos de tools — el pacto entre vértices
└── tasks.md
```

**Regla de separación**: `src/core/` no importa el SDK de Anthropic ni LangGraph. Si
necesita hacerlo, esa lógica pertenece a `src/graph/`. Esta frontera hace verificable el
Principio VI y está cubierta por un test.

**Nota sobre LangGraph y las herramientas del Lab**: LangGraph es el orquestador; Claude
sigue siendo el motor de razonamiento (requisito no negociable del Lab). Al declarar
herramientas Anthropic en la ficha técnica, marcar **solo las que efectivamente se usen**:
si la orquestación es LangGraph y no Agent SDK, no marcar Agent SDK. Los tools pueden
exponerse vía MCP y consumirse desde los nodos del grafo — esa combinación sí permite
marcar MCP legítimamente.

---

## Arquitectura de agentes

Sistema de **varios agentes especializados**, no un agente único. La orquestación
específica se define en PD-08.

```
                    ┌── Nodo: conversación
                    │   (diálogo con paciente, RAG de perfil vía pgvector)
                    │
  Grafo ────────────┼── Nodo: plan
  (LangGraph)       │   (recupera plan validado del tramo, lo comunica)
                    │
                    ├── Nodo: evaluación
                    │   (casos que el clasificador marca ambiguos)
                    │
                    └── Nodo: notificación
                        (evalúa criterio de derivación, redacta alerta)

  Todos los nodos consumen tools deterministas de src/tools/
  El estado del grafo lleva: pseudonym_id, tramo, estado dinámico, perfil recuperado
```

**Decisión abierta (PD-09)**: si la máquina de estados se expone como tool MCP o se
invoca como nodo determinista del grafo. Ambas rutas son compatibles con el modelo de
datos. Un nodo determinista dentro de LangGraph es lo más simple; exponerla como MCP
permite declarar esa herramienta en la ficha técnica.

---

## Flujo de datos

```
Registro paciente (meds, auto-reporte, asistencia)
        │
        ▼
[core] estratificación G0–G3          ← regla, sin modelo
        │
        ▼
[core] clasificación de estado         ← determinista
        │
        ├── confianza alta + benigno → registra, siguiente ciclo
        │
        └── ambiguo o riesgo → [agents] evaluación con modelo
                                        │
                                        ▼
                              [core] reglas de alerta
                                        │
                                        ▼
                              alerta → profesional / cuidador
                                        │
                                        ▼
                              validación humana (obligatoria)
```

---

## Estrategia de paralelización

El objetivo es que los cuatro vértices avancen sin bloquearse. El mecanismo son los
**contratos en `contracts/`**: cada tool tiene su esquema de entrada/salida definido
antes de implementarse, así la interfaz puede construirse contra datos de ejemplo
mientras el motor se desarrolla.

| Vértice | Trabaja en | Depende de |
|---------|-----------|------------|
| Joaquín | `data/planes/`, criterios (PD-01…05) | Nada — es la fuente |
| Gerardo | Matriz de priorización (PD-06), validación operativa | Nada — es la fuente |
| Patricio | `core/`, `agents/`, `tools/` | Criterios de Joaquín |
| Jonathan | `web/`, `api/` | Contratos en `contracts/`, no la implementación |

---

## Fases

**Fase 0 — Fundación (bloquea todo lo demás)**
Schema, generador de cohorte sintética, estratificación determinista.

**Fase 1 — US1: Bandeja clínica**
Primer entregable con valor. Demostrable solo con Fase 0.

**Fase 2 — US2: Interfaz paciente**
Registro de medicamentos e historial de controles.

**Fase 3 — US3 + US4: Agentes y clasificador**
Conversación, plan por tramo, clasificación de estado.

**Fase 4 — US5: Alertas**
Cierre del circuito con validación humana.

**Fase 5 — Evidencia**
Instrumentación de consumo, captura de consola, demo.

Si el tiempo se acorta, se recorta desde la Fase 4 hacia atrás. Las fases 0–2 constituyen
un MVP defendible por sí solo.

---

## Riesgos

| Riesgo | Mitigación |
|--------|-----------|
| Criterios clínicos (PD-01…05) llegan tarde | Fases 0–2 no dependen de ellos; se avanza en paralelo |
| El agente emite lenguaje diagnóstico | Batería de pruebas de inducción antes de la demo |
| Sobreingeniería del clasificador | Empezar con reglas simples; el componente dinámico es mejora, no requisito |
| Integración tardía entre vértices | Contratos definidos antes de implementar; integración temprana |
