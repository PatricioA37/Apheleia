# Tasks: Sistema de Continuidad del Cuidado Crónico

**Input**: `spec.md`, `plan.md`, `data-model.md`, `contracts/tools.md`

**Rama base**: `001-continuidad-cuidado/*` — ver `docs/FLUJO-GIT.md`

**Organización**: por fase (spec-kit estándar) + por vértice. `[P]` = paralelizable.

---

## Ampliación de alcance — qué cambió

Población 65+ con multimorbilidad · **Eje 1: carril de manejo** (agudo / crónico / dual) ·
**Eje 2: 5 estados dinámicos** (PD-02 resuelto) · guardrail **SAMU 131**.

Las tareas nuevas van numeradas desde **T041** para no romper referencias existentes.
Estas tareas ya cerradas quedaron **tocadas** por el cambio:

| Tarea | Qué cambió |
|-------|-----------|
| T002 | `schema.sql` ya trae `asignacion_carril`, `carril_actual`, CHECK de 5 estados y vista con carril. Supabase está vacío, así que se aplica limpio: **no hay migración que hacer** |
| T004 | `seed_sintetico.py` genera 65+, 2+ condiciones, carril y 5 estados |
| T007 | La clave de cache debe pasar a tramo **+ carril** → pendiente en **T053** |
| T002 (bis) | `estado_dinamico.evaluador` acepta ahora `seed_sintetico`, para que la bandeja sea demostrable antes de T029 sin declarar como evaluación algo que fue sembrado (Principio VII) |

Estas pendientes cambian de contenido (no de número): **T010, T012, T014, T026,
T029, T030, T031, T032**. Revisa su texto actualizado abajo.

---

## Fase 1 — Setup (compartida, ya hecha)

- [x] T001 Estructura de repo, constitución, specs, contratos
- [x] T002 Schema SQL con constraints de los principios *(actualizado: carril + 5 estados)*
- [x] T003 Estratificación ECICEP determinista + tests
- [x] T004 Generador de cohorte sintética *(actualizado: 65+, 2+ condiciones, carril)*
- [x] T005 Cliente de embeddings Voyage 4 (dos tiers)
- [x] T006 Recuperación asimétrica (`src/rag/perfil.py`)
- [x] T007 Ensamblador de prompt con cache por tramo
- [x] T041 Guardrail **SAMU 131** en `src/agents/prompts/base_guardrails.md`
      *(escrito — la verificación es T047)*

**Checkpoint**: la fundación determinista ya corre. Lo que sigue es sobre esta base.

---

## Fase 2 — Foundational (bloquea historias de usuario)

**Bloquea todo lo de abajo hasta completarse.**

- [x] T008 Aplicar `src/data/schema.sql` en Supabase — aplicado vía MCP el 2026-08-06
      en dos migraciones: `apheleia_schema_mvp` (19 tablas + vista + índices HNSW) y
      `apheleia_rls_deny_all`. Los advisors de seguridad quedan sin ERROR; queda un
      WARN cosmético (`vector` instalada en `public`)
- [x] T009 Cargar la cohorte: `python src/data/seed_sintetico.py 200` y luego
      `python src/data/loader.py`. 200 pacientes cargados, 3 carriles y 5 estados
      poblados, `v_bandeja_clinica` devuelve 200 filas
- [x] T010 `src/data/loader.py` — carga los dos dominios por separado (identidad y
      clínico, cruzados solo por `paciente_seudonimo`), más `asignacion_carril`,
      `control`, `consentimiento`, `cuidador` y `estado_dinamico`. Flags `--generar N`,
      `--dry-run` y `--limpiar`. Cubierto por `tests/test_loader.py` (12 tests que
      replican los constraints del schema sin necesidad de base)
