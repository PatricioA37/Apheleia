# Feature Specification: Sistema de Continuidad del Cuidado Crónico

**Feature Branch**: `001-continuidad-cuidado`

**Created**: 2026-08-04

**Status**: Draft — alcance ampliado (población 65+, carriles de manejo, 5 estados dinámicos)

**Input**: Complementar el vacío de información entre controles médicos en personas
mayores de 65 años con multimorbilidad —en seguimiento crónico, en tránsito post-agudo o
ambos a la vez—, mediante agentes que evalúan riesgo según parámetros definidos por el
profesional y mantienen trazabilidad continua.

---

## Contexto

En Chile, la mayoría de la población adulta vive con dos o más enfermedades crónicas. El
sistema atiende en el control, pero **entre un control y otro no hay sistema**: nadie sabe
qué le pasa al paciente hasta la próxima cita, o hasta que reingresa por urgencias.

ECICEP (Marco Operativo 2025, MINSAL) contempla las modalidades de *seguimiento a
distancia* y *transición del cuidado*, pero hoy no tienen soporte sistemático. Apheleia
da infraestructura a esas modalidades.

**Lo que el sistema aporta**: hacer visible el intervalo entre controles. No predice el
futuro; elimina un agujero negro de información.

---

## Población objetivo

**Personas mayores de 65 años con multimorbilidad** — dos o más condiciones crónicas
activas codificadas en CIE-10.

**Ámbito**: sistema de salud chileno, **público y privado**. El criterio de
estratificación es ECICEP (MINSAL); en el ámbito privado se aplica el mismo criterio de
conteo, con la modalidad de seguimiento que defina el prestador.

Consecuencia sobre la estratificación: el criterio de inclusión (2+ condiciones) hace que
la cohorte se concentre en **G2 y G3**. G0 y G1 siguen definidos en la regla y se alcanzan
por **regresión** (deprescripción, resolución de una condición), no por ingreso.

---

## Ejes de clasificación

El sistema ubica a cada persona en **dos ejes independientes y simultáneos**. Un paciente
tiene siempre un valor en cada eje.

### Eje 1 — Carril de manejo (estrato + tipo de manejo)

Lo define **el profesional durante la atención**; no lo infiere el sistema ni un modelo.

| Carril | Qué cubre | Estrato |
|--------|-----------|---------|
| `agudo` | Post-alta quirúrgica, post-urgencia, post-hospitalización | Tránsito post-agudo |
| `cronico` | APS y especialidades, seguimiento habitual | ECICEP G0–G3 |
| `dual` | Ambos a la vez, en paralelo | ECICEP G0–G3 **+** tránsito post-agudo |

El carril `dual` no es un tercer estado excluyente: significa que las dos trayectorias
corren simultáneamente y el paciente aparece en ambas vistas de la bandeja.

### Eje 2 — Estado dinámico

Cinco estados. Cada uno tiene una acción asociada, definida y no negociable.

| # | Estado | Acción del sistema |
|---|--------|--------------------|
| 1 | `signo_alarma` | Reconsulta inmediata + alerta prioritaria en el panel |
| 2 | `descompensado` | Alerta a la dupla gestora para ajuste activo |
| 3 | `compensado` | Acompañamiento de rutina + refuerzo de automanejo |
| 4 | `en_regresion` | Notificar para evaluar deprescripción o alta |
| 5 | `perdida_contacto` | Contacto asistido — **sin sanción ni egreso** (Principio III) |

`en_regresion` es una señal positiva: el paciente mejora y el sistema lo hace visible para
que el equipo decida deprescribir o dar de alta. No dispara alarma.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Estratificación y estado visible para la dupla gestora (Priority: P1)

La dupla gestora (profesional + TENS) abre su bandeja y ve a sus pacientes agrupados por
**carril de manejo** (agudo / crónico / dual), por tramo ECICEP y por estado dinámico,
ordenados por prioridad. En vez de revisar cientos de fichas, ve quiénes se desviaron esta
semana y quiénes vienen saliendo de un evento agudo.

