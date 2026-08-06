"""
Camino vertical mínimo: mensaje del paciente -> RAG -> Claude -> respuesta.

Este NO es el nodo definitivo de LangGraph (eso es PD-08, orquestación
completa). Es la versión más simple que prueba que el flujo entero
funciona: biblioteca (mock hoy, real después de T026) + memoria del
paciente + Claude respondiendo dentro de los guardrails.

Cuando la orquestación LangGraph esté lista, esta función se convierte
en el cuerpo de un nodo — la lógica no cambia, solo dónde vive.
"""

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import anthropic  # noqa: E402

from src.agents.prompt_builder import ensamblar_prompt  # noqa: E402
from src.rag.embeddings import ClienteEmbeddings  # noqa: E402
from src.rag.perfil import recuperar_contexto  # noqa: E402

MODELO_CONVERSACION = "claude-haiku-4-5-20251001"  # rutina; escalar a Sonnet
                                                     # para casos complejos es PD-10


def conversar(
    db,
    pseudonym_id: str,
    grupo_riesgo: str,
    mensaje_paciente: str,
    carril: str | None = None,
    embeddings: ClienteEmbeddings | None = None,
) -> dict:
    """
    Devuelve la respuesta del agente junto con la trazabilidad de consumo
    (Principio VII — se registra en interaccion_agente por quien llame a
    esta función, no aquí, para mantenerla simple).

    `embeddings` se puede inyectar para reutilizar el cliente entre turnos;
    si no, se construye uno por llamada.
    """
    embeddings = embeddings or ClienteEmbeddings()

    contexto = recuperar_contexto(
        db=db,
        embeddings=embeddings,
        mensaje_paciente=mensaje_paciente,
        pseudonym_id=pseudonym_id,
        grupo_riesgo=grupo_riesgo,
        carril=carril,
    )

    # Placeholder simple; reemplazar por resumen real del perfil cuando
    # exista (US2 + memoria_paciente).
    perfil_resumen = f"Paciente en tramo {grupo_riesgo}, carril {carril or 'no asignado'}."

    prompt = ensamblar_prompt(
        contexto=contexto,
        perfil_paciente_resumen=perfil_resumen,
        mensaje_paciente=mensaje_paciente,
    )

    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

    respuesta = client.messages.create(
        model=MODELO_CONVERSACION,
        max_tokens=500,
        system=prompt.system_blocks,
        messages=[{"role": "user", "content": prompt.mensaje_usuario}],
    )

    texto_respuesta = respuesta.content[0].text

    return {
        "respuesta": texto_respuesta,
        "modelo_usado": MODELO_CONVERSACION,
        "tokens_in": respuesta.usage.input_tokens,
        "tokens_out": respuesta.usage.output_tokens,
        "cache_creation_tokens": getattr(
            respuesta.usage, "cache_creation_input_tokens", 0
        ),
        "cache_read_tokens": getattr(
            respuesta.usage, "cache_read_input_tokens", 0
        ),
        "chunks_clinicos_usados": [c.titulo for c in contexto.clinico],
    }


def _cliente_supabase():
    """Cliente REST con la service_role key. Las tablas tienen RLS deny-all,
    así que este es el único camino de lectura hasta que exista el frontend
    autenticado."""
    import os as _os

    from dotenv import load_dotenv
    from supabase import create_client

    load_dotenv()
    return create_client(_os.environ["SUPABASE_URL"], _os.environ["SUPABASE_KEY"])


if __name__ == "__main__":
    # Prueba manual de un turno (T023). Requiere .env con las API keys y
    # biblioteca_clinica cargada (seed_biblioteca_mock.py).
    # La batería de guardrails es T024/T047, en verificar_guardrails.py.
    db = _cliente_supabase()

    paciente = (
        db.table("v_bandeja_clinica")
        .select("pseudonym_id, tramo_actual, carril")
        .eq("tramo_actual", "G3")
        .eq("carril", "cronico")
        .limit(1)
        .execute()
        .data[0]
    )

    mensaje = "hola, ¿qué me toca hacer con mi plan de cuidado?"
    print(f"paciente {paciente['pseudonym_id']} "
          f"({paciente['tramo_actual']}/{paciente['carril']})")
    print(f"mensaje: {mensaje}\n")

    r = conversar(
        db=db,
        pseudonym_id=paciente["pseudonym_id"],
        grupo_riesgo=paciente["tramo_actual"],
        carril=paciente["carril"],
        mensaje_paciente=mensaje,
    )

    print(r["respuesta"])
    print(f"\n--- {r['modelo_usado']} · in {r['tokens_in']} · out {r['tokens_out']} "
          f"· cache escrito {r['cache_creation_tokens']} "
          f"· cache leído {r['cache_read_tokens']}")
    print(f"chunks usados: {r['chunks_clinicos_usados']}")
