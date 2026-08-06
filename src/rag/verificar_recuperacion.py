"""
T022 — verifica que la recuperación devuelve resultados sensatos.

No es un test automatizado: contra una biblioteca mock no hay una respuesta
"correcta" que aseverar sin fijar el ranking a contenido inventado. Lo que sí
se puede leer de un vistazo es si cada pregunta trae el chunk que le
corresponde, y si el filtro por tramo y carril recorta lo que debe.

    python src/rag/verificar_recuperacion.py

Requiere biblioteca_clinica cargada (seed_biblioteca_mock.py).
"""

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from dotenv import load_dotenv  # noqa: E402
from supabase import create_client  # noqa: E402

from src.rag.embeddings import ClienteEmbeddings  # noqa: E402

# (pregunta, tramo, carril, qué debería salir primero)
CASOS = [
    ("¿cada cuánto tengo que anotar mis remedios?", "G2", "cronico",
     "la FAQ de registro de medicamentos"),
    ("¿qué significa que mi enfermedad sea crónica?", "G2", "cronico",
     "el glosario"),
    ("me dieron de alta del hospital la semana pasada", "G2", "agudo",
     "el plan de transición post-evento agudo"),
    ("¿qué me toca hacer con mi plan de cuidado?", "G3", "cronico",
     "el plan de gestión de caso (G3), NO el de G1 ni G2"),
]


def main() -> None:
    load_dotenv()
    db = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])
    embeddings = ClienteEmbeddings()

    # Un solo viaje a Voyage para las cuatro preguntas: el tier gratuito
    # permite 3 peticiones por minuto.
    lote = embeddings.embeber_consultas([c[0] for c in CASOS])
    print(f"{len(CASOS)} consultas embebidas con {lote.modelo} "
          f"({lote.tokens} tokens, 1 petición)\n")

    for (pregunta, tramo, carril, esperado), vector in zip(CASOS, lote.vectores):
        filas = db.rpc(
            "buscar_biblioteca_clinica",
            {"consulta": vector, "tramo": tramo, "carril_paciente": carril, "k": 3},
        ).execute().data

        print(f"[{tramo}/{carril}] {pregunta}")
        print(f"    se espera arriba: {esperado}")
        for i, f in enumerate(filas, 1):
            print(f"    {i}. [{f['categoria']}] {f['titulo']}")
        print()

    # El filtro de carril es la parte que sí tiene una respuesta objetiva:
    # el plan agudo no puede aparecer para un paciente crónico, y sí para
    # uno dual (contracts/tools.md — recuperar_contexto_clinico).
    print("Filtro de carril sobre el plan agudo (k=7, o sea sin recorte):")
    for carril in ("cronico", "agudo", "dual"):
        filas = db.rpc(
            "buscar_biblioteca_clinica",
            {"consulta": lote.vectores[2], "tramo": None,
             "carril_paciente": carril, "k": 7},
        ).execute().data
        titulos = [f["titulo"] for f in filas]
        visible = any("post-evento agudo" in t for t in titulos)
        esperado = carril in ("agudo", "dual")
        marca = "ok  " if visible == esperado else "FALLA"
        print(f"  {marca} carril={carril:8s} plan agudo visible={visible} "
              f"(esperado {esperado}) — {len(filas)} chunks")


if __name__ == "__main__":
    main()
