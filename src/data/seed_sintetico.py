"""
Generador de cohorte sintética.

Constitución: durante el Lab se trabaja EXCLUSIVAMENTE con datos sintéticos.
Cero PII real, ni en el dataset, ni en el prompt, ni en la demo.

PD-07: la distribución debe validarse con el profesional del equipo.
Los parámetros de abajo son un punto de partida razonable, NO un dato clínico.

Nota de honestidad (ver data-model.md): la cohorte no debe generarse con las
mismas reglas que el clasificador luego "descubre". Esto demuestra el mecanismo;
la validación con datos reales es fase posterior.
"""

import json
import random
import sys
from dataclasses import dataclass, asdict, field

sys.path.insert(0, __file__.rsplit("/", 3)[0])
from src.core.estratificacion import estratificar  # noqa: E402


# --- Parámetros ajustables (PD-07) -------------------------------------

# Distribución del nº de condiciones crónicas activas.
# Pensada para poblar los cuatro tramos con volumen suficiente para demo.
DIST_CONDICIONES = {
    0: 0.10,   # G0
    1: 0.25,   # G1
    2: 0.20,   # G2
    3: 0.15,
    4: 0.12,
    5: 0.10,   # G3
    6: 0.05,
    7: 0.03,
}

# Nº de medicamentos, correlacionado con el tramo (rango inclusivo)
RANGO_MEDICAMENTOS = {
    "G0": (0, 1),
    "G1": (1, 8),
    "G2": (2, 11),
    "G3": (4, 14),
}

# Estados dinámicos. Etiquetas tentativas — PD-02 las confirma.
# Proporciones tentativas: más desviación/alarma a mayor tramo.
DIST_ESTADOS = {
    "G0": {"en_meta": 0.95, "desviacion": 0.05, "alarma": 0.00},
    "G1": {"en_meta": 0.85, "desviacion": 0.13, "alarma": 0.02},
    "G2": {"en_meta": 0.72, "desviacion": 0.22, "alarma": 0.06},
    "G3": {"en_meta": 0.55, "desviacion": 0.32, "alarma": 0.13},
}

CONDICIONES_CATALOGO = [
    ("E11", "Diabetes mellitus tipo 2"),
    ("I10", "Hipertensión esencial"),
    ("E78", "Dislipidemia"),
    ("J44", "EPOC"),
    ("N18", "Enfermedad renal crónica"),
    ("I50", "Insuficiencia cardíaca"),
    ("M15", "Artrosis"),
    ("F32", "Trastorno depresivo"),
    ("E66", "Obesidad"),
    ("I25", "Cardiopatía isquémica crónica"),
]

MEDICAMENTOS_CATALOGO = [
    "Metformina", "Losartán", "Atorvastatina", "Enalapril", "Aspirina",
    "Salbutamol", "Furosemida", "Levotiroxina", "Omeprazol", "Paracetamol",
    "Insulina NPH", "Amlodipino", "Carvedilol", "Sertralina", "Alopurinol",
]

COMUNAS = ["Chillán", "Chillán Viejo", "Bulnes", "San Carlos", "Coihueco"]
PREVISION = ["FONASA A", "FONASA B", "FONASA C", "FONASA D"]


# --- Modelo ------------------------------------------------------------

@dataclass
class PacienteSintetico:
    alias: str
    pseudonym_id: str
    edad: int
    sexo: str
    prevision: str
    comuna: str
    condiciones: list = field(default_factory=list)
    medicamentos: list = field(default_factory=list)
    tramo: str = ""
    n_condiciones: int = 0
    n_medicamentos: int = 0
    servicio_farmaceutico: str = ""
    estado_dinamico: str = ""
    tiene_cuidador: bool = False


def _elegir(dist: dict):
    r = random.random()
    acc = 0.0
    for k, p in dist.items():
        acc += p
        if r <= acc:
            return k
    return list(dist.keys())[-1]


def generar_paciente(idx: int) -> PacienteSintetico:
    n_cond = _elegir(DIST_CONDICIONES)
    condiciones = random.sample(CONDICIONES_CATALOGO, k=min(n_cond, len(CONDICIONES_CATALOGO)))

    tramo_previo = estratificar(n_cond, 0).grupo_riesgo.value
    lo, hi = RANGO_MEDICAMENTOS[tramo_previo]
    n_med = random.randint(lo, hi)
    medicamentos = random.sample(MEDICAMENTOS_CATALOGO, k=min(n_med, len(MEDICAMENTOS_CATALOGO)))

    r = estratificar(n_cond, len(medicamentos))
    estado = _elegir(DIST_ESTADOS[r.grupo_riesgo.value])

    # A mayor tramo, mayor probabilidad de tener cuidador
    prob_cuidador = {"G0": 0.02, "G1": 0.08, "G2": 0.25, "G3": 0.55}[r.grupo_riesgo.value]

    return PacienteSintetico(
        alias=f"Paciente {idx:04d}",
        pseudonym_id=f"synth-{idx:04d}",
        edad=random.randint(45, 89),
        sexo=random.choice(["F", "M"]),
        prevision=random.choice(PREVISION),
        comuna=random.choice(COMUNAS),
        condiciones=[{"cie10": c, "nombre": n} for c, n in condiciones],
        medicamentos=medicamentos,
        tramo=r.grupo_riesgo.value,
        n_condiciones=n_cond,
        n_medicamentos=len(medicamentos),
        servicio_farmaceutico=r.servicio_farmaceutico_sugerido.value,
        estado_dinamico=estado,
        tiene_cuidador=random.random() < prob_cuidador,
    )


def generar_cohorte(n: int = 200, semilla: int = 42) -> list:
    random.seed(semilla)
    return [generar_paciente(i + 1) for i in range(n)]


def resumen(cohorte: list) -> dict:
    por_tramo, por_estado = {}, {}
    for p in cohorte:
        por_tramo[p.tramo] = por_tramo.get(p.tramo, 0) + 1
        clave = f"{p.tramo}/{p.estado_dinamico}"
        por_estado[clave] = por_estado.get(clave, 0) + 1
    return {"total": len(cohorte), "por_tramo": por_tramo, "por_tramo_estado": por_estado}


if __name__ == "__main__":
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 200
    cohorte = generar_cohorte(n)

    with open("cohorte_sintetica.json", "w", encoding="utf-8") as f:
        json.dump([asdict(p) for p in cohorte], f, ensure_ascii=False, indent=2)

    r = resumen(cohorte)
    print(f"Cohorte sintética generada: {r['total']} pacientes\n")
    print("Distribución por tramo:")
    for t in ["G0", "G1", "G2", "G3"]:
        c = r["por_tramo"].get(t, 0)
        print(f"  {t}: {c:4d}  ({c / r['total'] * 100:5.1f}%)")
    print("\nDistribución tramo/estado:")
    for k in sorted(r["por_tramo_estado"]):
        print(f"  {k:20s} {r['por_tramo_estado'][k]:4d}")
    print("\n→ cohorte_sintetica.json")