**Why this priority**: Es el núcleo del valor y lo único que funciona sin ninguna otra
pieza. Sin esto no hay producto. Demostrable con datos sintéticos puros.

**Independent Test**: Cargar cohorte sintética → el sistema calcula tramo G0–G3 por
conteo de condiciones y muestra la bandeja priorizada. Entrega valor aunque no exista
chat, ni alertas, ni clasificador.

**Acceptance Scenarios**:

1. **Given** un paciente con 5 condiciones crónicas activas, **When** se calcula su
   estratificación, **Then** el sistema lo clasifica en G3 y registra el cálculo con
   `vigente_desde`.
2. **Given** un paciente con 1 condición crónica, **When** se calcula su estratificación,
   **Then** el sistema lo clasifica en G1.
3. **Given** una cohorte con pacientes en distintos estados, **When** la dupla gestora
   abre la bandeja, **Then** ve los pacientes ordenados con los de mayor riesgo primero.
4. **Given** un paciente cuyo número de condiciones cambia, **When** se re-estratifica,
   **Then** se crea un registro nuevo y el anterior queda con `vigente_hasta`, sin
   sobrescribir.
5. **Given** un paciente al que el profesional asignó carril `agudo` tras un alta
   quirúrgica, **When** la dupla gestora abre la bandeja, **Then** aparece en la vista de
   carril agudo con el origen del evento registrado.
6. **Given** un paciente en carril `dual`, **When** la dupla gestora abre la bandeja,
   **Then** aparece simultáneamente en la vista aguda y en la crónica, con un único
   estado dinámico vigente.
7. **Given** un paciente cuyo carril cambia (por ejemplo, de `agudo` a `cronico` al
   cerrar el tránsito), **When** el profesional lo reasigna, **Then** la asignación
   anterior queda con `vigente_hasta` y se crea una nueva, sin sobrescribir.

---

### User Story 2 — Consulta de medicamentos y controles por el paciente (Priority: P1)

El paciente (o su cuidador) consulta los medicamentos que su equipo de salud le indicó
y su historial de controles en una interfaz simple.

**Why this priority**: Es la fuente de las señales que alimentan todo lo demás, y el
número de medicamentos modula la intensidad del seguimiento según ECICEP. Sin datos de
entrada no hay estado dinámico.

**Independent Test**: Un paciente con 8 indicaciones vigentes abre su lista → las ve
todas con dosis y frecuencia, y el conteo queda disponible para modular la intensidad
del seguimiento.

**Acceptance Scenarios**:

1. **Given** un paciente con indicaciones vigentes, **When** abre su lista de
   medicamentos, **Then** ve cada una con la dosis y la frecuencia tal como su
   profesional las indicó, y ninguna acción para agregarlas o editarlas.
2. **Given** una indicación cuya frecuencia no es posología de tres tomas (por ejemplo
   «cada 8 h»), **When** el paciente la consulta, **Then** ve el texto de la frecuencia
   y **no** una grilla de tomas inferida por el sistema.
3. **Given** un paciente con historial, **When** consulta sus controles, **Then** ve la
   secuencia cronológica con modalidad ECICEP de cada uno.

---

### User Story 3 — Conversación con el agente y plan por tramo (Priority: P2)

El paciente conversa con Apheleia. El agente recupera su perfil (tramo, condiciones,
medicamentos, historial de estados) y comunica el plan validado correspondiente a su
tramo, de forma personalizada.

**Why this priority**: Es la cara visible del sistema y donde se demuestra el uso de
Claude, pero depende de que exista la estratificación (US1) y los datos (US2).

**Independent Test**: Un paciente G2 conversa con el agente → recibe orientación
coherente con el plan validado de G2, sin lenguaje diagnóstico, con derivación cuando
corresponde.

**Acceptance Scenarios**:

1. **Given** un paciente en tramo G2, **When** consulta al agente sobre su cuidado,
   **Then** el agente responde según el plan validado de G2, sin diagnosticar.
2. **Given** un paciente que describe un síntoma de alarma predefinido, **When** lo
   comunica al agente, **Then** el agente deriva al profesional y no interpreta el
   síntoma.
