# Feature Specification: Sistema de Continuidad del Cuidado Crónico

**Feature Branch**: `001-continuidad-cuidado`

**Created**: 2026-08-04

**Status**: Draft — parámetros clínicos pendientes

**Input**: Complementar el vacío de información entre controles médicos en pacientes
crónicos y post-urgencia, mediante agentes que evalúan riesgo según parámetros definidos
por el profesional y mantienen trazabilidad continua.

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

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Estratificación y estado visible para la dupla gestora (Priority: P1)

La dupla gestora (profesional + TENS) abre su bandeja y ve a sus pacientes agrupados por
tramo ECICEP y por estado dinámico, ordenados por prioridad. En vez de revisar cientos de
fichas, ve quiénes se desviaron esta semana.

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

---

### User Story 2 — Registro de medicamentos y controles por el paciente (Priority: P1)

El paciente (o su cuidador) registra sus medicamentos y consulta su historial de
controles en una interfaz simple.

**Why this priority**: Es la fuente de las señales que alimentan todo lo demás, y el
número de medicamentos modula la intensidad del seguimiento según ECICEP. Sin datos de
entrada no hay estado dinámico.

**Independent Test**: Un usuario registra 8 medicamentos → el sistema los persiste con
histórico y el conteo queda disponible para modular la intensidad del seguimiento.

**Acceptance Scenarios**:

1. **Given** un paciente autenticado, **When** registra un medicamento con dosis y
   frecuencia, **Then** queda persistido con `vigente_desde` y visible en su lista.
2. **Given** un paciente con medicamentos registrados, **When** modifica una dosis,
   **Then** la indicación anterior se cierra con `vigente_hasta` y se crea una nueva.
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
3. **Given** una pregunta fuera del alcance del agente, **When** el paciente la formula,
   **Then** el agente responde que no puede responderla y ofrece derivar.
4. **Given** cualquier interacción, **When** se registra, **Then** queda con modelo
   usado, tokens y referencia de contexto recuperado.

---

### User Story 4 — Clasificación de estado dinámico (Priority: P2)

El sistema clasifica el estado del paciente entre controles a partir de señales
observables, y decide si el caso amerita evaluación con modelo o se resuelve por regla.

**Why this priority**: Es el diferenciador técnico y el mecanismo de eficiencia, pero el
sistema entrega valor sin él (la bandeja de US1 ya sirve).

**Independent Test**: Dada una secuencia de señales de un paciente sintético, el
clasificador devuelve una distribución sobre estados y una señal de escalamiento.

**Acceptance Scenarios**:

1. **Given** un paciente con señales estables, **When** se evalúa su estado, **Then** el
   clasificador devuelve alta confianza en "en meta" y no escala a modelo.
2. **Given** un paciente con señales ambiguas, **When** se evalúa, **Then** el
   clasificador señala incertidumbre y el caso escala a evaluación con modelo.
3. **Given** cualquier evaluación, **When** se registra, **Then** queda el evaluador
   usado (determinista o modelo) para trazabilidad.

---

### User Story 5 — Alertas a profesional y cuidador (Priority: P3)

Cuando el estado del paciente cruza un criterio definido, el sistema notifica al
profesional y —según severidad y consentimiento— al cuidador.

**Why this priority**: Cierra el circuito, pero requiere US1 + US4 funcionando.

**Independent Test**: Forzar un paciente sintético a estado de alarma → se genera alerta
dirigida al profesional, que queda pendiente hasta validación humana.

**Acceptance Scenarios**:

1. **Given** un paciente que cruza a estado de alarma, **When** se evalúa, **Then** se
   genera alerta al profesional con el criterio de disparo citado.
2. **Given** una alerta generada, **When** el profesional no la ha validado, **Then** la
   alerta permanece abierta y no puede cerrarse automáticamente.
3. **Given** un paciente G3 en desviación, **When** se evalúa, **Then** se genera alerta
   (umbral menor que para G1/G2).
4. **Given** un cuidador consentido y una alerta de severidad alta, **When** se dispara,
   **Then** el cuidador también es notificado.
