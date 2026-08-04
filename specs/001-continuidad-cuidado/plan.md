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

**Language/Version**: Python 3.11+ (backend, agentes) · TypeScript (interfaces)

**Primary Dependencies**: Anthropic SDK (Claude Agent SDK, MCP) · FastAPI · Supabase
(PostgreSQL + pgvector) · React

**Storage**: PostgreSQL vía Supabase. pgvector para embeddings de perfil.

**Testing**: pytest (backend) · validación manual guiada por acceptance scenarios

**Target Platform**: Web (interfaz paciente + interfaz clínica). Backend en contenedor.

**Project Type**: Web app con backend de agentes

**Constraints**:
- Datos sintéticos exclusivamente. Cero PII.
- Claude como motor principal (requisito del Lab).
- Ventana de construcción: jornadas del evento.

**Scale/Scope**: MVP demostrable. Cohorte sintética suficiente para mostrar los cuatro
tramos y los estados. Escalamiento poblacional es proyección documentada, no
implementación.

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
├── agents/                  # Agentes con modelo
│   ├── conversacion.py      # Diálogo con paciente
│   ├── plan.py              # Recupera y comunica plan validado
│   ├── evaluacion.py        # Evalúa casos ambiguos
│   └── prompts/             # System prompts (guardrails)
│
├── tools/                   # Tools MCP expuestos a los agentes
│   ├── estratificar.py
│   ├── consultar_estado.py
│   ├── consultar_plan.py
│   └── evaluar_criterio.py
│
├── api/                     # FastAPI
│   ├── paciente.py
│   └── clinica.py
│
└── data/
    ├── schema.sql
    ├── seed_sintetico.py    # Generador de cohorte
    └── planes/              # Biblioteca de planes por tramo (PD-03)

web/
├── paciente/                # Registro meds, controles, chat
└── clinica/                 # Bandeja por tramo y estado

specs/001-continuidad-cuidado/
├── spec.md
├── plan.md
├── data-model.md
├── contracts/               # Contratos de tools — el pacto entre vértices
└── tasks.md
```

**Regla de separación**: `src/core/` no importa el SDK de Anthropic. Si necesita hacerlo,
esa lógica pertenece a `src/agents/`. Esta frontera hace verificable el principio VI.

---

## Arquitectura de agentes

Sistema de **varios agentes especializados**, no un agente único. La orquestación
específica se define en PD-08.

```
                    ┌── Agente de conversación
                    │   (diálogo con paciente, RAG de perfil)
                    │
  Orquestador ──────┼── Agente de plan
  (Agent SDK)       │   (recupera plan validado del tramo, lo comunica)
                    │
                    ├── Agente de evaluación
                    │   (casos que el clasificador marca ambiguos)
                    │
                    └── Agente de notificación
                        (evalúa criterio de derivación, redacta alerta)

  Todos consumen tools MCP deterministas de src/tools/
```

**Decisión abierta (PD-09)**: si la máquina de estados se expone como tool MCP o se
invoca directamente desde el orquestador. Ambas rutas son compatibles con el modelo de
datos.

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
