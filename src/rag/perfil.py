"""
Recuperación de contexto para el agente de conversación.

Dos fuentes, un solo query embedding (voyage-4-lite):
  1. biblioteca_clinica  — retrieval asimétrico contra chunks voyage-4-large
  2. memoria_paciente     — retrieval simétrico contra chunks voyage-4-lite

El resultado se separa en bloque CACHEABLE (por tramo, no por paciente) y
bloque VARIABLE (específico del paciente). Ver prompt_builder.py para el
ensamblaje con cache_control.

`db` es el cliente de supabase-py (`create_client`). La búsqueda vectorial no
se puede expresar por PostgREST, así que vive en dos funciones RPC en Postgres
(`buscar_biblioteca_clinica` / `buscar_memoria_paciente`, migración
`apheleia_rpc_busqueda_vectorial`). Este módulo solo las invoca.
"""

from dataclasses import dataclass

from src.rag.embeddings import ClienteEmbeddings


@dataclass
class ChunkClinico:
    titulo: str
    contenido: str
    fuente: str
    categoria: str


@dataclass
class ChunkMemoria:
    tipo: str
    contenido: str
    generado_at: str


@dataclass
class ContextoRecuperado:
    clinico: list[ChunkClinico]     # cacheable por tramo
    memoria: list[ChunkMemoria]     # variable, propio del paciente


def recuperar_contexto(
    db,
    embeddings: ClienteEmbeddings,
    mensaje_paciente: str,
    pseudonym_id: str,
    grupo_riesgo: str,
    carril: str | None = None,
    k_clinico: int = 5,
    k_memoria: int = 3,
) -> ContextoRecuperado:
    """
    Un único embedding de consulta (barato, voyage-4-lite) sirve para
    buscar en ambas tablas gracias al espacio compartido de Voyage 4.

    El filtro de biblioteca usa `grupo_riesgo` y `carril`: los chunks con
    esos campos en NULL aplican a todos, y un paciente `dual` recupera de
    ambos carriles (contracts/tools.md — `recuperar_contexto_clinico`).
    """
    consulta = embeddings.embeber_consulta(mensaje_paciente)

    filas_clinicas = db.rpc(
        "buscar_biblioteca_clinica",
        {
            "consulta": consulta.vector,
            "tramo": grupo_riesgo,
            "carril_paciente": carril,
            "k": k_clinico,
        },
    ).execute().data

    filas_memoria = db.rpc(
        "buscar_memoria_paciente",
        {"consulta": consulta.vector, "pid": pseudonym_id, "k": k_memoria},
    ).execute().data

    return ContextoRecuperado(
        clinico=[ChunkClinico(**f) for f in filas_clinicas],
        memoria=[ChunkMemoria(**f) for f in filas_memoria],
    )


def actualizar_memoria_paciente(
    db,
    embeddings: ClienteEmbeddings,
    pseudonym_id: str,
    tipo: str,
    contenido: str,
) -> None:
    """
    Inserta una nueva entrada de memoria. No se sobrescribe (Principio VII):
    las entradas anteriores del mismo tipo se marcan vigente=false, nunca
    se borran ni se actualizan en su lugar.
    """
    resultado = embeddings.embeber_memoria_paciente(contenido)

    (
        db.table("memoria_paciente")
        .update({"vigente": False})
        .eq("pseudonym_id", pseudonym_id)
        .eq("tipo", tipo)
        .eq("vigente", True)
        .execute()
    )
    (
        db.table("memoria_paciente")
        .insert(
            {
                "pseudonym_id": pseudonym_id,
                "tipo": tipo,
                "contenido": contenido,
                "embedding": resultado.vector,
            }
        )
        .execute()
    )
