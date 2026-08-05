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
    supabase = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])
    embeddings = ClienteEmbeddings()

    print(f"Cargando {len(FUENTE_DATOS)} chunks en biblioteca_clinica...\n")

    for chunk in FUENTE_DATOS:
        texto_a_embeber = f"{chunk['titulo']}\n\n{chunk['contenido']}"
        resultado = embeddings.embeber_documento_clinico(texto_a_embeber)

        fila = {
            "categoria": chunk["categoria"],
            "grupo_riesgo": chunk["grupo_riesgo"],
            "titulo": chunk["titulo"],
            "contenido": chunk["contenido"],
            "fuente": chunk["fuente"],
            "version": chunk["version"],
            "validado_por": chunk["validado_por"],
            "vigente": True,
            "embedding": resultado.vector,
        }

        supabase.table("biblioteca_clinica").insert(fila).execute()
        print(f"  ok   [{chunk['categoria']:20s}] {chunk['titulo']}")

    print(f"\n{len(FUENTE_DATOS)} chunks cargados.")

    if FUENTE_DATOS is BIBLIOTECA_MOCK:
        print(
            "\n⚠️  ADVERTENCIA: contenido MOCK, no validado por profesional.\n"
            "   No usar en demo final sin ejecutar T026 (reemplazo por "
            "contenido real)."
        )


if __name__ == "__main__":
    cargar_biblioteca()
