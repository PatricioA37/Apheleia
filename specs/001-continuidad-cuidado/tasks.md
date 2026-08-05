# Tasks: Sistema de Continuidad del Cuidado Crónico

**Input**: `spec.md`, `plan.md`, `data-model.md`, `contracts/tools.md`

**Rama base**: `001-continuidad-cuidado/*` — ver `docs/FLUJO-GIT.md`

**Organización**: por fase (spec-kit estándar) + por vértice. `[P]` = paralelizable.

---

## Fase 1 — Setup (compartida, ya hecha)

- [x] T001 Estructura de repo, constitución, specs, contratos
- [x] T002 Schema SQL con constraints de los principios
- [x] T003 Estratificación ECICEP determinista + tests
- [x] T004 Generador de cohorte sintética
- [x] T005 Cliente de embeddings Voyage 4 (dos tiers)
- [x] T006 Recuperación asimétrica (`src/rag/perfil.py`)
- [x] T007 Ensamblador de prompt con cache por tramo

**Checkpoint**: la fundación determinista ya corre. Lo que sigue es sobre esta base.

---

## Fase 2 — Foundational (bloquea historias de usuario)

**Bloquea todo lo de abajo hasta completarse.**

- [ ] T008 Aplicar `src/data/schema.sql` en Supabase
- [ ] T009 Cargar `cohorte_sintetica.json` en Supabase (falta el loader — ver T010)
- [ ] T010 [P] Escribir `src/data/loader.py`: inserta cohorte generada en
      `paciente_clinico`, `condicion_cronica`, `estratificacion`, `indicacion`
- [ ] T011 [P] Variables de entorno reales: `ANTHROPIC_API_KEY`, `VOYAGE_API_KEY`,
      `SUPABASE_URL`, `SUPABASE_KEY` en `.env` de cada persona (nunca en el repo)

**Checkpoint**: query a `v_bandeja_clinica` devuelve pacientes reales. A partir de
aquí las historias de usuario se implementan en paralelo.

---

## Fase 3 — US1: Bandeja clínica (P1) 🎯

**Vértice**: Jonathan (interfaz) + Patricio (endpoint)

**Goal**: la dupla gestora ve pacientes agrupados por tramo y estado.

**Independent Test**: cargar cohorte → la bandeja se ve, sin depender de chat ni
de alertas.

- [ ] T012 [US1] Endpoint `GET /api/clinica/bandeja` en `src/api/clinica.py`
      (contrato ya definido en `contracts/tools.md`)
- [ ] T013 [P] [US1] Interfaz web de la bandeja (Jonathan decide framework)
- [ ] T014 [US1] Aplicar orden de prioridad — placeholder simple (por tramo, luego
      por estado) hasta que Gerardo defina PD-06

**Checkpoint**: demo mínima ya es posible con esto solo.

---

## Fase 4 — US2: Registro de medicamentos y controles (P1)

**Vértice**: Jonathan (app) + Patricio (endpoints)

- [ ] T015 [P] [US2] `POST /api/paciente/{id}/medicamentos` — crea indicación
- [ ] T016 [P] [US2] `PATCH /api/paciente/{id}/medicamentos/{id}` — cierra la
      anterior (`vigente_hasta`), crea nueva (nunca `UPDATE` in place)
- [ ] T017 [P] [US2] `GET /api/paciente/{id}/controles` — historial cronológico
- [ ] T018 [US2] Pantallas Expo: lista de medicamentos + formulario de registro
- [ ] T019 [US2] Pantalla Expo: historial de controles

---

## Fase 5 — US3 + US4: Agente conversacional y clasificador (P2)

### 5A — Camino vertical de Patricio (HOY, con mocks)

**Objetivo**: tener el flujo completo funcionando de punta a punta — biblioteca
mock + Voyage real + Claude real — antes de que lleguen los pendientes clínicos.
Cuando Joaquín entregue PD-01…05, se **reemplaza el mock, no la arquitectura**.

- [ ] T020 [P] Crear `src/data/planes/mock/` con 3-4 chunks de ejemplo por
      categoría (plan_tramo, faq, glosario) — contenido inventado pero con la
      **forma exacta** del contrato, para que el reemplazo sea solo de datos
- [ ] T021 Script `src/data/seed_biblioteca_mock.py`: embebe los mocks con
      `voyage-4-large` (T020) y los inserta en `biblioteca_clinica`
- [ ] T022 Verificar que `recuperar_contexto()` (`src/rag/perfil.py`) devuelve
      resultados sensatos contra la biblioteca mock — prueba manual con 2-3
      preguntas de ejemplo
