# Contratos de Tools

Estos contratos son **el pacto entre vértices**. Una vez acordados, cada persona
construye contra el contrato sin esperar la implementación del otro.

Los tools de `core` son deterministas: no llaman a modelo (Constitución, Principio VI).

---

## `estratificar_paciente`

Calcula el tramo ECICEP por conteo de condiciones crónicas activas. **Determinista.**

**Input**
```json
{
  "pseudonym_id": "uuid"
}
```

**Output**
```json
{
  "pseudonym_id": "uuid",
  "grupo_riesgo": "G0 | G1 | G2 | G3",
  "n_condiciones": 3,
  "n_medicamentos": 8,
  "servicio_farmaceutico_sugerido": "seguimiento_farmacoterapeutico | revision_con_entrevista | revision_sin_entrevista | educacion_grupal",
  "criterio_aplicado": "ECICEP 2025 — 2 a 4 condiciones crónicas = G2",
  "vigente_desde": "timestamptz"
}
```

**Errores**: `PACIENTE_NO_ENCONTRADO`

---

## `consultar_estado_dinamico`

Devuelve el estado actual del paciente y la señal de escalamiento. **Determinista.**

**Input**
```json
{
  "pseudonym_id": "uuid"
}
```

**Output**
```json
{
  "pseudonym_id": "uuid",
  "valor": "signo_alarma | descompensado | compensado | en_regresion | perdida_contacto",
  "probabilidades": {
    "signo_alarma": 0.03,
    "descompensado": 0.15,
    "compensado": 0.72,
    "en_regresion": 0.08,
    "perdida_contacto": 0.02
  },
  "incertidumbre": 0.31,
  "requiere_escalamiento": false,
  "accion_asociada": "acompanamiento_rutina",
  "evaluador": "determinista",
  "generado_at": "timestamptz"
}
```

**Los cinco estados y su `accion_asociada` (PD-02 — resuelto):**

| `valor` | `accion_asociada` | ¿Genera alerta? |
|---------|-------------------|-----------------|
| `signo_alarma` | `reconsulta_inmediata` | Sí, prioritaria en panel |
| `descompensado` | `ajuste_activo` | Sí, a la dupla gestora |
| `compensado` | `acompanamiento_rutina` | No |
| `en_regresion` | `evaluar_deprescripcion_alta` | No — notificación, no alarma |
| `perdida_contacto` | `contacto_asistido` | Sí, de contacto asistido |

> El enum de `valor` está **cerrado**: ningún otro valor es admisible (constraint en BD).
> Lo que sigue pendiente son los **umbrales de transición** entre estados (PD-01, PD-04),
> no las etiquetas.
>
> `perdida_contacto` **nunca** produce egreso del seguimiento (Principio III).

---

## `consultar_carril`

Devuelve el carril de manejo vigente del paciente (Eje 1). **Determinista.**

El carril lo asigna **un profesional en la atención**; este tool solo lo lee. Ningún
agente ni modelo lo infiere ni lo modifica.

**Input**
```json
{
  "pseudonym_id": "uuid"
}
```

**Output**
```json
{
  "pseudonym_id": "uuid",
  "carril": "agudo | cronico | dual",
  "origen_agudo": "post_alta_quirurgica | post_urgencia | post_hospitalizacion | null",
  "definido_por": "profesional_id",
  "vigente_desde": "timestamptz"
}
```

**Errores**: `CARRIL_NO_ASIGNADO` → el paciente no ha sido clasificado por un profesional
todavía; el agente trata al paciente como `cronico` **solo** para efectos de tono, y no
comunica plan de carril agudo.

> `origen_agudo` es obligatorio en `agudo` y `dual`, y siempre `null` en `cronico`.
> `dual` significa que las dos trayectorias corren en paralelo: el paciente aparece en la
> vista aguda **y** en la crónica, con un solo estado dinámico vigente.

---

## `recuperar_contexto_clinico`

