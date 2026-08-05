# Data Model — Sistema de Continuidad del Cuidado

**Principio rector**: separación de identidad y dato clínico (Constitución, Principio V).
El motor del sistema opera sobre `pseudonym_id`. El dominio clínico no contiene PII.

Durante el Lab, todos los datos son sintéticos.

---

## Dominio Identidad (acceso restringido)

### `paciente_identidad`

| Campo | Tipo | Notas |
|-------|------|-------|
| `persona_id` | uuid PK | |
| `rut_hash` | text | Hash con sal, nunca RUT plano |
| `nombre_sintetico` | text | Datos sintéticos en el Lab |
| `fecha_nacimiento` | date | |
| `sexo` | text | |
| `prevision` | text | FONASA A/B/C/D · ISAPRE |
| `comuna` | text | |
| `contacto` | text | |
| `created_at` | timestamptz | |

### `paciente_seudonimo`

| Campo | Tipo | Notas |
|-------|------|-------|
| `pseudonym_id` | uuid PK | **Única llave de cruce** |
| `persona_id` | uuid FK | → `paciente_identidad` |
| `activo` | boolean | |

### `cuidador`

| Campo | Tipo | Notas |
|-------|------|-------|
| `cuidador_id` | uuid PK | |
| `pseudonym_id` | uuid FK | A quién cuida |
| `nombre_sintetico` | text | |
| `contacto` | text | Dato de un tercero |
| `vinculo` | text | familiar · formal |
| `consentido_por_usuario` | boolean | El usuario principal consiente |

---

## Gobernanza (Ley 21.719)

### `consentimiento`

| Campo | Tipo | Notas |
|-------|------|-------|
| `consentimiento_id` | uuid PK | |
| `persona_id` | uuid FK | |
| `finalidad` | text | seguimiento_cronico · contacto_agente · alerta_cuidador |
| `base_licitud` | text | **Pendiente de confirmar con el equipo** |
| `estado` | text | otorgado · revocado |
| `otorgado_at` | timestamptz | |
| `revocado_at` | timestamptz | NULL si vigente |

### `auditoria_acceso`

| Campo | Tipo | Notas |
|-------|------|-------|
| `evento_id` | uuid PK | |
| `actor_id` | uuid | Profesional o sistema |
| `pseudonym_id` | uuid | |
| `accion` | text | lectura · escritura · cruce_identidad |
| `recurso` | text | |
| `timestamp` | timestamptz | |

> ARCO+ y notificación de brechas se documentan como diseño; no se implementan en el MVP.

---

## Dominio Clínico (seudonimizado)

### `paciente_clinico`

| Campo | Tipo | Notas |
|-------|------|-------|
| `pseudonym_id` | uuid PK | Entrada al dominio clínico, sin PII |
| `establecimiento_id` | uuid | |
| `tramo_actual` | text | G0 · G1 · G2 · G3 — cache del estrato vigente |
| `fecha_ingreso_ecicep` | date | |

### `condicion_cronica`

| Campo | Tipo | Notas |
|-------|------|-------|
| `condicion_id` | uuid PK | |
| `pseudonym_id` | uuid FK | |
| `cie10` | text | |
| `nombre` | text | |
| `fecha_diagnostico` | date | |
| `activa` | boolean | **El conteo de activas determina el tramo** |

### `estratificacion` *(histórico inmutable)*

| Campo | Tipo | Notas |
|-------|------|-------|
| `estrat_id` | uuid PK | |
| `pseudonym_id` | uuid FK | |
| `grupo_riesgo` | text | G0 · G1 · G2 · G3 |
| `n_condiciones` | int | Base del cálculo |
| `n_medicamentos` | int | Modula intensidad de seguimiento |
| `evaluado_por` | uuid FK | → `profesional` (NULL si automático) |
| `vigente_desde` | timestamptz | |
| `vigente_hasta` | timestamptz | NULL = vigente |

> **Nunca UPDATE.** Cada re-estratificación cierra la anterior y crea una fila nueva.

**Regla de cálculo (ECICEP, determinista — sin modelo de IA):**

```
n = COUNT(condicion_cronica WHERE activa = true)

n = 0        → G0
n = 1        → G1
n entre 2-4  → G2
n >= 5       → G3
```

Modulación por medicamentos (intensidad del seguimiento farmacoterapéutico):