3. **Given** un paciente que describe una situación compatible con **emergencia vital**
   (dolor torácico, dificultad respiratoria grave, pérdida de conciencia, déficit
   neurológico agudo), **When** lo comunica al agente, **Then** el agente indica llamar
   de inmediato al **SAMU 131** o acudir a urgencias, no intenta evaluar la gravedad ni
   continuar la conversación clínica, y registra el evento.
4. **Given** una pregunta fuera del alcance del agente, **When** el paciente la formula,
   **Then** el agente responde que no puede responderla y ofrece derivar.
5. **Given** cualquier interacción, **When** se registra, **Then** queda con modelo
   usado, tokens y referencia de contexto recuperado.

---

### User Story 4 — Clasificación de estado dinámico (Priority: P2)

El sistema clasifica el estado del paciente entre controles a partir de señales
observables, sobre los cinco estados definidos (`signo_alarma`, `descompensado`,
`compensado`, `en_regresion`, `perdida_contacto`), y decide si el caso amerita evaluación
con modelo o se resuelve por regla.

**Why this priority**: Es el diferenciador técnico y el mecanismo de eficiencia, pero el
sistema entrega valor sin él (la bandeja de US1 ya sirve).

**Independent Test**: Dada una secuencia de señales de un paciente sintético, el
clasificador devuelve una distribución sobre los cinco estados y una señal de
escalamiento.

**Acceptance Scenarios**:

1. **Given** un paciente con señales estables, **When** se evalúa su estado, **Then** el
   clasificador devuelve alta confianza en `compensado` y no escala a modelo.
2. **Given** un paciente con señales ambiguas, **When** se evalúa, **Then** el
   clasificador señala incertidumbre y el caso escala a evaluación con modelo.
3. **Given** cualquier evaluación, **When** se registra, **Then** queda el evaluador
   usado (determinista o modelo) para trazabilidad.
4. **Given** un paciente cuyas señales mejoran de forma sostenida y cuyo número de
   fármacos o condiciones activas disminuye, **When** se evalúa, **Then** el clasificador
   devuelve `en_regresion` y el sistema notifica para evaluar deprescripción o alta, sin
   generar alarma.
5. **Given** un paciente sin señales ni respuesta durante el período definido, **When** se
   evalúa, **Then** el clasificador devuelve `perdida_contacto` de forma determinista, sin
   consumir modelo.
6. **Given** cualquier evaluación, **When** se registra, **Then** el valor pertenece
   exactamente a los cinco estados definidos; ningún otro valor es admisible.

---

### User Story 5 — Alertas a profesional y cuidador (Priority: P3)

Cuando el estado del paciente cruza un criterio definido, el sistema notifica al
profesional y —según severidad y consentimiento— al cuidador.

**Why this priority**: Cierra el circuito, pero requiere US1 + US4 funcionando.

**Independent Test**: Forzar un paciente sintético a `signo_alarma` → se genera alerta
prioritaria dirigida al profesional, que queda pendiente hasta validación humana.

**Acceptance Scenarios**:

1. **Given** un paciente que pasa a `signo_alarma`, **When** se evalúa, **Then** se genera
   alerta **prioritaria** al profesional con el criterio de disparo citado y se indica
   reconsulta inmediata.
2. **Given** una alerta generada, **When** el profesional no la ha validado, **Then** la
   alerta permanece abierta y no puede cerrarse automáticamente.
3. **Given** un paciente que pasa a `descompensado`, **When** se evalúa, **Then** se
   genera alerta a la dupla gestora para ajuste activo.
4. **Given** un paciente G3 o en carril `agudo`/`dual` en `descompensado`, **When** se
   evalúa, **Then** se genera alerta con umbral menor que para G1/G2 en carril `cronico`.
5. **Given** un cuidador consentido y una alerta de severidad alta, **When** se dispara,
   **Then** el cuidador también es notificado.
6. **Given** un paciente que pasa a `perdida_contacto`, **When** se evalúa, **Then** se
   escala a contacto asistido y **nunca** a egreso del seguimiento ni a registro de
   incumplimiento.