Busca en la biblioteca clínica y en la memoria del paciente usando un único
embedding de consulta (retrieval asimétrico, familia Voyage 4). **No genera
contenido** — recupera; el agente de conversación decide qué usar.

**Input**
```json
{
  "pseudonym_id": "uuid",
  "grupo_riesgo": "G0 | G1 | G2 | G3",
  "carril": "agudo | cronico | dual",
  "mensaje_paciente": "string",
  "k_clinico": 5,
  "k_memoria": 3
}
```

**Output**
```json
{
  "clinico": [
    { "titulo": "string", "contenido": "string", "fuente": "string", "categoria": "string" }
  ],
  "memoria": [
    { "tipo": "string", "contenido": "string", "generado_at": "timestamptz" }
  ]
}
```

**Notas de implementación**:
- El embedding de consulta usa `voyage-4-lite` con `input_type=query`.
- `biblioteca_clinica` fue embebida con `voyage-4-large`, `input_type=document`.
- `memoria_paciente` fue embebida con `voyage-4-lite`, `input_type=document`.
- El filtro sobre `biblioteca_clinica` usa `grupo_riesgo` **y** `carril`: los chunks con
  esos campos en `NULL` aplican a todos. Un paciente `dual` recupera chunks de ambos
  carriles.
- El campo `clinico` es candidato a bloque cacheable (Anthropic prompt caching)
  cuando el resultado se repite entre pacientes del mismo `grupo_riesgo` y `carril`.

---

## `consultar_plan_tramo`

Recupera el plan validado por el profesional para el tramo **y el carril** del paciente.
**No genera contenido clínico** — solo lo recupera (Principio IV).

**Input**
```json
{
  "grupo_riesgo": "G1 | G2 | G3",
  "carril": "agudo | cronico | dual",
  "tema": "string (opcional)"
}
```

**Output**
```json
{
  "grupo_riesgo": "G2",
  "carril": "dual",
  "planes": [
    {
      "aplica_a": "cronico",
      "objetivos": ["..."],
      "recomendaciones": ["..."],
      "frecuencia_seguimiento_sugerida": "string",
      "validado_por": "profesional_id",
      "version": "string",
      "fuente": "Biblioteca de planes validados — ECICEP"
    }
  ]
}
```

**Errores**: `PLAN_NO_DEFINIDO` → el agente responde "no sé" y deriva.

> **Cambio de contrato**: `plan` (objeto) pasó a `planes` (arreglo). Un paciente en carril
> `dual` recibe **dos** planes —uno crónico y uno agudo— y el agente los comunica sin
> mezclarlos. En `agudo` o `cronico` el arreglo trae un solo elemento.
>
> Contenido pendiente: **PD-03** (Joaquín), que ahora incluye el plan de carril agudo. El
> contrato existe; la biblioteca se llena durante el evento.

---

## `evaluar_criterio_derivacion`

Determina si el caso debe derivarse a un profesional. **Determinista.**

**Input**
```json
{
  "pseudonym_id": "uuid",
  "grupo_riesgo": "G0 | G1 | G2 | G3",
  "carril": "agudo | cronico | dual",
  "estado": "signo_alarma | descompensado | compensado | en_regresion | perdida_contacto",
  "señales": { "...": "..." }
}
```

**Output**
```json
{
  "requiere_derivacion": true,
  "destino": "profesional | cuidador | ambos",
  "severidad": "string",
  "criterio_disparo": "Cita textual del criterio aplicado",
  "justificacion": "string"
}
```

**Invariantes por estado** (independientes de los umbrales de PD-04):

- `compensado` → `requiere_derivacion: false` siempre.
- `en_regresion` → `requiere_derivacion: false`; se emite **notificación** para evaluar
  deprescripción o alta, nunca alerta de riesgo.
