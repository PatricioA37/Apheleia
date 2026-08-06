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

# Cuántos chunks de plan validado se garantizan en cada recuperación, al
# margen del ranking semántico. Ver `_planes_del_tramo`.
CUPO_PLAN = 2


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


def _planes_del_tramo(
    db, grupo_riesgo: str, carril: str | None, limite: int
) -> list[ChunkClinico]:
    """Planes validados que le corresponden al paciente, por lookup directo.

    NO va por búsqueda vectorial, a propósito. El plan de una persona lo
    determina su tramo y su carril: es una regla, no una pregunta semántica
    (Principio VI — lo determinista se resuelve determinista).

    La medición que motivó esto: con la biblioteca poblada con 186 chunks de
    normativa, «¿qué plan me corresponde?» dejaba el plan G2 en la posición
    102 de 190 por similitud coseno. Ninguna ventana de top-k razonable lo
    alcanzaba, y el agente terminaba improvisando sobre prosa de ECICEP en
    vez de citar el plan validado — que es exactamente lo que el Principio
    IV prohíbe. La normativa debe complementar al plan, nunca desplazarlo.

    Son 4 filas en total, así que se traen todas y se filtran acá: más
    barato y más legible que componer el filtro en PostgREST.
    """
    filas = (
        db.table("biblioteca_clinica")
        .select("titulo, contenido, fuente, categoria, grupo_riesgo, carril")
        .eq("categoria", "plan_tramo")
        .eq("vigente", True)
        .execute()
        .data
    )

    def aplica(f: dict) -> bool:
        # NULL = aplica a todos (mismo criterio que la RPC).
        if f["grupo_riesgo"] is not None and f["grupo_riesgo"] != grupo_riesgo:
            return False
        if f["carril"] is None or carril is None:
            return True
        # Un paciente dual recibe los planes de ambos carriles
        # (contracts/tools.md — recuperar_contexto_clinico).
        return carril == "dual" or f["carril"] == carril

    return [
        ChunkClinico(
            titulo=f["titulo"],
            contenido=f["contenido"],
            fuente=f["fuente"],
            categoria=f["categoria"],
        )
        for f in filas
        if aplica(f)
    ][:limite]


def recuperar_contexto(
    db,
    embeddings: ClienteEmbeddings,
    mensaje_paciente: str,
    pseudonym_id: str,
    grupo_riesgo: str,
    carril: str | None = None,
    k_clinico: int = 5,
    k_memoria: int = 3,
    cupo_plan: int = CUPO_PLAN,
) -> ContextoRecuperado:
    """
    Un único embedding de consulta (barato) sirve para buscar en ambas
    tablas gracias al espacio vectorial compartido.

    El bloque clínico se arma con cupos separados, no con un top-k global:

        cupo_plan   chunks de `plan_tramo`, por lookup determinista
        el resto     por similitud, para que la normativa complemente

    El filtro de biblioteca usa `grupo_riesgo` y `carril`: los chunks con
    esos campos en NULL aplican a todos, y un paciente `dual` recupera de
    ambos carriles (contracts/tools.md — `recuperar_contexto_clinico`).
    """
    consulta = embeddings.embeber_consulta(mensaje_paciente)

    planes = _planes_del_tramo(db, grupo_riesgo, carril, cupo_plan)

    # Se piden k_clinico completos y se recortan después: así, si la búsqueda
    # semántica ya trajo el mismo plan, el cupo no le roba un espacio al
    # contenido complementario.
    filas_clinicas = db.rpc(
        "buscar_biblioteca_clinica",
        {
            "consulta": consulta.vector,
            "tramo": grupo_riesgo,
            "carril_paciente": carril,
            "k": k_clinico,
        },
    ).execute().data

    titulos_plan = {p.titulo for p in planes}
    complemento = [
        ChunkClinico(**f) for f in filas_clinicas if f["titulo"] not in titulos_plan
    ]

    # Los planes van primero: es el contenido validado por el profesional, y
    # el orden del bloque es el orden en que el modelo lo lee.
    clinico = planes + complemento[: max(0, k_clinico - len(planes))]

    filas_memoria = db.rpc(
        "buscar_memoria_paciente",
        {"consulta": consulta.vector, "pid": pseudonym_id, "k": k_memoria},
    ).execute().data

    return ContextoRecuperado(
        clinico=clinico,
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