7. **Given** un paciente que pasa a `en_regresion`, **When** se evalúa, **Then** se
   notifica al equipo para evaluar deprescripción o alta, **sin** generar alerta clínica
   de riesgo.
8. **Given** un paciente en `compensado`, **When** se evalúa, **Then** no se genera
   alerta; se mantiene acompañamiento de rutina y refuerzo de automanejo.

---

## Requirements *(mandatory)*

### Funcionales

- **FR-001**: El sistema DEBE calcular la estratificación G0–G3 por conteo de condiciones
  crónicas activas, según criterio ECICEP, sin usar modelo de IA.
- **FR-002**: El sistema DEBE mantener histórico inmutable de estratificaciones,
  indicaciones farmacológicas y estados. Ningún registro se sobrescribe.
- **FR-003**: El sistema DEBE exponer al paciente los medicamentos que su profesional le
  indicó, en **solo lectura**. El paciente NO registra ni modifica indicaciones: eso lo
  determina el profesional en la atención (Principio I — el sistema no prescribe ni
  modifica dosis). La frecuencia se muestra tal como fue indicada; el sistema NUNCA
  infiere un horario de tomas que la indicación no declara (Principio IV).
- **FR-004**: El sistema DEBE exponer al paciente su historial de controles.
- **FR-005**: El agente conversacional DEBE recuperar el perfil del paciente por
  embedding y comunicar el plan validado de su tramo.
- **FR-006**: El agente NUNCA DEBE emitir diagnóstico, indicar tratamiento ni modificar
  dosis.
- **FR-007**: El sistema DEBE clasificar el estado dinámico sobre exactamente cinco
  valores —`signo_alarma`, `descompensado`, `compensado`, `en_regresion`,
  `perdida_contacto`— y registrar qué evaluador lo determinó.
- **FR-008**: El sistema DEBE generar alertas según reglas de estado y tramo, citando el
  criterio de disparo.
- **FR-009**: Ninguna alerta clínica PUEDE cerrarse sin validación humana registrada.
- **FR-010**: La falta de respuesta del paciente NUNCA DEBE producir egreso del
  seguimiento.
- **FR-011**: El sistema DEBE registrar por interacción: modelo usado, tokens y si hubo
  cache hit.
- **FR-012**: La interfaz clínica DEBE mostrar pacientes agrupados por carril, tramo y
  estado, priorizados por riesgo.
- **FR-013**: El sistema DEBE operar sobre `pseudonym_id` en el dominio clínico, sin PII.
- **FR-014**: El sistema DEBE tener como población objetivo a personas de **65 años o
  más** con **dos o más condiciones crónicas activas** codificadas en CIE-10, en el
  sistema de salud chileno **público y privado**.
- **FR-015**: El carril de manejo (`agudo`, `cronico`, `dual`) DEBE ser asignado por el
  profesional durante la atención. El sistema NUNCA lo infiere ni lo deriva de un modelo.
- **FR-016**: El sistema DEBE mantener histórico inmutable de asignaciones de carril, con
  `vigente_desde` / `vigente_hasta` y el profesional que la definió. En carril `agudo` y
  `dual` DEBE registrarse el origen del evento (post-alta quirúrgica, post-urgencia o
  post-hospitalización).
- **FR-017**: Un paciente en carril `dual` DEBE aparecer simultáneamente en la vista aguda
  y en la crónica de la bandeja, con un único estado dinámico vigente.
- **FR-018**: Cada estado dinámico DEBE tener una acción asociada fija: `signo_alarma` →
  reconsulta inmediata y alerta prioritaria; `descompensado` → alerta a la dupla gestora;
  `compensado` → acompañamiento de rutina; `en_regresion` → notificación para evaluar
  deprescripción o alta; `perdida_contacto` → contacto asistido.
- **FR-019**: Ante una situación compatible con **emergencia vital**, el agente DEBE
  indicar llamar al **SAMU 131** o acudir a urgencias, y NUNCA DEBE evaluar la gravedad,
  triar ni sustituir esa derivación. El sistema no atiende emergencias vitales directas.

### Restricciones

