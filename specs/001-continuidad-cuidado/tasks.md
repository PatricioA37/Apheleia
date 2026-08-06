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
- [ ] T011 [P] Variables de entorno reales: `ANTHROPIC_API_KEY`, `VOYAGE_API_KEY`,
      `SUPABASE_URL`, `SUPABASE_KEY` en `.env` de cada persona (nunca en el repo).
      `SUPABASE_URL`/`SUPABASE_KEY` ya corregidas y verificadas contra el proyecto;
      faltan `ANTHROPIC_API_KEY` y `VOYAGE_API_KEY`
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