| Tramo | Umbral | Servicio sugerido |
|-------|--------|-------------------|
| G3 | > 7 fármacos | Seguimiento farmacoterapéutico |
| G2 | ≥ 9 fármacos | Seguimiento farmacoterapéutico |
| G1 | ≥ 7 fármacos | Revisión de medicación |

### `profesional`

| Campo | Tipo | Notas |
|-------|------|-------|
| `profesional_id` | uuid PK | |
| `nombre` | text | |
| `rol` | text | medico · enfermera · TENS · quimico_farmaceutico |
| `es_dupla_gestora` | boolean | ECICEP: profesional + TENS |
| `establecimiento_id` | uuid | |

### `control` *(histórico)*

| Campo | Tipo | Notas |
|-------|------|-------|
| `control_id` | uuid PK | |
| `pseudonym_id` | uuid FK | |
| `profesional_id` | uuid FK | |
| `modalidad_ecicep` | text | ingreso · control · seguimiento_distancia · gestion_caso · transicion_PDE |
| `fecha` | timestamptz | |
| `resumen` | text | |
| `rce_referencia` | text | **Puntero al RCE oficial, no copia** |

### `medicamento`

| Campo | Tipo | Notas |
|-------|------|-------|
| `medicamento_id` | uuid PK | |
| `nombre` | text | |
| `principio_activo` | text | |
| `forma` | text | |

### `indicacion` *(histórico inmutable)*

| Campo | Tipo | Notas |
|-------|------|-------|
| `indicacion_id` | uuid PK | |
| `pseudonym_id` | uuid FK | |
| `medicamento_id` | uuid FK | |
| `indicado_por` | uuid FK | → `profesional` |
| `dosis` | text | |
| `frecuencia` | text | |
| `vigente_desde` | timestamptz | |
| `vigente_hasta` | timestamptz | NULL = vigente |

---

## Capa Agente

### `estado_dinamico` *(histórico — una fila por evaluación)*

| Campo | Tipo | Notas |
|-------|------|-------|
| `estado_id` | uuid PK | |
| `pseudonym_id` | uuid FK | |
| `valor` | text | Ver PD-02 — valores por confirmar |
| `probabilidades` | jsonb | Distribución del clasificador |
| `incertidumbre` | numeric | Señal de escalamiento |
| `evaluador` | text | determinista · modelo |
| `modelo_usado` | text | NULL si determinista |
| `generado_at` | timestamptz | |

> Valores tentativos de `valor`: `en_meta`, `desviacion`, `alarma`. **Pendiente PD-02**:
> Joaquín confirma nomenclatura y criterios de transición.

### `interaccion_agente`

| Campo | Tipo | Notas |
|-------|------|-------|
| `interaccion_id` | uuid PK | |
| `pseudonym_id` | uuid FK | |
| `agente` | text | conversacion · plan · evaluacion · notificacion |
| `canal` | text | interfaz · otro |
| `direccion` | text | agente_a_paciente · paciente_a_agente |
| `contenido` | text | |
| `modelo_usado` | text | |
| `tokens_in` | int | Trazabilidad de consumo |
| `tokens_out` | int | |
| `cache_hit` | boolean | |
| `embedding_ref` | text | Referencia al perfil recuperado |
| `timestamp` | timestamptz | |

### `alerta_clinica`

| Campo | Tipo | Notas |
|-------|------|-------|
| `alerta_id` | uuid PK | |
| `pseudonym_id` | uuid FK | |
| `estado_id` | uuid FK | Estado que la disparó |
| `criterio_disparo` | text | Cita del criterio (Principio IV) |
| `severidad` | text | |
| `destino` | text | profesional · cuidador · ambos |
| `derivada_a` | uuid FK | → `profesional` |
| `generada_at` | timestamptz | |
| `validada_por` | uuid FK | **Obligatorio para cerrar** |
| `validada_at` | timestamptz | |
| `resultado` | text | |

**Constraint (Principio II — humano en el circuito):**

```sql
ALTER TABLE alerta_clinica ADD CONSTRAINT alerta_requiere_validacion_humana
  CHECK (
    resultado IS NULL
    OR (validada_por IS NOT NULL AND validada_at IS NOT NULL)
  );
```

Una alerta no puede tener resultado sin haber sido validada por una persona. El
principio se hace cumplir en la base de datos, no por convención.

---

## Capa RAG — familia Voyage 4 (PD-11 resuelto)

**Decisión**: `voyage-4-large` para la biblioteca clínica, `voyage-4-lite` para
memoria del paciente y consultas en vivo. Dimensión: **1024** (default Matryoshka
de la familia).

