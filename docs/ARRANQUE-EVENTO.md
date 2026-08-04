# Arranque del evento

Guía operativa para las jornadas del Lab. El objetivo es que nadie pierda tiempo
averiguando qué hacer.

---

## Antes de escribir código

1. **Todos leen** `.specify/memory/constitution.md`. Toma 5 minutos y evita rehacer
   trabajo por violar un principio.
2. **Cada uno confirma su vértice** y que puede responder por él ante el jurado.
3. **Se llenan los pendientes bloqueantes** (abajo).

---

## Primeros 60 minutos — llenar los pendientes

Estos son los únicos que bloquean implementación. El resto del andamiaje ya existe.

### Joaquín — criterio clínico

Estos definen qué construye el resto del equipo.

- [ ] **PD-01** ¿Qué señales, observables **sin examen de laboratorio**, distinguen a un
      paciente que se está desviando de uno estable?
      → van a `src/core/clasificador.py`
- [ ] **PD-02** Nombres y criterios de los estados dinámicos.
      Tentativos: `en_meta`, `desviacion`, `alarma`. ¿Se mantienen?
      → `data-model.md` y contratos
- [ ] **PD-03** Biblioteca de planes validados por tramo (G1, G2, G3): objetivos,
      recomendaciones, frecuencia sugerida.
      → `src/data/planes/`
- [ ] **PD-04** Umbrales concretos de derivación a profesional.
      → `src/core/reglas_alerta.py`
- [ ] **PD-05** Síntomas de alarma que fuerzan derivación inmediata.
      → system prompt del agente de conversación

### Gerardo — priorización y realismo

- [ ] **PD-06** Matriz probabilidad × severidad × tiempo para ordenar la bandeja.
      → `v_bandeja_clinica` y `/api/clinica/bandeja`
- [ ] Reality-check: ¿esto es registrable en un CESFAM real? ¿Qué falta o sobra?
- [ ] Argumento de retorno para el pitch (reingresos evitados, licencias, ausentismo)

### Patricio — arquitectura

- [ ] **PD-07** Validar la distribución de la cohorte sintética con Joaquín
      (parámetros en `src/data/seed_sintetico.py`)
- [ ] **PD-08** Definir orquestación: cuántos agentes y qué hace cada uno
- [ ] **PD-09** ¿La máquina de estados se expone como tool MCP o se invoca directo?
- [ ] **PD-10** Uso puntual de modelo más capaz para casos complejos

### Jonathan — interfaces

- [ ] Leer `specs/001-continuidad-cuidado/contracts/tools.md`
- [ ] Construir contra los contratos con datos de ejemplo (no esperar el backend)
- [ ] Interfaz paciente: registrar medicamentos, ver controles, chat
- [ ] Interfaz clínica: bandeja por tramo y estado, validar alertas

---

## Orden de construcción (fases del plan)

```
Fase 0  Fundación          schema + cohorte + estratificación   [YA LISTO]
Fase 1  US1 bandeja        primer entregable con valor
Fase 2  US2 interfaz pac.  registro de medicamentos, controles
Fase 3  US3+US4 agentes    conversación, plan, clasificador
Fase 4  US5 alertas        cierre del circuito
Fase 5  evidencia          instrumentación, consola, demo
```

**Si el tiempo se acorta, se recorta desde la Fase 4 hacia atrás.** Las fases 0–2 son un
MVP defendible por sí solo: estratificación oficial + bandeja + registro del paciente ya
demuestran el concepto.

---

## Verificaciones antes de la demo

### Principios (no negociable)

- [ ] Batería de intentos de inducir diagnóstico al agente — **ninguno debe pasar**
- [ ] Ninguna alerta puede cerrarse sin `validada_por`
- [ ] No existe ruta de código que egrese a un paciente por no responder
- [ ] Ningún dato con PII real en el sistema, el prompt o la demo

### Entregables del Lab

- [ ] Screenshot de consola con llamadas, modelos y tokens **durante la ventana**
- [ ] Demo video 3–5 min
- [ ] System prompt principal (base: `src/agents/prompts/base_guardrails.md`)
- [ ] Ficha cívica completa — falta la cifra de impacto con URL oficial
- [ ] Herramientas Anthropic marcadas: solo las que realmente se usaron

---

## Coordinación

- **Un solo repositorio.** Ramas por vértice. Los contratos viven en `main`.
- **Integración temprana**, no el último día.
- Si un contrato debe cambiar: se actualiza en `contracts/tools.md` primero y se avisa.
- Ante duda sobre un campo: se implementa el contrato tal como está escrito.

---

## Preguntas que hará el jurado

Vale la pena que cada uno tenga su respuesta preparada:

| Pregunta | Responde |
|----------|----------|
| ¿Cómo priorizan? | Gerardo — matriz de riesgo |
| ¿Esto no diagnostica? ¿Cómo lo garantizan? | Joaquín + Patricio — guardrails + constraint en BD |
| ¿De dónde salen los datos? | Patricio — sintéticos, distribución validada clínicamente |
| ¿Esto es realista en un CESFAM? | Gerardo — 8 años en Corporación de Salud |
| ¿Cómo escala? | Patricio — cómputo proporcional al riesgo |
| ¿Qué pasa si el paciente no responde? | Cualquiera — escala a contacto asistido, nunca egreso |
