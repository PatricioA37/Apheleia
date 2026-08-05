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
  "valor": "en_meta | desviacion | alarma",
  "probabilidades": { "en_meta": 0.82, "desviacion": 0.15, "alarma": 0.03 },
  "incertidumbre": 0.31,
  "requiere_escalamiento": false,
  "evaluador": "determinista",
  "generado_at": "timestamptz"
}
```

> Los valores de `valor` son tentativos — **PD-02** los confirma. El contrato mantiene la
> forma aunque cambien las etiquetas.

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
- El campo `clinico` es candidato a bloque cacheable (Anthropic prompt caching)
  cuando el resultado se repite entre pacientes del mismo `grupo_riesgo`.

---

## `consultar_plan_tramo`

Recupera el plan validado por el profesional para el tramo del paciente.
**No genera contenido clínico** — solo lo recupera (Principio IV).

**Input**
```json
{
  "grupo_riesgo": "G1 | G2 | G3",
  "tema": "string (opcional)"
}
```

**Output**
```json
{
  "grupo_riesgo": "G2",
  "plan": {
    "objetivos": ["..."],
    "recomendaciones": ["..."],
    "frecuencia_seguimiento_sugerida": "string"
  },
  "validado_por": "profesional_id",
  "version": "string",
  "fuente": "Biblioteca de planes validados — ECICEP"
}
```

**Errores**: `PLAN_NO_DEFINIDO` → el agente responde "no sé" y deriva.

> Contenido pendiente: **PD-03** (Joaquín). El contrato existe; la biblioteca se llena
> durante el evento.

---

## `evaluar_criterio_derivacion`

Determina si el caso debe derivarse a un profesional. **Determinista.**

**Input**
```json
{
  "pseudonym_id": "uuid",
  "grupo_riesgo": "G0 | G1 | G2 | G3",
  "estado": "string",
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

> Umbrales pendientes: **PD-04** y **PD-05** (Joaquín).

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

**Invariante**: una alerta nace `pendiente_validacion` y **no puede cerrarse por el
sistema**. Solo un humano registra `validada_por`.

---

## Endpoints API (para la interfaz)

Jonathan construye contra estos contratos con datos de ejemplo.

### Interfaz paciente — app móvil (React Native + Expo)

Los contratos son los mismos independientemente del cliente. La app consume estos
endpoints vía `mobile/lib/api.ts`.


| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/paciente/{id}/perfil` | Tramo, condiciones, resumen |
| GET | `/api/paciente/{id}/medicamentos` | Lista vigente |
| POST | `/api/paciente/{id}/medicamentos` | Registrar |
| PATCH | `/api/paciente/{id}/medicamentos/{med_id}` | Actualizar (cierra el anterior, crea nuevo) |
| GET | `/api/paciente/{id}/controles` | Historial cronológico |
| POST | `/api/paciente/{id}/chat` | Conversación con el agente |

### Interfaz clínica — web (dupla gestora)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/clinica/bandeja` | Pacientes por tramo y estado, priorizados |
| GET | `/api/clinica/alertas` | Alertas pendientes de validación |
| POST | `/api/clinica/alertas/{id}/validar` | Validación humana (obligatoria) |
| GET | `/api/clinica/paciente/{id}` | Detalle: estado, criterio de disparo, historial |

**Ejemplo — `GET /api/clinica/bandeja`**
```json
{
  "pacientes": [
    {
      "pseudonym_id": "uuid",
      "alias": "Paciente 042",
      "grupo_riesgo": "G3",
      "estado": "alarma",
      "prioridad": 1,
      "motivo": "Cita del criterio de disparo",
      "ultima_evaluacion": "timestamptz",
      "alerta_pendiente": true
    }
  ],
  "resumen": { "G0": 0, "G1": 12, "G2": 24, "G3": 8 }
}
```

> Orden de prioridad pendiente: **PD-06** (Gerardo).

---

## Reglas de cambio

1. Un contrato acordado no se cambia sin avisar a quien construye contra él.
2. Si un contrato debe cambiar, se actualiza aquí primero y se comunica.
3. Ante duda sobre un campo, se implementa el contrato tal como está escrito.