- [ ] T023 Nodo de conversación mínimo: recibe mensaje → `recuperar_contexto()` →
      `construir_prompt()` → llamada real a Claude → respuesta
      (`src/graph/nodos/conversacion.py` o, si LangGraph aún no está montado,
      una función simple primero — no bloquear en la orquestación)
- [ ] T024 Verificar guardrails con la batería de inducción a diagnóstico
      (`docs/ARRANQUE-EVENTO.md` ya la menciona — escribirla ahora, no después)
- [ ] T025 Endpoint `POST /api/paciente/{id}/chat` que expone T023

**Checkpoint de este sub-camino**: puedes escribirle a Apheleia, recupera de una
biblioteca (aunque sea mock) y Claude responde sin diagnosticar. Esto es
demostrable HOY sin esperar a nadie.

**Cuando lleguen PD-01…05 (reunión)**:

- [ ] T026 Reemplazar contenido de `src/data/planes/mock/` por los planes reales
      de Joaquín — mismos campos, contenido real
- [ ] T027 Re-correr T021 (re-embeber) sobre el contenido real
- [ ] T028 Ajustar `base_guardrails.md` con los síntomas de alarma exactos (PD-05)
      y los umbrales de derivación (PD-04)

La arquitectura de T020–T025 no cambia en T026–T028. Ese es el punto de hacerlo
con mock ahora: el reemplazo es de contenido, no de código.

### 5B — Clasificador de estado dinámico

- [ ] T029 [P] `src/core/clasificador.py` — versión determinista simple primero
      (reglas explícitas), NO el reservoir computing todavía. Reglas simples que
      funcionen son mejor que un componente sofisticado a medio hacer
- [ ] T030 `src/core/reglas_alerta.py` — umbrales por tramo (placeholder hasta
      PD-04, misma lógica de "mock ahora, reemplazo de datos después")
- [ ] T031 Tool `consultar_estado_dinamico` implementado contra el contrato

**Nota**: T029 puede avanzar en paralelo al 5A — no dependen entre sí. Si el
tiempo aprieta, el reservoir computing (mencionado en conversaciones previas) es
mejora opcional, no requisito — las reglas simples ya cumplen el Principio VI.

---

## Fase 6 — US5: Alertas (P3)

**Bloqueada por**: Fase 5B (necesita `estado_dinamico`)

- [ ] T032 [US5] `generar_alerta` — implementar contrato, constraint de BD ya
      existe (`alerta_requiere_validacion_humana`)
- [ ] T033 [P] [US5] `GET /api/clinica/alertas` — pendientes de validación
- [ ] T034 [P] [US5] `POST /api/clinica/alertas/{id}/validar`
- [ ] T035 [US5] Vista de alertas en la interfaz clínica (Jonathan)
- [ ] T036 [US5] Verificar: ninguna ruta de código puede cerrar una alerta sin
      `validada_por` — probar el constraint directamente en Supabase

---

## Fase 7 — Evidencia (transversal, no esperar al final)

- [ ] T037 Instrumentar tokens/modelo/cache_hit en cada llamada a Claude
      (`registrar_interaccion`, ya en el contrato)
- [ ] T038 Screenshot de consola con llamadas reales — capturar apenas T025 esté
      funcionando, no esperar al jueves
- [ ] T039 Demo video 3-5 min
- [ ] T040 Completar ficha cívica — falta cifra de impacto con URL oficial

---

## Reparto sugerido para hoy/mañana

```
Patricio  → T020–T025 (camino vertical RAG+chat con mock)  ← EMPIEZA AHORA
          → T029–T031 en paralelo si alcanza el tiempo

Jonathan  → T013 (bandeja) mientras Patricio no tiene T012 listo,
            construir contra el JSON de ejemplo del contrato
          → T018–T019 (app Expo) apenas T015–T017 tengan forma

Joaquín   → PD-01…05 en la reunión → alimenta T026–T028
Gerardo   → PD-06 en la reunión → alimenta T014
```

**Por qué T020 antes que esperar a Joaquín**: el contrato de `biblioteca_clinica`
y de `consultar_plan_tramo` ya está fijado (`contracts/tools.md`). Un mock que
respeta ese contrato no se tira a la basura cuando llegue el contenido real — se
reemplaza fila por fila. Es la misma lógica que ya usamos con la cohorte
sintética: la forma es lo que importa hoy, el contenido clínico llega después.

## Checkpoint de fin de día

Si al cerrar la jornada de hoy tienes T020–T025 funcionando, mañana con los
pendientes resueltos el trabajo es **sustituir datos, no escribir arquitectura
nueva** — que es exactamente el objetivo de haber hecho esto con spec-driven
development desde el principio.
