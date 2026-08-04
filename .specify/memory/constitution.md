# Apheleia Constitution

Sistema de agentes para la gestión de riesgo, trazabilidad y continuidad del cuidado
entre profesional y paciente crónico.

Claude Impact Lab · Longevidad 2026 · Línea 03 — Continuidad y Medicina de Precisión

---

## Core Principles

### I. Nunca Diagnostica (NO NEGOCIABLE)

Ningún agente del sistema emite diagnóstico, indica tratamiento, modifica dosis ni
sustituye la evaluación clínica.

El sistema **ubica a la persona en un estado de riesgo** según parámetros definidos
previamente por un profesional de salud. La interpretación clínica de ese estado y toda
decisión derivada corresponden a un humano.

Reglas de implementación:
- Todo system prompt de agente incluye el límite explícito de no-diagnóstico.
- Ninguna salida del sistema usa lenguaje diagnóstico ("usted tiene", "esto es").
- Si un agente no puede responder dentro de sus límites, responde "no sé" y deriva.

Violación de este principio invalida el entregable completo.

### II. Humano en el Circuito

Toda alerta clínica requiere validación humana antes de cerrarse. El registro de una
alerta sin `validada_por` es un estado inválido del sistema, forzado por constraint de
base de datos, no por convención.

- Las decisiones clínicas las toma la dupla gestora (profesional + TENS).
- El sistema propone; nunca ejecuta acción clínica de forma autónoma.
- El RCE (Registro Clínico Electrónico) es la fuente oficial: Apheleia lo referencia,
  nunca lo reemplaza ni escribe en él directamente.

### III. Acompaña, No Fiscaliza

El sistema existe para apoyar al paciente, no para auditar su cumplimiento.

- Un estado de desviación dispara **apoyo**, nunca un reporte de incumplimiento.
- **El silencio nunca es causal de egreso ni de abandono.** La falta de respuesta escala
  a contacto asistido, jamás a exclusión del seguimiento.
- Ninguna salida del sistema atribuye culpa al paciente.

Este principio protege a la población más vulnerable: quienes tienen menos acceso a
datos móviles, menor alfabetización digital o mayor dependencia.

### IV. Cita o Di No Sé

Toda afirmación clínica del sistema debe estar anclada a una fuente verificable —
criterio definido por el profesional del equipo, Marco Operativo ECICEP, o normativa
citada literalmente.

- Sin fuente disponible → el agente responde "no sé" y deriva al profesional.
- Prohibido inventar evidencia, cifras clínicas o referencias normativas.
- El contenido clínico que el agente comunica proviene de una **biblioteca de planes
  validados por el profesional**, no de generación libre del modelo.

### V. Privacidad por Diseño (Ley 21.719)

El dato de salud es dato sensible. La arquitectura separa identidad de dato clínico:

- El motor del sistema (clasificador, agentes) opera sobre `pseudonym_id`.
- El dominio clínico no contiene PII.
- La re-identificación requiere cruce deliberado y queda auditado.
- Consentimiento expreso por finalidad; el cuidador consiente vía el usuario principal.
- Histórico inmutable: estratificación, indicaciones y estados versionan con
  `vigente_desde` / `vigente_hasta`. **Nada se sobrescribe.**

Durante el Lab se trabaja exclusivamente con **datos sintéticos**. Cero PII real, ni en
el dataset, ni en el prompt, ni en la demo.

### VI. Cómputo Proporcional al Riesgo

El razonamiento del modelo se reserva para donde aporta juicio.

- La estratificación G0–G3 es una **regla determinista** (conteo de condiciones), no un
  modelo de IA.
- La clasificación de estado dinámico de rutina se resuelve con un componente
  determinista; los modelos entran en casos ambiguos o de riesgo.
- Modelo según complejidad del caso, no uniforme para toda la población.

Justificación: el escalamiento poblacional gradual solo es viable si el costo marginal
por paciente estable tiende a cero.

### VII. Trazabilidad Ante Todo

El valor central del sistema no es la predicción: es **hacer visible el intervalo entre
controles que hoy no tiene registro**.

Cada evaluación, cada interacción y cada decisión del sistema queda registrada con:
qué se observó, qué evaluó el sistema, qué modelo lo evaluó, y qué hizo el humano.

---

## Restricciones Técnicas

**Estratificación**: Marco Operativo ECICEP 2025 (MINSAL). Criterio oficial por conteo
de condiciones crónicas activas:

| Grupo | Criterio | Modalidad |
|-------|----------|-----------|
| G3 | 5 o más condiciones | Gestión de caso |
| G2 | 2 a 4 condiciones | Gestión de enfermedad |
| G1 | 1 condición | Automanejo apoyado |
| G0 | Sin condiciones detectadas | Prevención / promoción |

El número de medicamentos modula la intensidad del seguimiento farmacoterapéutico.

**Datos**: sintéticos durante el Lab. Distribución de estados y perfiles generada por el
equipo, validada clínicamente.

**Motor principal**: Claude (API). El sistema no usa otros LLM como base — es requisito
de participación del Lab y su incumplimiento descalifica.

---

## Flujo de Trabajo (Spec-Driven Development)

1. `/speckit.constitution` — este documento. Gobierna todo lo demás.
2. `/speckit.specify` — qué se construye y por qué (sin detalles de implementación).
3. `/speckit.clarify` — resolver ambigüedades antes de planificar.
4. `/speckit.plan` — cómo se construye: stack, arquitectura, contratos.
5. `/speckit.tasks` — tareas ejecutables, agrupadas por user story.
6. `/speckit.implement` — construcción.

**Ventana de construcción válida**: el código que cuenta para evaluación se escribe
durante las jornadas del evento. Specs, diccionarios de datos y system prompts son
insumos previos permitidos; la solución se construye en la ventana.

### Reparto por vértice

| Vértice | Responsable | Decide |
|---------|-------------|--------|
| Criterio clínico y planes por tramo | Joaquín Garrido | Qué es riesgo, qué recomienda cada tramo |
| Riesgo, trazabilidad y operación | Gerardo Vergara | Matriz de priorización, realismo operativo |
| Datos, modelo y agentes | Patricio Arias | Arquitectura, contratos de tools, clasificador |
| Interfaces e integración | Jonathan | Superficie paciente + clínica, demo |

Regla de coordinación: **se especifican los contratos entre personas, no el interior del
trabajo de cada persona.**

---

## Governance

Esta constitución gobierna todas las specs, planes y tareas del proyecto. Ante conflicto
entre una spec y esta constitución, prevalece la constitución.

Los principios I a V son **no negociables** y no pueden ser relajados por conveniencia de
implementación, presión de tiempo ni por mejorar la demo.

Toda spec debe pasar el *Constitution Check* antes de avanzar a plan. Toda complejidad
añadida debe justificarse explícitamente.

**Version**: 1.0.0 | **Ratified**: 2026-08-04 | **Last Amended**: 2026-08-04