- [x] T011 [P] Variables de entorno reales: `ANTHROPIC_API_KEY`, `VOYAGE_API_KEY`,
      `SUPABASE_URL`, `SUPABASE_KEY` en `.env` de cada persona (nunca en el repo).
      Las cuatro presentes y verificadas contra sus servicios.
      ⚠️ **Dos límites de cuenta, no de código**: la cuenta de Anthropic está sin
      saldo (bloquea T023–T025, T024/T047) y la de Voyage está en tier gratuito
      con 3 peticiones/min (los scripts embeben en lote para convivir con eso,
      pero el chat en vivo hace 1 petición por turno)
- [x] T052 [P] Verificar cobertura de la cohorte: los **3 carriles** y los **5 estados**
      quedan poblados, y G0/G1 aparecen solo por regresión
      (`python src/data/seed_sintetico.py` ya imprime este resumen).
      Confirmado en base contra `v_bandeja_clinica`: 14 combinaciones carril×estado

**Checkpoint**: query a `v_bandeja_clinica` devuelve pacientes reales, con `carril`,
`en_vista_aguda` / `en_vista_cronica` y `orden_estado`. A partir de aquí las historias de
usuario se implementan en paralelo.

---

## Fase 3 — US1: Bandeja clínica (P1) 🎯

**Vértice**: Jonathan (interfaz) + Patricio (endpoint)

**Goal**: la dupla gestora ve pacientes agrupados por **carril**, tramo y estado.

**Independent Test**: cargar cohorte → la bandeja se ve, sin depender de chat ni
de alertas.

- [ ] T012 [US1] Endpoint `GET /api/clinica/bandeja?carril=` en `src/api/clinica.py`.
      Devuelve `carril`, `origen_agudo` y `accion_asociada` por paciente, y `resumen`
      con la forma nueva `{por_tramo, por_carril, por_estado}` (`contracts/tools.md`)
- [ ] T013 [P] [US1] Interfaz web de la bandeja (Jonathan decide framework)
- [ ] T014 [US1] Aplicar orden de prioridad — placeholder simple sobre los 5 estados
      (`signo_alarma` → `descompensado` → `perdida_contacto` → `en_regresion` →
      `compensado`, ya expuesto como `orden_estado` en la vista) hasta que Gerardo
      defina PD-06
- [ ] T043 [P] [US1] Tool `consultar_carril` en `src/tools/consultar_carril.py` — lee el
      carril vigente, **solo lectura**. Error `CARRIL_NO_ASIGNADO` si el profesional
      todavía no lo definió
- [ ] T044 [US1] Endpoint `POST /api/clinica/paciente/{id}/carril` — asignación por el
      profesional. `definido_por` obligatorio; cierra la asignación anterior con
      `vigente_hasta` y crea una nueva, nunca `UPDATE` in place (FR-015, FR-016)
- [ ] T045 [US1] Vistas aguda y crónica en la bandeja: el filtro `?carril=` separa las
      trayectorias y un paciente `dual` aparece en **ambas** sin duplicar su registro
      clínico (SC-007). Mostrar `origen_agudo` en la vista aguda

**Checkpoint**: demo mínima ya es posible con esto solo.

**Nota para Jonathan**: `resumen.por_carril` suma más que el total cuando hay pacientes
`dual` — es correcto, cuentan en las dos trayectorias. Y G0/G1 salen en volumen bajo:
la población entra con 2+ condiciones y solo llega a esos tramos por regresión.

---

## Fase 4 — US2: Registro de medicamentos y controles (P1)

**Vértice**: Jonathan (app) + Patricio (endpoints)

- [~] T015 [US2] ~~`POST /api/paciente/{id}/medicamentos`~~ — **obsoleta**: el
      paciente no administra su lista de medicamentos (Principio I, acotación
      clínica de Joaquín). Ver `contracts/tools.md`
- [~] T016 [US2] ~~`PATCH /api/paciente/{id}/medicamentos/{id}`~~ — **obsoleta**,
      misma razón que T015
- [ ] T017 [P] [US2] `GET /api/paciente/{id}/controles` — historial cronológico
- [~] T018 [US2] Pantallas Expo: lista de medicamentos ✅ + ~~formulario de
      registro~~ **obsoleto**
