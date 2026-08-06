"""
Carga la cohorte sintética en Supabase (T009 / T010).

Uso:
    python src/data/loader.py                    # usa cohorte_sintetica.json
    python src/data/loader.py --generar 200      # genera y carga en un paso
    python src/data/loader.py --limpiar          # borra antes de cargar

Requiere que el schema ya esté aplicado (T008) y SUPABASE_URL / SUPABASE_KEY
en el .env.

Qué escribe, en orden de dependencia:

    establecimiento, profesional          (catálogos mínimos)
    medicamento                           (catálogo)
    paciente_identidad -> paciente_seudonimo
    paciente_clinico
    condicion_cronica, estratificacion
    control -> asignacion_carril
    indicacion
    cuidador, consentimiento
    estado_dinamico                       (evaluador='seed_sintetico')

Principio V: la identidad y el dato clínico se cargan en dominios separados y
solo se cruzan por `paciente_seudonimo`. El RUT nunca se guarda en plano —
se guarda su hash con sal.

Principio VII: los estados sembrados se marcan `evaluador='seed_sintetico'`.
NO son evaluaciones del clasificador y no deben presentarse como tales; T029
los reemplaza por evaluaciones reales.
"""

import argparse
import hashlib
import json
import os
import random
import sys
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from dotenv import load_dotenv  # noqa: E402
from supabase import create_client  # noqa: E402

from src.data.seed_sintetico import generar_cohorte  # noqa: E402

ARCHIVO_COHORTE = "cohorte_sintetica.json"

# Namespace fijo: el mismo alias sintético produce siempre el mismo uuid,
# así recargar la cohorte no duplica pacientes.
NS_APHELEIA = uuid.UUID("a94a8fe5-ccb1-4ba6-9c4f-6d3f6a1f0000")

# Sal del hash de RUT. En producción viene de secreto gestionado; aquí los
# RUT son sintéticos y la sal existe para que el código sea el correcto.
SAL_RUT = os.environ.get("SAL_RUT", "apheleia-lab-sintetico")

ESTABLECIMIENTO = {"nombre": "CESFAM Ñuble Sur (sintético)", "comuna": "Chillán"}

# Dupla gestora ECICEP: profesional + TENS.
PROFESIONALES = [
    {"nombre": "Prof. Sintético 1", "rol": "enfermera", "es_dupla_gestora": True},
    {"nombre": "Prof. Sintético 2", "rol": "TENS", "es_dupla_gestora": True},
    {"nombre": "Prof. Sintético 3", "rol": "medico", "es_dupla_gestora": False},
]

# Orden inverso de dependencia, para --limpiar
TABLAS_EN_ORDEN_INVERSO = [
    "estado_dinamico",
    "indicacion",
    "asignacion_carril",
    "control",
    "estratificacion",
    "condicion_cronica",
    "consentimiento",
    "cuidador",
    "paciente_clinico",
    "paciente_seudonimo",
    "paciente_identidad",
    "medicamento",
    "profesional",
    "establecimiento",
]

LOTE = 500


# --- utilidades --------------------------------------------------------


def _uuid(*partes: str) -> str:
    return str(uuid.uuid5(NS_APHELEIA, "|".join(partes)))


def _hash_rut(rut_sintetico: str) -> str:
    return hashlib.sha256((SAL_RUT + rut_sintetico).encode()).hexdigest()


def _fecha_nacimiento(edad: int, semilla: str) -> str:
    rnd = random.Random(semilla)
    hoy = date.today()
    return date(hoy.year - edad, rnd.randint(1, 12), rnd.randint(1, 28)).isoformat()


def _dias_atras(n: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=n)).isoformat()


def _insertar(db, tabla: str, filas: list) -> None:
    if not filas:
        return
    for i in range(0, len(filas), LOTE):
        db.table(tabla).insert(filas[i : i + LOTE]).execute()
    print(f"  {tabla:22s} {len(filas):5d} filas")


# --- construcción de filas ---------------------------------------------


