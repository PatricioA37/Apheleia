"""
Ensamblador del prompt con prompt caching (Anthropic — distinto de los
embeddings de Voyage, no confundir).

Decisión clave: el cache se rompe por PACIENTE, no por TRAMO.

Los guardrails son iguales para toda la población -> un solo bloque
cacheado sirve a todos.

El contenido clínico recuperado (biblioteca_clinica) para un paciente G2
es, en la práctica, el mismo puñado de chunks que para cualquier otro
paciente G2 que pregunte algo similar en la misma ventana de tiempo.
Cachear por tramo significa que el "hit rate" del bloque clínico depende
del TRÁFICO AGREGADO del tramo, no de que un mismo paciente vuelva a
escribir pronto. Con varios pacientes G2 activos en la misma hora, ese
bloque se mantiene caliente de forma casi continua.

Lo que NUNCA se cachea: el perfil del paciente, su memoria recuperada y
su mensaje — cambian en cada turno y de cada persona (Principio V: nada
de esto debería filtrarse entre pacientes de todas formas).
"""

from dataclasses import dataclass

from src.rag.perfil import ContextoRecuperado

with open("src/agents/prompts/base_guardrails.md", encoding="utf-8") as f:
    GUARDRAILS_BASE = f.read()


@dataclass
class PromptEnsamblado:
    system_blocks: list[dict]
    mensaje_usuario: str


def construir_bloque_clinico_por_tramo(chunks_clinicos: list) -> str:
    """
    Serializa los chunks clínicos recuperados para un tramo en un bloque
    de texto estable. En producción esto puede precomputarse por tramo
    (job periódico) en vez de recalcularse por conversación, para
    maximizar la reutilización del cache.
    """
    partes = []
    for c in chunks_clinicos:
        partes.append(f"[{c.categoria}] {c.titulo}\n{c.contenido}\nFuente: {c.fuente}")
    return "\n\n---\n\n".join(partes)


def ensamblar_prompt(
    contexto: ContextoRecuperado,
    perfil_paciente_resumen: str,
    mensaje_paciente: str,
    cache_ttl: str = "1h",
) -> PromptEnsamblado:
    """
    cache_ttl: "5m" (más barato de escribir, expira rápido) o "1h" (más
    caro de escribir, pero dado que el hit rate del bloque clínico es
    por TRAMO y no por paciente, 1h suele ganar en escenarios con
    varios pacientes activos del mismo tramo — se mantiene tibio con
    tráfico de otras personas, no solo del mismo paciente.
    """
    bloque_clinico = construir_bloque_clinico_por_tramo(contexto.clinico)

    system_blocks = [
        {
            "type": "text",
            "text": GUARDRAILS_BASE,
            "cache_control": {"type": "ephemeral", "ttl": cache_ttl},
        },
        {
            "type": "text",
            "text": f"Contenido clínico validado para este tramo:\n\n{bloque_clinico}",
            "cache_control": {"type": "ephemeral", "ttl": cache_ttl},
        },
    ]

    bloque_memoria = "\n".join(f"- [{m.tipo}] {m.contenido}" for m in contexto.memoria)

    mensaje_usuario = f"""Perfil del paciente (no repetir textualmente al paciente):
{perfil_paciente_resumen}

Contexto reciente de esta persona:
{bloque_memoria or "(sin historial previo relevante)"}

Mensaje del paciente:
{mensaje_paciente}"""

    return PromptEnsamblado(system_blocks=system_blocks, mensaje_usuario=mensaje_usuario)