- `signo_alarma` → `requiere_derivacion: true` siempre, severidad máxima.
- `perdida_contacto` → `requiere_derivacion: true` con destino de **contacto asistido**;
  jamás egreso ni registro de incumplimiento (Principio III).
- El umbral de `descompensado` es **menor** en G3 y en carriles `agudo` / `dual`.

> Umbrales concretos pendientes: **PD-04** y **PD-05** (Joaquín).

---

## `registrar_interaccion`

Persiste una interacción con trazabilidad de consumo (Principio VII).

**Input**
```json
{
  "pseudonym_id": "uuid",
  "agente": "conversacion | plan | evaluacion | notificacion",
  "direccion": "agente_a_paciente | paciente_a_agente",
  "contenido": "string",
  "modelo_usado": "string | null",
  "tokens_in": 0,
  "tokens_out": 0,
  "cache_hit": false
}
```

**Output**
```json
{ "interaccion_id": "uuid", "registrado_at": "timestamptz" }
```

---

## `registrar_derivacion_emergencia`

Deja constancia de que el agente derivó a **SAMU 131** o a urgencias (FR-019, CR-004).

El agente **ya derivó** antes de llamar a este tool: registrar nunca antecede ni
condiciona la derivación. El tool no evalúa gravedad ni decide nada — solo persiste.

**Input**
```json
{
  "pseudonym_id": "uuid",
  "interaccion_id": "uuid",
  "señal_detectada": "Texto literal de lo que la persona describió",
  "derivado_a": "SAMU_131 | urgencias"
}
```

**Output**
```json
{
  "evento_id": "uuid",
  "notificado_a_equipo": true,
  "registrado_at": "timestamptz"
}
```

**Invariantes**:
- El tool **nunca** devuelve un juicio clínico sobre la señal, ni la clasifica.
- El registro no reemplaza la derivación ni la retrasa: si el tool falla, el mensaje al
  paciente con el 131 se entrega igual.
- Queda visible para la dupla gestora en el detalle del paciente.

---

## `generar_alerta`

Crea una alerta clínica pendiente de validación humana (Principio II).

**Input**
```json
{
  "pseudonym_id": "uuid",
  "estado_id": "uuid",
  "criterio_disparo": "string",
  "severidad": "string",
  "destino": "profesional | cuidador | ambos"
}
```

**Output**
```json
{
  "alerta_id": "uuid",
  "estado": "pendiente_validacion",
  "derivada_a": "profesional_id",
  "generada_at": "timestamptz"
}
```

**Invariantes**:
- Una alerta nace `pendiente_validacion` y **no puede cerrarse por el sistema**. Solo un
  humano registra `validada_por`.
- Solo se invoca para `signo_alarma`, `descompensado` y `perdida_contacto`. Los estados
  `compensado` y `en_regresion` **no** generan alerta clínica.
- `perdida_contacto` genera alerta de **contacto asistido**, nunca de incumplimiento.

---

## Endpoints API (para la interfaz)

Jonathan construye contra estos contratos con datos de ejemplo.

### Interfaz paciente — app móvil (React Native + Expo)

Los contratos son los mismos independientemente del cliente. La app consume estos
endpoints vía `mobile/lib/api.ts`.


| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/paciente/{id}/perfil` | Carril, tramo, condiciones, resumen |
| GET | `/api/paciente/{id}/medicamentos` | Lista vigente |
| POST | `/api/paciente/{id}/medicamentos` | Registrar |
| PATCH | `/api/paciente/{id}/medicamentos/{med_id}` | Actualizar (cierra el anterior, crea nuevo) |
| GET | `/api/paciente/{id}/controles` | Historial cronológico |
| POST | `/api/paciente/{id}/chat` | Conversación con el agente |

### Interfaz clínica — web (dupla gestora)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/clinica/bandeja?carril=` | Pacientes por carril, tramo y estado, priorizados |
| GET | `/api/clinica/alertas` | Alertas pendientes de validación |
| POST | `/api/clinica/alertas/{id}/validar` | Validación humana (obligatoria) |
| GET | `/api/clinica/paciente/{id}` | Detalle: carril, estado, criterio de disparo, historial |
| POST | `/api/clinica/paciente/{id}/carril` | **Asignar carril** — solo profesional autenticado |

