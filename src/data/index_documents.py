"""
T054–T058 — indexa PDFs clínicos normativos en `biblioteca_clinica`.

    python src/data/index_documents.py docs/clinicos/*.pdf
    python src/data/index_documents.py docs/clinicos/*.pdf --dry-run
    python src/data/index_documents.py --reembeber-existentes

PyMuPDF -> chunks con rango de páginas -> embeddings -> pgvector.

Principio IV (Cita o Di No Sé): cada chunk guarda en `fuente` el título
oficial del documento y el rango de páginas exacto de donde salió el texto.
Sin eso el agente no puede citar, y sin cita no puede afirmar.

Principio V: estos son documentos normativos públicos. Cero PII — por eso
pueden indexarse completos sin pseudonimizar.

SOBRE `categoria`: el `check` de biblioteca_clinica (schema.sql:246) acepta
solo seis valores y este script NO los amplía. Cada PDF se mapea a uno ya
válido en CATALOGO. Un PDF sin entrada en CATALOGO se omite con aviso, no
se indexa a ciegas: la procedencia clínica no se adivina.

SOBRE EL PROVEEDOR: todo el índice tiene que estar embebido con el mismo
proveedor con que se consulta (ver advertencia en src/rag/embeddings.py).
Al indexar, el script comprueba si ya hay filas de otro proveedor y aborta
antes de mezclar espacios vectoriales.
"""

import argparse
import os
import sys
from dataclasses import dataclass
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import fitz  # noqa: E402  (PyMuPDF)
from dotenv import load_dotenv  # noqa: E402
from supabase import create_client  # noqa: E402

from src.rag.embeddings import ClienteEmbeddings  # noqa: E402


@dataclass(frozen=True)
class Documento:
    """Procedencia declarada de un PDF. `categoria` debe existir en el
    check constraint de biblioteca_clinica — este script no lo modifica."""
    titulo_oficial: str
    categoria: str
    version: str
    etiqueta: str  # nombre corto para los títulos de chunk


# Los 3 documentos acordados para el MVP. Para sumar otro, agregar entrada
# aquí — no hace falta tocar el resto del script.
CATALOGO: dict[str, Documento] = {
    "5.-Marco-Operativo-Estrategia-Cuidado-Integral-Centrado-en-la-Persona-ECICEP-2025": Documento(
        titulo_oficial="Marco Operativo ECICEP 2025 (MINSAL, Chile)",
        categoria="guia_ecicep",
        version="ecicep-2025",
        etiqueta="ECICEP 2025",
    ),
    "MANUAL_LE_NO_GES2013": Documento(
        titulo_oficial="Manual de Listas de Espera No GES (MINSAL, 2013)",
        categoria="guia_ecicep",
        version="manual-le-no-ges-2013",
        etiqueta="Manual LE No GES",
    ),
    # Título tomado literalmente de la portada del PDF, no del nombre de
    # archivo: `fuente` es lo que el agente cita (Principio IV).
    "RSC-Vol2-Cap3": Documento(
        titulo_oficial=(
            "Revista Salud Comunitaria UANDES, Vol. N°2 (2024) — «ECICEP: "
            "la nueva perspectiva de la multimorbilidad»"
        ),
        categoria="guia_ecicep",
        version="rsc-vol2-cap3",
        etiqueta="Rev. Salud Comunitaria UANDES",
    ),
}

# Chunking: ~1800 caracteres cae cómodamente bajo el límite por entrada de
# cualquiera de los dos proveedores, y mantiene el chunk lo bastante chico
# como para que el pasaje recuperado sea citable sin arrastrar media página
# de contexto irrelevante.
MAX_CHARS = 1800
SOLAPE_CHARS = 200
MIN_CHARS = 120  # descarta encabezados sueltos, números de página, etc.


@dataclass
class Chunk:
    titulo: str
    contenido: str
    fuente: str
    categoria: str
    version: str


def _paginas_con_texto(ruta: Path) -> list[tuple[int, str]]:
    """(número de página 1-indexado, texto). Las páginas vacías —portadas,
    separadores, páginas que son solo una imagen— se descartan aquí."""
    paginas = []
    with fitz.open(ruta) as pdf:
        for i, pagina in enumerate(pdf, start=1):
            texto = pagina.get_text("text").strip()
            if texto:
                paginas.append((i, texto))
    return paginas