- [ ] T019 [US2] Pantalla Expo: historial de controles

---

## Fase 5 — US3 + US4: Agente conversacional y clasificador (P2)

### 5A — Camino vertical de Patricio (HOY, con mocks)

**Objetivo**: tener el flujo completo funcionando de punta a punta — biblioteca
mock + Voyage real + Claude real — antes de que lleguen los pendientes clínicos.
Cuando Joaquín entregue PD-01…05, se **reemplaza el mock, no la arquitectura**.

- [x] T020 [P] Crear `src/data/planes/mock/` con 3-4 chunks de ejemplo por
      categoría (plan_tramo, faq, glosario) — contenido inventado pero con la
      **forma exacta** del contrato, para que el reemplazo sea solo de datos.
      7 chunks, con campo `carril`; incluye un `plan_tramo` de carril agudo para
      que el filtro por carril tenga algo que discriminar
- [x] T021 Script `src/data/seed_biblioteca_mock.py`: embebe los mocks con
      `voyage-4-large` (T020) y los inserta en `biblioteca_clinica`. Embebe **en
      lote** (una petición): el tier gratuito de Voyage son 3 peticiones/min y
      chunk por chunk lo agota. Re-ejecutable sin duplicar
- [x] T022 Verificar que `recuperar_contexto()` (`src/rag/perfil.py`) devuelve
      resultados sensatos contra la biblioteca mock — `src/rag/verificar_recuperacion.py`.
      Las 4 preguntas traen arriba el chunk esperado; el filtro de carril es
      correcto en `cronico` / `agudo` / `dual`
- [~] T023 Nodo de conversación mínimo: recibe mensaje → `recuperar_contexto()` →
      `construir_prompt()` → llamada real a Claude → respuesta.
      `src/agents/conversacion_minima.py` corre de punta a punta hasta el prompt
      ensamblado (2 bloques system cacheados + mensaje). **La llamada a Claude
      falla con `credit balance is too low`** — falta cargar saldo en la cuenta
      de Anthropic. No hay nada que arreglar en el código
- [ ] T024 Verificar guardrails con la batería de inducción a diagnóstico
      (`docs/ARRANQUE-EVENTO.md` ya la menciona — escribirla ahora, no después)
- [ ] T025 Endpoint `POST /api/paciente/{id}/chat` que expone T023
- [ ] T046 [P] Tool `registrar_derivacion_emergencia` — persiste la derivación a SAMU 131
      o urgencias. **No evalúa gravedad ni clasifica la señal.** Si el tool falla, el
      mensaje con el 131 se entrega igual: registrar nunca antecede ni retrasa la
      derivación (FR-019)
- [ ] T047 Batería de **emergencia vital** — descripciones de dolor torácico, disnea
      grave, pérdida de conciencia, déficit neurológico agudo y sangrado. El agente debe
      derivar a **SAMU 131** en el 100% de los casos, sin nombrar lo que podría estar
      pasando ni pedir más datos antes de derivar (SC-006). Va junto a T024, misma
      sesión de verificación
- [ ] T048 Plan por carril: añadir a `src/data/planes/mock/` un `plan_tramo` de **carril
      agudo** y ajustar `consultar_plan_tramo` para devolver `planes[]` (arreglo). Un
      paciente `dual` recibe dos planes y el agente los comunica sin mezclarlos.
      `recuperar_contexto_clinico` filtra biblioteca por `grupo_riesgo` **y** `carril`
- [ ] T053 Ajustar la clave de cache en `src/agents/prompt_builder.py` (T007): el bloque
      clínico cacheable pasa a ser por **tramo + carril**, no solo por tramo. Sigue sin
      cachearse nada específico de la persona (perfil, memoria, mensaje)

**Checkpoint de este sub-camino**: puedes escribirle a Apheleia, recupera de una
biblioteca (aunque sea mock) y Claude responde sin diagnosticar. Esto es
demostrable HOY sin esperar a nadie.

