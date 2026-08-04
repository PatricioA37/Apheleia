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

## Perfil vectorial (RAG)

El perfil del paciente —tramo, condiciones, medicamentos vigentes, historial de
estados— se embebe y almacena en pgvector para recuperación en la conversación.

**No es reentrenamiento.** El agente conoce al paciente porque recupera su perfil, no
porque el modelo haya sido ajustado con sus datos.

| Campo | Tipo | Notas |
|-------|------|-------|
| `perfil_id` | uuid PK | |
| `pseudonym_id` | uuid FK | |
| `contenido` | text | Perfil serializado |
| `embedding` | vector | pgvector |
| `actualizado_at` | timestamptz | |

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
