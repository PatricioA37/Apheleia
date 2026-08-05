"""
Recuperación de contexto para el agente de conversación.

Dos fuentes, un solo query embedding (voyage-4-lite):
  1. biblioteca_clinica  — retrieval asimétrico contra chunks voyage-4-large
  2. memoria_paciente     — retrieval simétrico contra chunks voyage-4-lite

El resultado se separa en bloque CACHEABLE (por tramo, no por paciente) y
bloque VARIABLE (específico del paciente). Ver prompt_builder.py para el
ensamblaje con cache_control.
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
    k_clinico: int = 5,
    k_memoria: int = 3,
) -> ContextoRecuperado:
    """
    Un único embedding de consulta (barato, voyage-4-lite) sirve para
    buscar en ambas tablas gracias al espacio compartido de Voyage 4.
    """
    consulta = embeddings.embeber_consulta(mensaje_paciente)

    filas_clinicas = db.fetch_all(
        """
        select titulo, contenido, fuente, categoria
        from biblioteca_clinica
        where vigente and (grupo_riesgo = %(tramo)s or grupo_riesgo is null)
        order by embedding <=> %(q)s
        limit %(k)s
        """,
        {"tramo": grupo_riesgo, "q": consulta.vector, "k": k_clinico},
    )

    filas_memoria = db.fetch_all(
        """
        select tipo, contenido, generado_at
        from memoria_paciente
        where pseudonym_id = %(pid)s and vigente
        order by embedding <=> %(q)s
        limit %(k)s
        """,
        {"pid": pseudonym_id, "q": consulta.vector, "k": k_memoria},
    )

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

    db.execute(
        """update memoria_paciente set vigente = false
           where pseudonym_id = %(pid)s and tipo = %(tipo)s and vigente""",
        {"pid": pseudonym_id, "tipo": tipo},
    )
    db.execute(
        """insert into memoria_paciente (pseudonym_id, tipo, contenido, embedding)
           values (%(pid)s, %(tipo)s, %(contenido)s, %(emb)s)""",
        {
            "pid": pseudonym_id,
            "tipo": tipo,
            "contenido": contenido,
            "emb": resultado.vector,
        },
    )
