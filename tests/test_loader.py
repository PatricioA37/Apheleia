"""
Valida las filas que construye el loader contra los constraints de schema.sql.

Corre sin Supabase: `construir_filas` no toca la base. La idea es que una
carga no falle a mitad de camino por una fila inválida.
"""

import pytest

from src.data.loader import PROFESIONALES, _uuid, construir_filas
from src.data.seed_sintetico import generar_cohorte

ESTADOS_VALIDOS = {
    "signo_alarma",
    "descompensado",
    "compensado",
    "en_regresion",
    "perdida_contacto",
}
CARRILES_VALIDOS = {"agudo", "cronico", "dual"}
TRAMOS_VALIDOS = {"G0", "G1", "G2", "G3"}
ORIGENES_VALIDOS = {
    None,
    "post_alta_quirurgica",
    "post_urgencia",
    "post_hospitalizacion",
}

# Campos del dominio identidad. Ninguno puede aparecer en el dominio clínico.
CAMPOS_PII = {
    "nombre_sintetico",
    "rut_hash",
    "contacto",
    "fecha_nacimiento",
    "comuna",
    "prevision",
    "sexo",
}

TABLAS_CLINICAS = (
    "paciente_clinico",
    "condicion_cronica",
    "estratificacion",
    "control",
    "asignacion_carril",
    "indicacion",
    "estado_dinamico",
)

PK_POR_TABLA = {
    "paciente_identidad": "persona_id",
    "paciente_seudonimo": "pseudonym_id",
    "paciente_clinico": "pseudonym_id",
    "condicion_cronica": "condicion_id",
    "estratificacion": "estrat_id",
    "control": "control_id",
    "asignacion_carril": "asignacion_id",
    "medicamento": "medicamento_id",
    "indicacion": "indicacion_id",
    "cuidador": "cuidador_id",
    "consentimiento": "consentimiento_id",
    "estado_dinamico": "estado_id",
}


@pytest.fixture(scope="module")
def profesionales():
    return [
        {"profesional_id": _uuid("profesional", p["nombre"]), **p}
        for p in PROFESIONALES
    ]


@pytest.fixture(scope="module")
def filas(profesionales):
    cohorte = [dict(vars(p)) for p in generar_cohorte(300)]
    return construir_filas(cohorte, _uuid("establecimiento"), profesionales)


# --- constraints declarados en schema.sql ------------------------------


def test_tramos_validos(filas):
    assert all(r["tramo_actual"] in TRAMOS_VALIDOS for r in filas["paciente_clinico"])
    assert all(r["grupo_riesgo"] in TRAMOS_VALIDOS for r in filas["estratificacion"])


def test_carriles_validos(filas):
    assert all(r["carril_actual"] in CARRILES_VALIDOS for r in filas["paciente_clinico"])
    assert all(r["carril"] in CARRILES_VALIDOS for r in filas["asignacion_carril"])


def test_estados_son_los_cinco(filas):
    assert all(r["valor"] in ESTADOS_VALIDOS for r in filas["estado_dinamico"])


def test_carril_agudo_requiere_origen(filas):
    """Replica el constraint `carril_agudo_requiere_origen`."""
    for r in filas["asignacion_carril"]:
        assert r["origen_agudo"] in ORIGENES_VALIDOS
        if r["carril"] in ("agudo", "dual"):
            assert r["origen_agudo"] is not None
        else:
            assert r["origen_agudo"] is None


def test_pk_sin_duplicados(filas):
    for tabla, pk in PK_POR_TABLA.items():
        ids = [r[pk] for r in filas[tabla]]
        assert len(ids) == len(set(ids)), f"{tabla}.{pk} tiene duplicados"


def test_integridad_referencial(filas, profesionales):
    personas = {r["persona_id"] for r in filas["paciente_identidad"]}
    pseudos = {r["pseudonym_id"] for r in filas["paciente_clinico"]}
    medicamentos = {r["medicamento_id"] for r in filas["medicamento"]}
    controles = {r["control_id"] for r in filas["control"]}
    prof_ids = {p["profesional_id"] for p in profesionales}

    assert all(r["persona_id"] in personas for r in filas["paciente_seudonimo"])
    assert pseudos == {r["pseudonym_id"] for r in filas["paciente_seudonimo"]}

    for tabla in TABLAS_CLINICAS[1:] + ("cuidador",):
        assert all(r["pseudonym_id"] in pseudos for r in filas[tabla]), tabla

    assert all(r["medicamento_id"] in medicamentos for r in filas["indicacion"])
    assert all(r["control_id"] in controles for r in filas["asignacion_carril"])
    assert all(r["definido_por"] in prof_ids for r in filas["asignacion_carril"])
    assert all(r["persona_id"] in personas for r in filas["consentimiento"])


# --- principios de la constitución -------------------------------------


def test_dominio_clinico_sin_pii(filas):
    """Principio V: el dominio clínico opera sobre pseudonym_id, sin PII."""
    for tabla in TABLAS_CLINICAS:
        campos = set(filas[tabla][0].keys())
        assert not (campos & CAMPOS_PII), f"{tabla} filtra PII: {campos & CAMPOS_PII}"


def test_rut_nunca_en_plano(filas):
    """Principio V: se guarda hash con sal, nunca el RUT."""
    for r in filas["paciente_identidad"]:
        assert len(r["rut_hash"]) == 64  # sha256 hex
        assert "rut" not in r["rut_hash"].lower()


def test_carril_siempre_definido_por_una_persona(filas):
    """FR-015: el sistema nunca infiere el carril."""
    assert all(r["definido_por"] for r in filas["asignacion_carril"])


def test_estados_sembrados_se_declaran_como_tales(filas):
    """Principio VII: no se presentan datos sembrados como evaluaciones."""
    assert all(r["evaluador"] == "seed_sintetico" for r in filas["estado_dinamico"])
    assert all(r["modelo_usado"] is None for r in filas["estado_dinamico"])


def test_estratificacion_es_automatica(filas):
    """Principio VI: la estratificación es regla, no juicio humano ni modelo."""
    assert all(r["evaluado_por"] is None for r in filas["estratificacion"])
    assert all(r["vigente_hasta"] is None for r in filas["estratificacion"])