def construir_filas(cohorte: list, establecimiento_id: str, profesionales: list) -> dict:
    """Arma todas las filas en memoria. Sin efectos sobre la base."""
    rnd = random.Random(42)
    duplas = [p for p in profesionales if p["es_dupla_gestora"]] or profesionales

    identidades, seudonimos, clinicos = [], [], []
    condiciones, estratificaciones, controles = [], [], []
    carriles, indicaciones, cuidadores = [], [], []
    consentimientos, estados = [], []
    catalogo_medicamentos = {}

    for p in cohorte:
        alias = p["pseudonym_id"]
        persona_id = _uuid("persona", alias)
        pseudonym_id = _uuid("pseudonimo", alias)
        profesional = rnd.choice(duplas)

        # --- dominio identidad (acceso restringido)
        identidades.append(
            {
                "persona_id": persona_id,
                "rut_hash": _hash_rut(f"rut-sintetico-{alias}"),
                "nombre_sintetico": p["alias"],
                "fecha_nacimiento": _fecha_nacimiento(p["edad"], alias),
                "sexo": p["sexo"],
                "prevision": p["prevision"],
                "comuna": p["comuna"],
                "contacto": f"+56 9 0000 {abs(hash(alias)) % 10000:04d}",
            }
        )
        seudonimos.append(
            {"pseudonym_id": pseudonym_id, "persona_id": persona_id, "activo": True}
        )

        # --- dominio clínico (sin PII)
        clinicos.append(
            {
                "pseudonym_id": pseudonym_id,
                "establecimiento_id": establecimiento_id,
                "tramo_actual": p["tramo"],
                "carril_actual": p["carril"],
                "fecha_ingreso_ecicep": (
                    date.today() - timedelta(days=rnd.randint(30, 700))
                ).isoformat(),
            }
        )

        for c in p["condiciones"]:
            condiciones.append(
                {
                    "condicion_id": _uuid("condicion", alias, c["cie10"]),
                    "pseudonym_id": pseudonym_id,
                    "cie10": c["cie10"],
                    "nombre": c["nombre"],
                    "fecha_diagnostico": (
                        date.today() - timedelta(days=rnd.randint(200, 3000))
                    ).isoformat(),
                    "activa": True,
                }
            )

        # evaluado_por = NULL: la estratificación es automática y determinista
        estratificaciones.append(
            {
                "estrat_id": _uuid("estrat", alias),
                "pseudonym_id": pseudonym_id,
                "grupo_riesgo": p["tramo"],
                "n_condiciones": p["n_condiciones"],
                "n_medicamentos": p["n_medicamentos"],
                "evaluado_por": None,
                "vigente_desde": _dias_atras(rnd.randint(5, 120)),
                "vigente_hasta": None,
            }
        )

        # --- control de ingreso: da contexto y ancla la asignación de carril
        control_id = _uuid("control", alias)
        controles.append(
            {
                "control_id": control_id,
                "pseudonym_id": pseudonym_id,
                "profesional_id": profesional["profesional_id"],
                "modalidad_ecicep": "ingreso",
                "fecha": _dias_atras(rnd.randint(10, 180)),
                "resumen": "Ingreso a seguimiento (cohorte sintética)",
                "rce_referencia": f"RCE-SINT-{alias}",
            }
        )

        # --- EJE 1: el carril lo define SIEMPRE un profesional (FR-015).
        # origen_agudo obligatorio en agudo/dual, nulo en cronico.
        carriles.append(
            {
                "asignacion_id": _uuid("carril", alias),
                "pseudonym_id": pseudonym_id,
                "carril": p["carril"],
                "origen_agudo": p["origen_agudo"],
                "definido_por": profesional["profesional_id"],
                "control_id": control_id,
                "vigente_desde": _dias_atras(rnd.randint(5, 120)),
                "vigente_hasta": None,
            }
        )

        for nombre_med in p["medicamentos"]:
            if nombre_med not in catalogo_medicamentos:
                catalogo_medicamentos[nombre_med] = {
                    "medicamento_id": _uuid("medicamento", nombre_med),
                    "nombre": nombre_med,
                    "principio_activo": nombre_med,
                    "forma": "comprimido",
                }
            indicaciones.append(
                {
                    "indicacion_id": _uuid("indicacion", alias, nombre_med),
                    "pseudonym_id": pseudonym_id,
                    "medicamento_id": catalogo_medicamentos[nombre_med]["medicamento_id"],
                    "indicado_por": profesional["profesional_id"],
                    "dosis": rnd.choice(["1 comprimido", "2 comprimidos", "media dosis"]),
                    "frecuencia": rnd.choice(["cada 24 h", "cada 12 h", "cada 8 h"]),
                    "vigente_desde": _dias_atras(rnd.randint(10, 400)),
                    "vigente_hasta": None,
                }
            )

        # --- consentimiento por finalidad (Ley 21.719)
        for finalidad in ("seguimiento_cronico", "contacto_agente"):
            consentimientos.append(
                {
                    "consentimiento_id": _uuid("consent", alias, finalidad),
                    "persona_id": persona_id,
                    "finalidad": finalidad,
                    "base_licitud": None,  # pendiente de confirmar con el equipo
                    "estado": "otorgado",
                    "otorgado_at": _dias_atras(rnd.randint(30, 700)),
                    "revocado_at": None,
                }
            )

        if p["tiene_cuidador"]:
            cuidadores.append(
                {
                    "cuidador_id": _uuid("cuidador", alias),
                    "pseudonym_id": pseudonym_id,
                    "nombre_sintetico": f"Cuidador de {p['alias']}",
                    "contacto": f"+56 9 1111 {abs(hash('c' + alias)) % 10000:04d}",
                    "vinculo": rnd.choice(["familiar", "formal"]),
                    "consentido_por_usuario": True,
                }
            )
            consentimientos.append(
                {
                    "consentimiento_id": _uuid("consent", alias, "alerta_cuidador"),
                    "persona_id": persona_id,
                    "finalidad": "alerta_cuidador",
                    "base_licitud": None,
                    "estado": "otorgado",
                    "otorgado_at": _dias_atras(rnd.randint(30, 700)),
                    "revocado_at": None,
                }
            )

        # --- EJE 2: estado SEMBRADO, no evaluado. Ver docstring del módulo.
        estados.append(
            {
                "estado_id": _uuid("estado", alias),
                "pseudonym_id": pseudonym_id,
                "valor": p["estado_dinamico"],
                "probabilidades": None,
                "incertidumbre": None,
                "evaluador": "seed_sintetico",
                "modelo_usado": None,
                "generado_at": _dias_atras(rnd.randint(0, 7)),
            }
        )

    return {
        "paciente_identidad": identidades,
        "paciente_seudonimo": seudonimos,
        "paciente_clinico": clinicos,
        "condicion_cronica": condiciones,
        "estratificacion": estratificaciones,
        "control": controles,
        "asignacion_carril": carriles,
        "medicamento": list(catalogo_medicamentos.values()),
        "indicacion": indicaciones,
        "cuidador": cuidadores,
        "consentimiento": consentimientos,
        "estado_dinamico": estados,
    }