5. **Given** un paciente sin contacto por un período definido, **When** se evalúa,
   **Then** se escala a contacto asistido y **nunca** a egreso del seguimiento.

---

## Requirements *(mandatory)*

### Funcionales

- **FR-001**: El sistema DEBE calcular la estratificación G0–G3 por conteo de condiciones
  crónicas activas, según criterio ECICEP, sin usar modelo de IA.
- **FR-002**: El sistema DEBE mantener histórico inmutable de estratificaciones,
  indicaciones farmacológicas y estados. Ningún registro se sobrescribe.
- **FR-003**: El sistema DEBE permitir al paciente registrar y actualizar medicamentos.
- **FR-004**: El sistema DEBE exponer al paciente su historial de controles.
- **FR-005**: El agente conversacional DEBE recuperar el perfil del paciente por
  embedding y comunicar el plan validado de su tramo.
- **FR-006**: El agente NUNCA DEBE emitir diagnóstico, indicar tratamiento ni modificar
  dosis.
- **FR-007**: El sistema DEBE clasificar el estado dinámico y registrar qué evaluador lo
  determinó.
- **FR-008**: El sistema DEBE generar alertas según reglas de estado y tramo, citando el
  criterio de disparo.
- **FR-009**: Ninguna alerta clínica PUEDE cerrarse sin validación humana registrada.
- **FR-010**: La falta de respuesta del paciente NUNCA DEBE producir egreso del
  seguimiento.
- **FR-011**: El sistema DEBE registrar por interacción: modelo usado, tokens y si hubo
  cache hit.
- **FR-012**: La interfaz clínica DEBE mostrar pacientes agrupados por tramo y estado,
  priorizados por riesgo.
- **FR-013**: El sistema DEBE operar sobre `pseudonym_id` en el dominio clínico, sin PII.

### Restricciones

- **CR-001**: Datos exclusivamente sintéticos durante el Lab.
- **CR-002**: Claude como motor principal (requisito del Lab).
- **CR-003**: El RCE es fuente oficial; el sistema referencia, no escribe en él.

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

---

## Pendientes de definición

Estos parámetros los define el equipo. No bloquean el andamiaje, sí la implementación
final.

| ID | Pendiente | Responsable | Estado |
|----|-----------|-------------|--------|
| PD-01 | Señales observables que alimentan el clasificador | Joaquín | Pendiente |
| PD-02 | Criterios de transición entre estados dinámicos | Joaquín | Pendiente |
| PD-03 | Biblioteca de planes validados por tramo (G1, G2, G3) | Joaquín | Pendiente |
| PD-04 | Umbrales concretos de derivación a profesional | Joaquín | Pendiente |
| PD-05 | Síntomas de alarma que fuerzan derivación inmediata | Joaquín | Pendiente |
| PD-06 | Matriz de priorización riesgo × severidad para la bandeja | Gerardo | Pendiente |
| PD-07 | Distribución de la cohorte sintética | Patricio + Joaquín | Pendiente |
| PD-08 | Orquestación entre agentes (cuántos, qué hace cada uno) | Patricio | Pendiente |
| PD-09 | Si la máquina de estados se expone como tool MCP | Patricio | Pendiente |
| PD-10 | Uso puntual de modelo más capaz para casos complejos | Patricio | Pendiente |

---

## Constitution Check

| Principio | Cumplimiento en esta spec |
|-----------|---------------------------|
| I. Nunca diagnostica | FR-006, SC-003, US3 escenarios 2 y 3 |
| II. Humano en el circuito | FR-009, US5 escenario 2 |
| III. Acompaña, no fiscaliza | FR-010, US5 escenario 5 |
| IV. Cita o di no sé | FR-005 (planes validados), FR-008 (criterio citado) |
| V. Privacidad por diseño | FR-013, CR-001, FR-002 (histórico) |
| VI. Cómputo proporcional | FR-001 (regla, no IA), FR-007, US4 |
| VII. Trazabilidad | FR-002, FR-011, SC-005 |