def _trocear(paginas: list[tuple[int, str]], doc: Documento) -> list[Chunk]:
    """Acumula párrafos hasta MAX_CHARS arrastrando el rango de páginas.

    Se corta en límite de párrafo, no de carácter: partir una frase clínica
    a la mitad produce un chunk que se recupera bien y se cita mal.
    """
    chunks: list[Chunk] = []
    buffer = ""
    pag_inicio = paginas[0][0] if paginas else 0
    pag_fin = pag_inicio

    def cerrar(buf: str, p0: int, p1: int) -> None:
        buf = buf.strip()
        if len(buf) < MIN_CHARS:
            return
        rango = f"p. {p0}" if p0 == p1 else f"pp. {p0}–{p1}"
        chunks.append(
            Chunk(
                titulo=f"{doc.etiqueta} — {rango}",
                contenido=buf,
                fuente=f"{doc.titulo_oficial}, {rango}",
                categoria=doc.categoria,
                version=doc.version,
            )
        )

    for numero, texto in paginas:
        for parrafo in (p.strip() for p in texto.split("\n\n")):
            if not parrafo:
                continue
            if buffer and len(buffer) + len(parrafo) + 2 > MAX_CHARS:
                cerrar(buffer, pag_inicio, pag_fin)
                # El solape mantiene continuidad entre chunks contiguos: sin
                # él, una idea que cruza el corte no se recupera desde ninguno.
                buffer = buffer[-SOLAPE_CHARS:].lstrip()
                pag_inicio = pag_fin
            buffer = f"{buffer}\n\n{parrafo}".strip() if buffer else parrafo
            pag_fin = numero

    cerrar(buffer, pag_inicio, pag_fin)
    return chunks


def _reembeber_ajenas(db, embeddings, versiones_propias: set[str]) -> int:
    """Re-embebe las filas que NO acaba de escribir este run.

    El schema no guarda con qué proveedor se embebió cada fila, así que no
    hay forma de *detectar* una mezcla de espacios vectoriales — y mezclarlos
    no lanza error: Postgres calcula el coseno igual y devuelve vecinos sin
    sentido, en silencio. En vez de detectar, se previene: todo lo que no
    viene de este run se vuelve a embeber con el proveedor activo, de modo
    que la tabla queda en un solo espacio por construcción.
    """
    filas = (
        db.table("biblioteca_clinica")
        .select("chunk_id, titulo, contenido, version")
        .execute()
        .data
    )
    ajenas = [f for f in filas if f["version"] not in versiones_propias]
    if not ajenas:
        return 0

    print(
        f"\n  {len(ajenas)} chunks de otra procedencia (mock, planes) — "
        f"re-embebiendo con {embeddings.proveedor} para no mezclar espacios"
    )
    for i in range(0, len(ajenas), 64):
        bloque = ajenas[i : i + 64]
        lote = embeddings.embeber_documentos_clinicos(
            [f"{f['titulo']}\n\n{f['contenido']}" for f in bloque]
        )
        for fila, vector in zip(bloque, lote.vectores):
            (
                db.table("biblioteca_clinica")
                .update({"embedding": vector})
                .eq("chunk_id", fila["chunk_id"])
                .execute()
            )
        print(f"    {i + len(bloque)}/{len(ajenas)}")
    return len(ajenas)


def _embeber_e_insertar(db, embeddings, chunks: list[Chunk], lote_tam: int = 64) -> int:
    total_tokens = 0
    for i in range(0, len(chunks), lote_tam):
        bloque = chunks[i : i + lote_tam]
        lote = embeddings.embeber_documentos_clinicos(
            [f"{c.titulo}\n\n{c.contenido}" for c in bloque]
        )
        total_tokens += lote.tokens

        filas = [
            {
                "categoria": c.categoria,
                "grupo_riesgo": None,  # normativa: aplica a todos los tramos
                "carril": None,        # y a ambos carriles
                "titulo": c.titulo,
                "contenido": c.contenido,
                "fuente": c.fuente,
                "version": c.version,
                "validado_por": None,  # documento normativo, no plan del profesional
                "vigente": True,
                "embedding": vector,
            }
            for c, vector in zip(bloque, lote.vectores)
        ]
        db.table("biblioteca_clinica").insert(filas).execute()
        print(f"    insertados {i + len(bloque)}/{len(chunks)} chunks")
    return total_tokens