- **CR-001**: Datos exclusivamente sintéticos durante el Lab.
- **CR-002**: Claude como motor principal (requisito del Lab).
- **CR-003**: El RCE es fuente oficial; el sistema referencia, no escribe en él.
- **CR-004**: El sistema no es un canal de emergencias. No reemplaza al SAMU (131), a
  urgencias ni a ningún servicio de atención inmediata.

---

## Success Criteria *(mandatory)*

- **SC-001**: Una cohorte sintética se estratifica correctamente en G0–G3 según el
  criterio ECICEP, verificable contra el conteo de condiciones.
- **SC-002**: La dupla gestora identifica en la bandeja qué pacientes requieren atención
  sin revisar fichas individuales.
- **SC-003**: El agente responde a un paciente sin emitir diagnóstico en ningún caso
  probado, incluidos intentos deliberados de inducirlo.
- **SC-004**: Toda alerta generada queda trazada con criterio de disparo y pendiente de
  validación humana.
- **SC-005**: El sistema registra el evaluador y consumo por interacción, permitiendo
  cuantificar la proporción resuelta sin modelo.
- **SC-006**: Ante una batería de descripciones de emergencia vital, el agente deriva a
  **SAMU 131** en todos los casos probados, sin intentar evaluar la gravedad.
- **SC-007**: Un paciente en carril `dual` es visible en la vista aguda y en la crónica de
  la bandeja, con un único estado dinámico vigente y sin duplicar su registro clínico.
- **SC-008**: Cada uno de los cinco estados dinámicos produce en la demo su acción
  asociada, y `en_regresion` no genera alerta de riesgo.

---

## Pendientes de definición

Estos parámetros los define el equipo. No bloquean el andamiaje, sí la implementación
final.

| ID | Pendiente | Responsable | Estado |
|----|-----------|-------------|--------|
| PD-01 | Señales observables que alimentan el clasificador | Joaquín | Pendiente |
| PD-02 | Estados dinámicos y su acción asociada | Joaquín | **Resuelto** — 5 estados: `signo_alarma`, `descompensado`, `compensado`, `en_regresion`, `perdida_contacto` (ver *Ejes de clasificación*). Los **umbrales** de transición siguen en PD-04 |
| PD-03 | Biblioteca de planes validados por tramo (G1, G2, G3) y por carril agudo | Joaquín | Pendiente |
| PD-04 | Umbrales de transición entre los 5 estados y de derivación a profesional | Joaquín | Pendiente |
| PD-05 | Síntomas de alarma que fuerzan derivación inmediata | Joaquín | Pendiente |
| PD-06 | Matriz de priorización riesgo × severidad para la bandeja | Gerardo | Pendiente |
| PD-07 | Distribución de la cohorte sintética (65+, 2+ condiciones, cobertura de los 3 carriles y los 5 estados) | Patricio + Joaquín | Pendiente |
| PD-08 | Orquestación entre agentes (cuántos, qué hace cada uno) | Patricio | Pendiente |
| PD-09 | Si la máquina de estados se expone como tool MCP | Patricio | Pendiente |
| PD-10 | Uso puntual de modelo más capaz para casos complejos | Patricio | Pendiente |
| PD-11 | Modelo de embeddings para el RAG del perfil | Patricio | **Resuelto** — voyage-4-large (biblioteca) + voyage-4-lite (memoria/queries), dim. 1024 |

---

## Constitution Check

| Principio | Cumplimiento en esta spec |
|-----------|---------------------------|
| I. Nunca diagnostica | FR-006, FR-019, SC-003, SC-006, US3 escenarios 2, 3 y 4 |
| II. Humano en el circuito | FR-009, FR-015 (el carril lo define el profesional), US5 escenario 2 |
| III. Acompaña, no fiscaliza | FR-010, FR-018 (`perdida_contacto` → contacto asistido), US5 escenario 6 |
| IV. Cita o di no sé | FR-005 (planes validados), FR-008 (criterio citado) |
| V. Privacidad por diseño | FR-013, CR-001, FR-002 (histórico) |
| VI. Cómputo proporcional | FR-001 (regla, no IA), FR-007, US4 |
| VII. Trazabilidad | FR-002, FR-011, SC-005 |