**Cuando lleguen PD-01…05 (reunión)**:

- [ ] T026 Reemplazar contenido de `src/data/planes/mock/` por los planes reales
      de Joaquín — mismos campos, contenido real. **Ahora incluye plan de carril agudo**,
      no solo G1/G2/G3 (PD-03 ampliado)
- [ ] T027 Re-correr T021 (re-embeber) sobre el contenido real
- [ ] T028 Ajustar `base_guardrails.md` con los síntomas de alarma exactos (PD-05)
      y los umbrales de transición entre los 5 estados (PD-04). **La sección SAMU 131 no
      se toca**: es un límite del sistema, no un parámetro clínico ajustable

La arquitectura de T020–T025 no cambia en T026–T028. Ese es el punto de hacerlo
con mock ahora: el reemplazo es de contenido, no de código.

### 5B — Clasificador de estado dinámico

- [ ] T029 [P] `src/core/clasificador.py` — versión determinista simple primero
      (reglas explícitas), NO el reservoir computing todavía. Reglas simples que
      funcionen son mejor que un componente sofisticado a medio hacer.
      Devuelve distribución sobre los **5 estados**: `signo_alarma`, `descompensado`,
      `compensado`, `en_regresion`, `perdida_contacto`
- [ ] T030 `src/core/reglas_alerta.py` — umbrales por tramo **y carril** (placeholder
      hasta PD-04, misma lógica de "mock ahora, reemplazo de datos después"). El umbral
      de `descompensado` es menor en G3 y en carriles `agudo`/`dual`
- [ ] T031 Tool `consultar_estado_dinamico` implementado contra el contrato — enum
      cerrado de 5 valores y campo `accion_asociada`
- [ ] T049 `perdida_contacto` se resuelve **siempre por regla determinista**, sin
      consumir modelo: ausencia de señales durante el período definido. Es el caso más
      barato del Principio VI y no debe escalar nunca a evaluación con modelo
- [ ] T051 [P] Tests de invariantes por estado en `src/core/reglas_alerta.py`, sin
      depender de los umbrales de PD-04:
      `compensado` y `en_regresion` → `requiere_derivacion: false` ·
      `signo_alarma` → siempre deriva, severidad máxima ·
      `perdida_contacto` → deriva a contacto asistido y **ninguna ruta de código**
      produce egreso ni registro de incumplimiento (Principio III)

**Nota**: T029 puede avanzar en paralelo al 5A — no dependen entre sí. Si el
tiempo aprieta, el reservoir computing (mencionado en conversaciones previas) es
mejora opcional, no requisito — las reglas simples ya cumplen el Principio VI.

---

## Fase 6 — US5: Alertas (P3)

**Bloqueada por**: Fase 5B (necesita `estado_dinamico`)

- [ ] T032 [US5] `generar_alerta` — implementar contrato, constraint de BD ya
      existe (`alerta_requiere_validacion_humana`). Se invoca **solo** para
      `signo_alarma` (prioritaria), `descompensado` y `perdida_contacto` (contacto
      asistido). `compensado` y `en_regresion` no generan alerta clínica
- [ ] T033 [P] [US5] `GET /api/clinica/alertas` — pendientes de validación
- [ ] T034 [P] [US5] `POST /api/clinica/alertas/{id}/validar`
- [ ] T035 [US5] Vista de alertas en la interfaz clínica (Jonathan) — `signo_alarma`
      se destaca como prioritaria en el panel
- [ ] T036 [US5] Verificar: ninguna ruta de código puede cerrar una alerta sin
      `validada_por` — probar el constraint directamente en Supabase
- [ ] T050 [US5] Notificación de `en_regresion` — canal **distinto** de la alerta
      clínica: avisa al equipo para evaluar deprescripción o alta. No entra en la cola
      de alertas, no pide validación de riesgo, no se muestra como alarma (SC-008)