def reembeber_existentes(db, embeddings) -> None:
    """Re-embebe TODA la biblioteca con el proveedor activo.

    Necesario al cambiar EMBEDDING_PROVIDER: deja el índice en un solo
    espacio vectorial. No toca el contenido, solo el vector.
    """
    filas = (
        db.table("biblioteca_clinica")
        .select("chunk_id, titulo, contenido")
        .execute()
        .data
    )
    if not filas:
        print("biblioteca_clinica está vacía — nada que re-embeber.")
        return

    print(f"Re-embebiendo {len(filas)} chunks con {embeddings.proveedor}...")
    for i in range(0, len(filas), 64):
        bloque = filas[i : i + 64]
        lote = embeddings.embeber_documentos_clinicos(
            [f"{f['titulo']}\n\n{f['contenido']}" for f in bloque]
        )
        for fila, vector in zip(bloque, lote.vectores):
            (
                db.table("biblioteca_clinica")
                .update({"embedding": vector})
                .eq("chunk_id", fila["chunk_id"])
                .execute()
            )
        print(f"  {i + len(bloque)}/{len(filas)}")
    print(f"\nListo — índice completo en el espacio de {embeddings.proveedor}.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pdfs", nargs="*", type=Path)
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Extrae y trocea sin llamar a la API ni escribir en Supabase.",
    )
    parser.add_argument(
        "--reembeber-existentes",
        action="store_true",
        help="Re-embebe la biblioteca ya cargada con el proveedor activo.",
    )
    parser.add_argument(
        "--no-reembeber",
        action="store_true",
        help="No re-embeber los chunks preexistentes tras indexar. Solo si ya "
             "están en el espacio del proveedor activo.",
    )
    args = parser.parse_args()

    load_dotenv()

    if args.reembeber_existentes:
        db = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])
        reembeber_existentes(db, ClienteEmbeddings())
        return

    if not args.pdfs:
        parser.error("indicá al menos un PDF, o usá --reembeber-existentes")

    # 1. Extraer y trocear — sin red, así un PDF ilegible falla barato.
    por_documento: list[tuple[Documento, list[Chunk]]] = []
    for ruta in args.pdfs:
        doc = CATALOGO.get(ruta.stem)
        if doc is None:
            print(f"omitido  {ruta.name} — sin entrada en CATALOGO")
            continue
        if not ruta.exists():
            print(f"omitido  {ruta.name} — no existe")
            continue

        paginas = _paginas_con_texto(ruta)
        chunks = _trocear(paginas, doc)
        por_documento.append((doc, chunks))
        print(
            f"leído    {ruta.name} — {len(paginas)} páginas con texto, "
            f"{len(chunks)} chunks [{doc.categoria}]"
        )

    if not por_documento:
        raise SystemExit("\nNingún PDF indexable. Revisá CATALOGO.")

    total = sum(len(c) for _, c in por_documento)
    print(f"\nTotal: {total} chunks de {len(por_documento)} documentos.")

    if args.dry_run:
        print("\n--dry-run: muestra de los primeros 2 chunks de cada documento\n")
        for doc, chunks in por_documento:
            for c in chunks[:2]:
                print(f"  [{c.categoria}] {c.titulo}")
                print(f"    fuente: {c.fuente}")
                print(f"    {c.contenido[:200].replace(chr(10), ' ')}...\n")
        return

    # 2. Embeber e insertar.
    db = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])
    embeddings = ClienteEmbeddings()
    print(f"Proveedor de embeddings: {embeddings.proveedor}\n")

    tokens = 0
    for doc, chunks in por_documento:
        print(f"  {doc.etiqueta} ({len(chunks)} chunks)")
        # Re-indexar no debe duplicar: se borra por `version`, que es propia
        # de cada documento, nunca contenido de otra procedencia.
        db.table("biblioteca_clinica").delete().eq("version", doc.version).execute()
        tokens += _embeber_e_insertar(db, embeddings, chunks)

    versiones = {doc.version for doc, _ in por_documento}
    if not args.no_reembeber:
        _reembeber_ajenas(db, embeddings, versiones)

    print(f"\n{total} chunks indexados — {tokens} tokens con {embeddings.proveedor}.")
    print("Siguiente paso: python src/rag/verificar_recuperacion.py")


if __name__ == "__main__":
    main()
