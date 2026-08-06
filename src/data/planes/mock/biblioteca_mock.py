"""
MOCK — biblioteca clínica de ejemplo.

Contenido INVENTADO, solo para desarrollar el flujo RAG antes de que
Joaquín entregue PD-01…05. La FORMA es la del contrato real
(contracts/tools.md) — cuando llegue el contenido validado, se
reemplaza esta lista, no la arquitectura que la consume.

NO usar en demo final sin reemplazar por contenido validado por
un profesional. El campo `validado_por` en mock es None a propósito:
así T024 (batería de guardrails) puede verificar que el sistema no
trata contenido no-validado como si lo estuviera.

`carril` en None significa "aplica a los dos carriles", igual que
`grupo_riesgo` en None significa "aplica a todos los tramos". El chunk
de carril agudo existe para que el filtro por carril de
`recuperar_contexto_clinico` tenga algo que discriminar; el plan agudo
real llega con PD-03 (T048).
"""

BIBLIOTECA_MOCK = [
    {
        "categoria": "plan_tramo",
        "grupo_riesgo": "G1",
        "carril": None,
        "titulo": "Plan de automanejo — riesgo leve (MOCK)",
        "contenido": (
            "Objetivo: mantener control de la condición única con autonomía. "
            "Recomendación general: asistir al control programado, mantener "
            "actividad física regular según indicación previa, registrar "
            "síntomas nuevos. [CONTENIDO DE EJEMPLO — reemplazar con plan "
            "validado por el profesional, PD-03]"
        ),
        "fuente": "MOCK — pendiente validación profesional",
        "version": "mock-0.1",
        "validado_por": None,
    },
    {
        "categoria": "plan_tramo",
        "grupo_riesgo": "G2",
        "carril": None,
        "titulo": "Plan de gestión de enfermedad — riesgo moderado (MOCK)",
        "contenido": (
            "Objetivo: prevenir progresión con seguimiento más frecuente. "
            "Recomendación general: control cada [frecuencia por definir], "
            "atención a interacciones entre condiciones. [CONTENIDO DE "
            "EJEMPLO — reemplazar con plan validado, PD-03]"
        ),
        "fuente": "MOCK — pendiente validación profesional",
        "version": "mock-0.1",
        "validado_por": None,
    },
    {
        "categoria": "plan_tramo",
        "grupo_riesgo": "G3",
        "carril": None,
        "titulo": "Plan de gestión de caso — riesgo severo (MOCK)",
        "contenido": (
            "Objetivo: acompañamiento estrecho por la dupla gestora. "
            "Recomendación general: contacto frecuente, coordinación entre "
            "especialidades, atención prioritaria a polifarmacia. "
            "[CONTENIDO DE EJEMPLO — reemplazar con plan validado, PD-03]"
        ),
        "fuente": "MOCK — pendiente validación profesional",
        "version": "mock-0.1",
        "validado_por": None,
    },
    {
        "categoria": "plan_tramo",
        "grupo_riesgo": None,
        "carril": "agudo",
        "titulo": "Plan de transición post-evento agudo (MOCK)",
        "contenido": (
            "Objetivo: acompañar la ventana posterior al alta o a la urgencia "
            "sin interrumpir el manejo crónico de base. Recomendación general: "
            "verificar que las indicaciones del alta quedaron registradas, "
            "reforzar los controles de la transición y mantener el plan crónico "
            "en paralelo, no en reemplazo. [CONTENIDO DE EJEMPLO — reemplazar "
            "con el plan de carril agudo validado, PD-03 / T048]"
        ),
        "fuente": "MOCK — pendiente validación profesional",
        "version": "mock-0.1",
        "validado_por": None,
    },
    {
        "categoria": "faq",
        "grupo_riesgo": None,
        "carril": None,
        "titulo": "¿Con qué frecuencia debo registrar mis medicamentos?",
        "contenido": (
            "Cada vez que un profesional te indique un cambio de dosis o "
            "un medicamento nuevo. [RESPUESTA DE EJEMPLO — reemplazar con "
            "FAQ validada, PD-03]"
        ),
        "fuente": "MOCK — pendiente validación profesional",
        "version": "mock-0.1",
        "validado_por": None,
    },
    {
        "categoria": "glosario",
        "grupo_riesgo": None,
        "carril": None,
        "titulo": "¿Qué es una condición crónica?",
        "contenido": (
            "Una condición de salud de larga duración que requiere manejo "
            "continuo. [DEFINICIÓN DE EJEMPLO — reemplazar con glosario "
            "validado]"
        ),
        "fuente": "MOCK — pendiente validación profesional",
        "version": "mock-0.1",
        "validado_por": None,
    },
    {
        "categoria": "criterio_alarma",
        "grupo_riesgo": None,
        "carril": None,
        "titulo": "[PLACEHOLDER] Síntomas que requieren derivación inmediata",
        "contenido": (
            "ESTE CONTENIDO ES CRÍTICO Y NO DEBE USARSE EN DEMO FINAL SIN "
            "VALIDACIÓN. Sirve solo para probar que el flujo de derivación "
            "funciona técnicamente. Ejemplo de placeholder: dolor intenso "
            "no habitual, dificultad respiratoria marcada. "
            "[PENDIENTE PD-05 — Joaquín define la lista real]"
        ),
        "fuente": "MOCK — NO VALIDADO — no usar para decisiones reales",
        "version": "mock-0.1",
        "validado_por": None,
    },
]