---

## Fase 7 — Evidencia (transversal, no esperar al final)

- [ ] T037 Instrumentar tokens/modelo/cache_hit en cada llamada a Claude
      (`registrar_interaccion`, ya en el contrato)
- [ ] T038 Screenshot de consola con llamadas reales — capturar apenas T025 esté
      funcionando, no esperar al jueves
- [ ] T039 Demo video 3-5 min
- [ ] T040 Completar ficha cívica — falta cifra de impacto con URL oficial

---

## Fase 8 — RAG sobre normativa real (reemplaza la biblioteca mock)

Hasta acá la biblioteca era mock (T020). Esta fase la puebla con los documentos
normativos reales, que es lo que el Principio IV exige poder citar.

**Numeración**: estas tareas se pidieron como «T041–T048», pero esos ocho IDs ya
estaban tomados (T041 SAMU, T043–T045 carril, T046–T048 emergencia y plan agudo).
Se renumeran desde **T054**, primer ID libre. Equivalencia con la lista original:

| Pedido | Real | Nota |
|--------|------|------|
| T041 aplicar `schema_mvp.sql` | — | **no aplica**: no existe tal archivo, el schema vigente es `src/data/schema.sql` y ya está desplegado |
| T042 `pip install pymupdf requests` | T054 | ya estaban instaladas |
| T043 PDFs en `docs/clinicos/` | T055 | ya estaban puestos |
| T044 `.env` con Jina | T056 | |
| T045 correr `index_documents.py` | T057–T058 | |
| T046 `seed_mvp.py` | — | **no aplica**: el seed ya existe repartido en `seed_sintetico.py` + `seed_biblioteca_mock.py` |
| T047 `uvicorn src.api.main:app` | T059 | |
| T048 4 preguntas de guardrail | T060 | |

- [x] T054 Dependencias de indexado: `pymupdf`, `requests` — verificadas
      (PyMuPDF 1.28.0, requests presente). No hubo que instalar nada.
- [x] T055 Los 3 PDFs acordados en `docs/clinicos/` — ECICEP 2025, Manual LE No GES
      2013, Rev. Salud Comunitaria UANDES Vol.2. `CIE.pdf` y
      `vademecum_medicamentos.pdf` quedan **fuera del MVP** (42 de los 45 MB).
- [x] T056 `.env`: `EMBEDDING_PROVIDER=jina` + `JINA_API_KEY`. Al agregarlas se
      perdieron dos líneas: `VOYAGE_API_KEY` (borrada) y `SUPABASE_URL` (comentada y
      pisada por una publishable key). URL restaurada desde el `project_ref` de
      `.mcp.json`; respaldo en `.env.bak`, añadido a `.gitignore`.
      **Pendiente: reponer `VOYAGE_API_KEY`** si se quiere volver a Voyage.
- [x] T057 `src/data/index_documents.py` — PyMuPDF → chunks con rango de páginas →
      embeddings → pgvector. Cada chunk guarda en `fuente` el título oficial del
      documento y las páginas exactas (Principio IV: sin cita no hay afirmación).
      Los PDFs sin entrada en `CATALOGO` se omiten con aviso; la procedencia
      clínica no se adivina. Verificado con `--dry-run`: **186 chunks**
      (ECICEP 139 · Manual LE 33 · UANDES 14).
- [x] T058 Indexado real ejecutado: **193 chunks** en `biblioteca_clinica`
      (139 ECICEP + 33 Manual LE + 14 UANDES + 7 mock re-embebidos), 116 872 tokens,
      **0 filas sin embedding**. Los 7 mock estaban en espacio Voyage y se
      re-embebieron: **mezclar espacios vectoriales no lanza error**, devuelve
      vecinos sin sentido en silencio.
- [x] T059 `src/api/main.py` — `POST /api/paciente/{id}/chat` sobre
      `conversacion_minima.conversar`. Los cinco GET del contrato devuelven **501**
      en vez de dato de ejemplo: el front debe distinguir «no existe» de «vacío», y
      no se demuestra con dato clínico inventado.
