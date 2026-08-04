# Biblioteca de planes validados por tramo

**PD-03 — Responsable: Joaquín Garrido**

Constitución, Principio IV: el agente **no genera contenido clínico**. Recupera el plan
validado para el tramo del paciente y lo comunica de forma personalizada.

La adaptación del agente está en *cómo lo dice*, no en *qué recomienda*.

Un archivo por tramo:

```
planes/
├── G1.json    automanejo apoyado
├── G2.json    gestión de enfermedad
└── G3.json    gestión de caso
```

Estructura esperada (ver contrato en `specs/001-continuidad-cuidado/contracts/tools.md`):

```json
{
  "grupo_riesgo": "G2",
  "objetivos": ["..."],
  "recomendaciones": ["..."],
  "frecuencia_seguimiento_sugerida": "...",
  "validado_por": "profesional_id",
  "version": "1.0",
  "fuente": "ECICEP 2025 + criterio del equipo clínico"
}
```

Si un tramo no tiene plan definido, el tool devuelve `PLAN_NO_DEFINIDO` y el agente
responde "no sé" y deriva. Ese es el comportamiento correcto, no un error.