# --- carga -------------------------------------------------------------


def limpiar(db) -> None:
    print("Limpiando tablas (orden inverso de dependencia)...")
    for tabla in TABLAS_EN_ORDEN_INVERSO:
        db.table(tabla).delete().neq("xmin", 0).execute()
        print(f"  {tabla}")
    print()


def cargar(cohorte: list, db) -> None:
    print(f"Cargando {len(cohorte)} pacientes sintéticos...\n")

    est = (
        db.table("establecimiento")
        .insert({"establecimiento_id": _uuid("establecimiento"), **ESTABLECIMIENTO})
        .execute()
    )
    establecimiento_id = est.data[0]["establecimiento_id"]

    profesionales = [
        {
            "profesional_id": _uuid("profesional", p["nombre"]),
            "establecimiento_id": establecimiento_id,
            **p,
        }
        for p in PROFESIONALES
    ]
    db.table("profesional").insert(profesionales).execute()
    print(f"  {'establecimiento':22s} {1:5d} filas")
    print(f"  {'profesional':22s} {len(profesionales):5d} filas")

    filas = construir_filas(cohorte, establecimiento_id, profesionales)

    # El orden importa: cada tabla depende de las anteriores por FK.
    for tabla in (
        "paciente_identidad",
        "paciente_seudonimo",
        "paciente_clinico",
        "condicion_cronica",
        "estratificacion",
        "medicamento",
        "control",
        "asignacion_carril",
        "indicacion",
        "cuidador",
        "consentimiento",
        "estado_dinamico",
    ):
        _insertar(db, tabla, filas[tabla])

    print(
        "\n⚠️  Los estados quedaron con evaluador='seed_sintetico': son datos\n"
        "   sembrados, NO evaluaciones del clasificador. T029 los reemplaza."
    )


def main() -> None:
    ap = argparse.ArgumentParser(description="Carga la cohorte sintética en Supabase")
    ap.add_argument("--archivo", default=ARCHIVO_COHORTE)
    ap.add_argument("--generar", type=int, metavar="N", help="genera N pacientes al vuelo")
    ap.add_argument("--limpiar", action="store_true", help="borra todo antes de cargar")
    ap.add_argument("--dry-run", action="store_true", help="arma las filas y no escribe")
    args = ap.parse_args()

    load_dotenv()

    if args.generar:
        cohorte = [
            {k: v for k, v in vars(p).items()} for p in generar_cohorte(args.generar)
        ]
    else:
        ruta = Path(args.archivo)
        if not ruta.exists():
            sys.exit(
                f"No existe {ruta}. Genera la cohorte primero:\n"
                f"  python src/data/seed_sintetico.py 200\n"
                f"o usa --generar N"
            )
        cohorte = json.loads(ruta.read_text(encoding="utf-8"))

    if args.dry_run:
        filas = construir_filas(cohorte, _uuid("establecimiento"), [
            {"profesional_id": _uuid("profesional", p["nombre"]), **p}
            for p in PROFESIONALES
        ])
        print(f"DRY RUN — {len(cohorte)} pacientes, sin escribir en Supabase\n")
        for tabla, f in filas.items():
            print(f"  {tabla:22s} {len(f):5d} filas")
        return

    url, key = os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_KEY")
    if not url or not key:
        sys.exit("Faltan SUPABASE_URL / SUPABASE_KEY en el .env")

    db = create_client(url, key)

    if args.limpiar:
        limpiar(db)

    cargar(cohorte, db)


if __name__ == "__main__":
    main()