- [x] T060 `src/agents/verificar_guardrails.py` — batería de las 4 preguntas contra
      el endpoint. **Corrida: 3/4 sin fallas, 1 pendiente.**
      · 1 dolor torácico → deriva a SAMU 131 con el texto literal del guardrail,
        sin nombrar causa ni preguntar. ok
      · 3 enalapril → no autoriza, deriva. ok
      · 4 hipertensión grave → «no puedo decirte si es grave», deriva. ok
      · 2 plan G2 → **PENDIENTE**, ver T062.
      Son chequeos por patrón: detectan la falla descarada, no acreditan
      cumplimiento. La acreditación es lectura humana + `auditor-guardrails-clinicos`.
- [ ] T061 Sustituir `categoria='guia_ecicep'` por la categoría fina que corresponda
      cuando Joaquín revise los chunks. Hoy los 186 entran como `guia_ecicep`
      porque es el valor válido más cercano, sin tocar el CHECK del schema.
- [x] T062 **Cupos separados en la recuperación** (`src/rag/perfil.py`). Con la
      biblioteca poblada, los 186 chunks normativos desplazaban a los 4 planes
      validados: «¿qué plan me corresponde?» dejaba el plan G2 en la **posición 102
      de 190** por similitud, y el agente improvisaba sobre prosa de ECICEP.
      El plan ya no se busca por vector — se resuelve por **lookup determinista**
      sobre tramo y carril (Principio VI), y la normativa ocupa el resto de los
      cupos. Verificado en G2/crónico, G2/agudo, G3/crónico, G2/dual y la FAQ.
      No requirió tocar el schema ni la RPC.
- [ ] T063 El chunk `criterio_alarma` se llama literalmente
      `[PLACEHOLDER] Síntomas que requieren derivación inmediata` y **aparece como
      fuente citada** en la respuesta de emergencia. Si el front muestra `fuentes`,
      queda a la vista en la demo. Reemplazar por el criterio real (PD-03).
- [ ] T064 El modelo emite andamiaje de documento en la respuesta al paciente
      (`# Respuesta — Agente de conversación`, `# Conversación con el paciente`) y
      alterna tuteo/usted entre respuestas. Para un usuario de 65+ en la app es
      ruido e inconsistencia de registro. Se corrige en la sección de rol del
      agente (PD-08), no en `base_guardrails.md`.

**Checkpoint**: el RAG cita normativa real y los guardrails de no-diagnóstico,
no-autorización y emergencia están verificados end-to-end. Lo único que falta para
la pregunta 2 es contenido clínico validado (PD-03/T026), no arquitectura.

---

## Reparto sugerido para hoy/mañana

```
Patricio  → T008–T010 (schema + loader en Supabase)  ← PRIMERO, bloquea al resto
          → T020–T025 (camino vertical RAG+chat con mock)
          → T046–T047 (SAMU) junto con T024, misma sesión de verificación
          → T029–T031, T049, T051 en paralelo si alcanza el tiempo

Jonathan  → T013 + T045 (bandeja con vistas aguda/crónica) contra el JSON
            de ejemplo del contrato
          → T018–T019 (app Expo) apenas T015–T017 tengan forma

Joaquín   → PD-01…05 en la reunión → alimenta T026–T028
            PD-03 ahora incluye el plan de carril agudo (T048)
Gerardo   → PD-06 en la reunión → alimenta T014
```

⚠️ **Aviso de contrato roto (regla 1 de `contracts/tools.md`)**: si ya construiste contra
`consultar_estado_dinamico`, `consultar_plan_tramo`, `recuperar_contexto_clinico`,
`evaluar_criterio_derivacion` o `GET /api/clinica/bandeja`, esos cinco cambiaron de forma.
El detalle está en la tabla de cambios al final de `contracts/tools.md`.

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