El parámetro `carril` de la bandeja acepta `agudo`, `cronico` o se omite para ver todo. Un
paciente `dual` aparece en **ambos** filtros; no se duplica su registro clínico.

**Ejemplo — `GET /api/clinica/bandeja?carril=agudo`**
```json
{
  "pacientes": [
    {
      "pseudonym_id": "uuid",
      "alias": "Paciente 042",
      "grupo_riesgo": "G3",
      "carril": "dual",
      "origen_agudo": "post_hospitalizacion",
      "estado": "signo_alarma",
      "accion_asociada": "reconsulta_inmediata",
      "prioridad": 1,
      "motivo": "Cita del criterio de disparo",
      "ultima_evaluacion": "timestamptz",
      "alerta_pendiente": true
    }
  ],
  "resumen": {
    "por_tramo": { "G0": 0, "G1": 2, "G2": 24, "G3": 18 },
    "por_carril": { "agudo": 9, "cronico": 28, "dual": 7 },
    "por_estado": {
      "signo_alarma": 3,
      "descompensado": 11,
      "compensado": 24,
      "en_regresion": 4,
      "perdida_contacto": 2
    }
  }
}
```

> `resumen.por_carril` suma más que el total de pacientes si hay `dual` — es esperado:
> esos pacientes cuentan en las dos trayectorias.
>
> G0/G1 aparecen en volumen bajo: la población entra con 2+ condiciones y solo llega a
> esos tramos por regresión.
>
> Orden de prioridad pendiente: **PD-06** (Gerardo).

**Ejemplo — `POST /api/clinica/paciente/{id}/carril`**
```json
{
  "carril": "dual",
  "origen_agudo": "post_alta_quirurgica",
  "definido_por": "profesional_id",
  "control_id": "uuid"
}
```

**Invariantes**:
- `definido_por` es obligatorio: el carril lo asigna **siempre una persona** (FR-015).
  No existe ruta por la que el sistema o un modelo lo infiera.
- `origen_agudo` es obligatorio en `agudo` y `dual`, y debe ser `null` en `cronico`.
- La asignación anterior se cierra con `vigente_hasta`; **no se sobrescribe** (FR-016).

---

## Reglas de cambio

1. Un contrato acordado no se cambia sin avisar a quien construye contra él.
2. Si un contrato debe cambiar, se actualiza aquí primero y se comunica.
3. Ante duda sobre un campo, se implementa el contrato tal como está escrito.

### Cambios — ampliación de alcance (población 65+, carriles, 5 estados)

**Rompen compatibilidad. Avisar a quien ya esté construyendo contra la versión anterior.**

| Contrato | Cambio |
|----------|--------|
| `consultar_estado_dinamico` | El enum de `valor` pasa de 3 a **5 estados** y queda cerrado. Nuevo campo `accion_asociada`. Las claves de `probabilidades` cambian. |
| `consultar_plan_tramo` | `plan` (objeto) → `planes` (arreglo). Nuevo input `carril`. Un paciente `dual` recibe dos planes. |
| `recuperar_contexto_clinico` | Nuevo input `carril`; el filtro de biblioteca lo usa. |
| `evaluar_criterio_derivacion` | Nuevo input `carril`; `estado` pasa a enum cerrado de 5 valores. |
| `GET /api/clinica/bandeja` | Query param `carril`. Cada paciente trae `carril`, `origen_agudo` y `accion_asociada`. `resumen` pasa de plano a `{por_tramo, por_carril, por_estado}`. |

**Nuevos** (no rompen nada): `consultar_carril`,
`registrar_derivacion_emergencia`, `POST /api/clinica/paciente/{id}/carril`.