Voyage 4 comparte espacio vectorial entre todos sus modelos. Esto habilita
**retrieval asimétrico**: el corpus se embebe una sola vez con el modelo grande
(calidad, baja frecuencia de escritura), y cada consulta en vivo se embebe con el
modelo liviano (costo, alto volumen) — ambos se comparan en el mismo índice sin
conversión.

**No es reentrenamiento.** El agente conoce al paciente porque recupera su perfil
por similitud, no porque el modelo haya sido ajustado con sus datos.

### `biblioteca_clinica`

Contenido validado por el equipo clínico. Embebida con `voyage-4-large`,
`input_type=document`.

| Campo | Tipo | Notas |
|-------|------|-------|
| `chunk_id` | uuid PK | |
| `categoria` | text | plan_tramo · guia_ecicep · educacion_medicamento · faq · criterio_alarma · glosario |
| `grupo_riesgo` | text | G0–G3, o NULL si aplica a todos |
| `titulo` | text | |
| `contenido` | text | |
| `fuente` | text | Cita exacta — Principio IV |
| `version` | text | |
| `validado_por` | uuid FK | → `profesional` |
| `vigente` | boolean | |
| `embedding` | vector(1024) | voyage-4-large |

**Categorías y su propósito:**

| Categoría | Contenido | Rol |
|-----------|-----------|-----|
| `plan_tramo` | Planes validados G1/G2/G3 (PD-03) | Lo que el agente recomienda |
| `guia_ecicep` | Extractos citables ECICEP cap. 2 y 3 | Fundamenta respuestas generales |
| `educacion_medicamento` | Qué es, para qué sirve — nunca dosis individual | Educación, no indicación |
| `faq` | Preguntas frecuentes con respuesta aprobada | Cobertura sin generación libre |
| `criterio_alarma` | Síntomas que gatillan derivación (PD-05) | Reconocimiento semántico, no diagnóstico |
| `glosario` | Explicación simple de condiciones y términos | Alfabetización en salud |

### `memoria_paciente`

Perfil y resúmenes de conversación, por paciente. Embebida con `voyage-4-lite`,
`input_type=document`. Alta frecuencia de escritura → tier barato.

| Campo | Tipo | Notas |
|-------|------|-------|
| `memoria_id` | uuid PK | |
| `pseudonym_id` | uuid FK | |
| `tipo` | text | perfil_snapshot · resumen_conversacion · evento_relevante |
| `contenido` | text | |
| `embedding` | vector(1024) | voyage-4-lite, mismo espacio que `biblioteca_clinica` |
| `generado_at` | timestamptz | |
| `vigente` | boolean | Entradas viejas se marcan `false`, nunca se sobrescriben |

### Patrón de recuperación

Un solo embedding de consulta (`voyage-4-lite`, `input_type=query`) sirve para
buscar en ambas tablas — esa es la ventaja concreta del espacio compartido: no se
paga dos veces por la misma pregunta. Ver `src/rag/perfil.py`.

### Prompt caching (Anthropic — mecanismo distinto, capa siguiente)

El bloque clínico recuperado para un tramo se trata como **cacheable por tramo,
no por paciente**: dentro de la ventana de cache, múltiples pacientes del mismo
grupo de riesgo reutilizan el mismo bloque. El hit rate depende del tráfico
agregado del tramo, no de que un paciente individual vuelva a escribir pronto.

Lo que nunca se cachea: perfil del paciente, memoria recuperada, mensaje —
cambian en cada turno y son específicos de la persona.

Implementación: `src/agents/prompt_builder.py`.

**Nota de honestidad**: el retrieval asimétrico y el cache por tramo son
optimizaciones de costo, no de seguridad clínica. Los guardrails (Principios
I–IV) se verifican igual sin importar qué tan barato salió recuperar el contexto.

---

## Cohorte sintética (PD-07)

El generador debe producir una distribución que cubra los cuatro tramos y permita
demostrar los estados dinámicos.

Parámetros a definir con Joaquín:
- Distribución de nº de condiciones crónicas por paciente
- Distribución de nº de medicamentos, correlacionada con el tramo
- Proporción de pacientes en cada estado dinámico
- Patrones de señales que representen desviación y alarma

**Requisito de honestidad**: la cohorte no debe generarse con las mismas reglas que el
clasificador luego "descubre". El MVP demuestra el mecanismo; la validación con datos
reales es fase posterior y debe declararse así.
