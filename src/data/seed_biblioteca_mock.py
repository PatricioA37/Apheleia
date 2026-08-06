"""
Carga la biblioteca clínica en Supabase, embebiendo con voyage-4-large.

Uso hoy (T021):
    python3 src/data/seed_biblioteca_mock.py

Uso después de T026 (contenido real de Joaquín):
    Reemplazar la fuente de datos (línea marcada abajo) por el archivo
    real de planes — el resto del script no cambia.
"""

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from dotenv import load_dotenv  # noqa: E402
from supabase import create_client  # noqa: E402

from src.data.planes.mock.biblioteca_mock import BIBLIOTECA_MOCK  # noqa: E402
from src.rag.embeddings import ClienteEmbeddings  # noqa: E402

# --- Cuando llegue el contenido real (T026), cambiar esta línea: -------
FUENTE_DATOS = BIBLIOTECA_MOCK
# Ejemplo futuro:
# from src.data.planes.reales.biblioteca import BIBLIOTECA_VALIDADA
# FUENTE_DATOS = BIBLIOTECA_VALIDADA
# -------------------------------------------------------------------------


def cargar_biblioteca():
    load_dotenv()
    supabase = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])
    embeddings = ClienteEmbeddings()

    # Re-ejecutar el seed no debe duplicar chunks. Solo se borran los del
    # propio mock (`version` mock-*), nunca contenido validado.
    if FUENTE_DATOS is BIBLIOTECA_MOCK:
        supabase.table("biblioteca_clinica").delete().like("version", "mock-%").execute()

    print(f"Cargando {len(FUENTE_DATOS)} chunks en biblioteca_clinica...\n")

    # Una sola petición a Voyage para todo el corpus: el tier gratuito
    # permite 3 peticiones por minuto, no 3 chunks por minuto.
    lote = embeddings.embeber_documentos_clinicos(
        [f"{c['titulo']}\n\n{c['contenido']}" for c in FUENTE_DATOS]
    )

    for chunk, vector in zip(FUENTE_DATOS, lote.vectores):
        fila = {
            "categoria": chunk["categoria"],
            "grupo_riesgo": chunk["grupo_riesgo"],
            "carril": chunk["carril"],
            "titulo": chunk["titulo"],
            "contenido": chunk["contenido"],
            "fuente": chunk["fuente"],
            "version": chunk["version"],
            "validado_por": chunk["validado_por"],
            "vigente": True,
            "embedding": vector,
        }

        supabase.table("biblioteca_clinica").insert(fila).execute()
        etiqueta_carril = chunk["carril"] or "ambos"
        print(f"  ok   [{chunk['categoria']:16s} {etiqueta_carril:8s}] {chunk['titulo']}")

    print(
        f"\n{len(FUENTE_DATOS)} chunks cargados — {lote.tokens} tokens "
        f"embebidos con {lote.modelo} en 1 petición."
    )

    if FUENTE_DATOS is BIBLIOTECA_MOCK:
        print(
            "\n⚠️  ADVERTENCIA: contenido MOCK, no validado por profesional.\n"
            "   No usar en demo final sin ejecutar T026 (reemplazo por "
            "contenido real)."
        )


if __name__ == "__main__":
    cargar_biblioteca()
