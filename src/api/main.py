"""
T059 — API HTTP para la interfaz paciente (React Native + Expo).

    uvicorn src.api.main:app --reload --host 0.0.0.0 --port 8000

Hoy expone únicamente `POST /api/paciente/{id}/chat`, que es el camino
vertical que ya existe (conversacion_minima.conversar). Los GET del
contrato (perfil, medicamentos, controles, plan, avisos) todavía no están
implementados y devuelven 501: es preferible un 501 explícito a un JSON
inventado que el front tome por real (Principio IV — no se simula dato
clínico).

`--host 0.0.0.0` es necesario para que el dispositivo físico con Expo llegue
al servidor por la IP de la LAN; `localhost` solo sirve al emulador.
"""

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from dotenv import load_dotenv  # noqa: E402
from fastapi import FastAPI, HTTPException  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from pydantic import BaseModel, Field  # noqa: E402
from supabase import create_client  # noqa: E402

from src.agents.conversacion_minima import conversar  # noqa: E402
from src.rag.embeddings import ClienteEmbeddings  # noqa: E402

load_dotenv()

app = FastAPI(
    title="Apheleia — API paciente",
    description="Continuidad del cuidado crónico. Ningún endpoint diagnostica.",
    version="0.1.0",
)

# Expo sirve desde origen variable (IP de LAN, puerto cambiante). En el Lab
# se abre a todos; endurecer antes de cualquier despliegue con datos reales.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class _Estado:
    """Clientes de proceso, construidos una vez.

    El cliente de embeddings mantiene la sesión HTTP y el de Supabase el
    pool: construirlos por request agrega latencia al camino caliente del
    chat sin ganar nada.
    """

    db = None
    embeddings = None


@app.on_event("startup")
def _iniciar() -> None:
    _Estado.db = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])
    _Estado.embeddings = ClienteEmbeddings()
    print(f"[apheleia] embeddings: {_Estado.embeddings.proveedor}")


class MensajeChat(BaseModel):
    mensaje: str = Field(min_length=1, max_length=2000)


@app.get("/health")
def health() -> dict:
    return {
        "estado": "ok",
        "embeddings": _Estado.embeddings.proveedor if _Estado.embeddings else None,
    }


def _buscar_paciente(pseudonym_id: str) -> dict:
    """Tramo y carril vigentes. La vista ya resuelve la vigencia temporal."""
    filas = (
        _Estado.db.table("v_bandeja_clinica")
        .select("pseudonym_id, tramo_actual, carril")
        .eq("pseudonym_id", pseudonym_id)
        .limit(1)
        .execute()
        .data
    )
    if not filas:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    return filas[0]


def _es_derivacion(respuesta: str) -> bool:
    """¿La respuesta deriva a urgencia? Decide si el front pinta el botón
    «Llamar al 131» (`chat.tsx` — `derivacion`).

    Regla: el texto menciona el 131. Es la que se acordó, y es deliberadamente
    conservadora — ante la duda, derivar (base_guardrails.md).

    LIMITACIÓN CONOCIDA, medida: el agente también menciona el 131 como
    consejo preventivo en respuestas que NO son una emergencia en curso
    («si en algún momento siente dolor en el pecho, llame al 131»). En esos
    casos el botón aparece igual. El costo del falso positivo es un botón de
    más; el del falso negativo es una emergencia sin botón — por eso se
    prefiere este lado del error, pero conviene medirlo antes de la demo.

    La alternativa robusta es evaluar las señales del guardrail sobre el
    MENSAJE del paciente, de forma determinista y sin depender de cómo
    redacte el modelo (Principio VI). Queda anotado como tarea.
    """
    return "131" in respuesta


@app.post("/api/paciente/{pseudonym_id}/chat")
def chat(pseudonym_id: str, cuerpo: MensajeChat) -> dict:
    """Conversación con el agente.

    `pseudonym_id`, nunca identidad (Principio V): la ruta no acepta rut,
    nombre ni ficha.

    La forma de la respuesta la fija `RespuestaChat` en
    `mobile/lib/contratos.ts` — `respuesta`, `fuente`, `derivacion`. El
    bloque `traza` es añadido y opcional: TypeScript ignora las claves de
    más, y es lo que hace auditable el Principio VII desde el cliente.
    """
    paciente = _buscar_paciente(pseudonym_id)

    resultado = conversar(
        db=_Estado.db,
        pseudonym_id=paciente["pseudonym_id"],
        grupo_riesgo=paciente["tramo_actual"],
        carril=paciente["carril"],
        mensaje_paciente=cuerpo.mensaje,
        embeddings=_Estado.embeddings,
    )

    # El front muestra UNA cita, no una lista. Se manda la del primer chunk:
    # el cupo de `perfil.py` garantiza que ahí está el plan validado del
    # tramo, que es la fuente de mayor autoridad de las recuperadas.
    fuentes = resultado["fuentes_clinicas"]

    return {
        "respuesta": resultado["respuesta"],
        "fuente": fuentes[0] if fuentes else None,
        "derivacion": _es_derivacion(resultado["respuesta"]),
        "traza": {
            "modelo": resultado["modelo_usado"],
            "tokens_in": resultado["tokens_in"],
            "tokens_out": resultado["tokens_out"],
            "cache_read": resultado["cache_read_tokens"],
            # Todas las fuentes, para auditar qué sustentó la respuesta.
            "fuentes": fuentes,
            "chunks": resultado["chunks_clinicos_usados"],
        },
    }


# --- Contrato pendiente ------------------------------------------------
# Estos endpoints están en contracts/tools.md pero no implementados.
# 501 en vez de dato de ejemplo: el front distingue "todavía no existe" de
# "existe y está vacío", y nadie demuestra con datos inventados.

for _ruta in ("perfil", "medicamentos", "controles", "plan", "avisos"):

    def _no_implementado(pseudonym_id: str, _r: str = _ruta) -> dict:
        raise HTTPException(
            status_code=501,
            detail=f"GET /api/paciente/{{id}}/{_r} aún no implementado",
        )

    app.get(f"/api/paciente/{{pseudonym_id}}/{_ruta}")(_no_implementado)
