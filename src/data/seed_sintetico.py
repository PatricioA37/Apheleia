"""
Generador de cohorte sintética.

Población modelada: personas de 65 años o más con 2 o más condiciones crónicas
activas (CIE-10), sistema de salud chileno público y privado.

Dos ejes de clasificación, independientes y simultáneos:
  EJE 1  carril de manejo   agudo | cronico | dual
  EJE 2  estado dinámico    5 valores (PD-02 resuelto)

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
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from src.core.estratificacion import estratificar  # noqa: E402


# --- Parámetros ajustables (PD-07) -------------------------------------

# Criterio de inclusión poblacional: 65 años o más.
RANGO_EDAD = (65, 95)

# Distribución del nº de condiciones crónicas activas.
# Arranca en 2: es el criterio de inclusión de la población objetivo.
# Por eso la cohorte se concentra en G2-G3.
DIST_CONDICIONES = {
    2: 0.28,   # G2
    3: 0.22,
    4: 0.16,
    5: 0.13,   # G3
    6: 0.09,
    7: 0.06,
    8: 0.06,
}

# Minoría que llegó a G0/G1 por REGRESIÓN (deprescripción o resolución de una
# condición), no por ingreso. Existe para que la demo pueda mostrar el estado
# `en_regresion` y los tramos bajos.
#
# Declarado explícitamente: este subgrupo es un artefacto de cobertura para la
# demo, NO una proporción clínica observada. Ver nota de honestidad arriba.
PROP_POST_REGRESION = 0.06
DIST_CONDICIONES_REGRESION = {0: 0.30, 1: 0.70}

# Nº de medicamentos, correlacionado con el tramo (rango inclusivo)
RANGO_MEDICAMENTOS = {
    "G0": (0, 1),
    "G1": (1, 8),
    "G2": (2, 11),
    "G3": (4, 14),
}

# EJE 1 — carril de manejo. En la realidad lo asigna el profesional en la
# atención; aquí se sortea solo para poblar la cohorte de demo.
DIST_CARRIL = {
    "cronico": 0.70,
    "agudo": 0.18,
    "dual": 0.12,
}

ORIGENES_AGUDOS = [
    "post_alta_quirurgica",
    "post_urgencia",
    "post_hospitalizacion",
]

# EJE 2 — estados dinámicos. Los 5 valores son definitivos (PD-02 resuelto);
# las PROPORCIONES son tentativas y las valida Joaquín (PD-07).
# Criterio: más descompensación y alarma a mayor tramo.
DIST_ESTADOS = {
    "G2": {
        "signo_alarma": 0.04,
        "descompensado": 0.20,
        "compensado": 0.68,
        "en_regresion": 0.05,
        "perdida_contacto": 0.03,
    },
    "G3": {
        "signo_alarma": 0.10,
        "descompensado": 0.30,
        "compensado": 0.50,
        "en_regresion": 0.04,
        "perdida_contacto": 0.06,
    },
}

# En carril agudo o dual el paciente viene saliendo de un evento: más
# inestabilidad y más riesgo de perder contacto al volver a domicilio.
DIST_ESTADOS_AGUDO = {
    "G2": {
        "signo_alarma": 0.09,
        "descompensado": 0.33,
        "compensado": 0.50,
        "en_regresion": 0.03,
        "perdida_contacto": 0.05,
    },
    "G3": {
        "signo_alarma": 0.16,
        "descompensado": 0.40,
        "compensado": 0.34,
        "en_regresion": 0.02,
        "perdida_contacto": 0.08,
    },
}

# Pacientes en G0/G1 alcanzados por regresión: predominan `en_regresion` y
# `compensado`. No se fuerza el estado — se pondera.
DIST_ESTADOS_REGRESION = {
    "signo_alarma": 0.01,
    "descompensado": 0.06,
    "compensado": 0.33,
    "en_regresion": 0.58,
    "perdida_contacto": 0.02,
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

# Ámbito público Y privado. Proporción tentativa (PD-07).
DIST_PREVISION = {
    "FONASA A": 0.18,
    "FONASA B": 0.26,
    "FONASA C": 0.20,
    "FONASA D": 0.21,
    "ISAPRE": 0.15,
}


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
    carril: str = ""
    origen_agudo: str = None
    n_condiciones: int = 0
    n_medicamentos: int = 0
    servicio_farmaceutico: str = ""
    estado_dinamico: str = ""
    post_regresion: bool = False
    tiene_cuidador: bool = False


def _elegir(dist: dict):
    r = random.random()
    acc = 0.0
    for k, p in dist.items():
        acc += p
        if r <= acc:
            return k
    return list(dist.keys())[-1]


def _dist_estados(tramo: str, carril: str, post_regresion: bool) -> dict:
    """Elige la distribución de estados según tramo y carril.

    Los 5 estados son fijos; solo cambian las proporciones.
    """
    if post_regresion:
        return DIST_ESTADOS_REGRESION
    tabla = DIST_ESTADOS_AGUDO if carril in ("agudo", "dual") else DIST_ESTADOS
    return tabla[tramo]


def generar_paciente(idx: int) -> PacienteSintetico:
    post_regresion = random.random() < PROP_POST_REGRESION
    dist_cond = DIST_CONDICIONES_REGRESION if post_regresion else DIST_CONDICIONES
    n_cond = _elegir(dist_cond)
    condiciones = random.sample(CONDICIONES_CATALOGO, k=min(n_cond, len(CONDICIONES_CATALOGO)))

    tramo_previo = estratificar(n_cond, 0).grupo_riesgo.value
    lo, hi = RANGO_MEDICAMENTOS[tramo_previo]
    n_med = random.randint(lo, hi)
    medicamentos = random.sample(MEDICAMENTOS_CATALOGO, k=min(n_med, len(MEDICAMENTOS_CATALOGO)))

    r = estratificar(n_cond, len(medicamentos))
    tramo = r.grupo_riesgo.value

    # EJE 1 — carril. origen_agudo es obligatorio en agudo y dual, nulo en cronico.
    carril = _elegir(DIST_CARRIL)
    origen_agudo = random.choice(ORIGENES_AGUDOS) if carril in ("agudo", "dual") else None

    # EJE 2 — estado dinámico
    estado = _elegir(_dist_estados(tramo, carril, post_regresion))

    # A mayor tramo, mayor probabilidad de tener cuidador
    prob_cuidador = {"G0": 0.02, "G1": 0.08, "G2": 0.25, "G3": 0.55}[tramo]

    return PacienteSintetico(
        alias=f"Paciente {idx:04d}",
        pseudonym_id=f"synth-{idx:04d}",
        edad=random.randint(*RANGO_EDAD),
        sexo=random.choice(["F", "M"]),
        prevision=_elegir(DIST_PREVISION),
        comuna=random.choice(COMUNAS),
        condiciones=[{"cie10": c, "nombre": n} for c, n in condiciones],
        medicamentos=medicamentos,
        tramo=tramo,
        carril=carril,
        origen_agudo=origen_agudo,
        n_condiciones=n_cond,
        n_medicamentos=len(medicamentos),
        servicio_farmaceutico=r.servicio_farmaceutico_sugerido.value,
        estado_dinamico=estado,
        post_regresion=post_regresion,
        tiene_cuidador=random.random() < prob_cuidador,
    )


def generar_cohorte(n: int = 200, semilla: int = 42) -> list:
    random.seed(semilla)
    return [generar_paciente(i + 1) for i in range(n)]


def resumen(cohorte: list) -> dict:
    por_tramo, por_carril, por_estado, por_tramo_estado = {}, {}, {}, {}
    for p in cohorte:
        por_tramo[p.tramo] = por_tramo.get(p.tramo, 0) + 1
        por_carril[p.carril] = por_carril.get(p.carril, 0) + 1
        por_estado[p.estado_dinamico] = por_estado.get(p.estado_dinamico, 0) + 1
        clave = f"{p.tramo}/{p.estado_dinamico}"
        por_tramo_estado[clave] = por_tramo_estado.get(clave, 0) + 1
    return {
        "total": len(cohorte),
        "por_tramo": por_tramo,
        "por_carril": por_carril,
        "por_estado": por_estado,
        "por_tramo_estado": por_tramo_estado,
        "post_regresion": sum(1 for p in cohorte if p.post_regresion),
    }


if __name__ == "__main__":
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 200
    cohorte = generar_cohorte(n)

    with open("cohorte_sintetica.json", "w", encoding="utf-8") as f:
        json.dump([asdict(p) for p in cohorte], f, ensure_ascii=False, indent=2)

    r = resumen(cohorte)
    print(f"Cohorte sintética generada: {r['total']} pacientes")
    print(f"Población: {RANGO_EDAD[0]}+ años, 2+ condiciones activas\n")

    print("Distribución por tramo:")
    for t in ["G0", "G1", "G2", "G3"]:
        c = r["por_tramo"].get(t, 0)
        print(f"  {t}: {c:4d}  ({c / r['total'] * 100:5.1f}%)")
    print(f"  (G0/G1 provienen de regresión: {r['post_regresion']} pacientes)")

    print("\nDistribución por carril (Eje 1):")
    for c_ in ["agudo", "cronico", "dual"]:
        c = r["por_carril"].get(c_, 0)
        print(f"  {c_:10s} {c:4d}  ({c / r['total'] * 100:5.1f}%)")

    print("\nDistribución por estado dinámico (Eje 2):")
    for e in ["signo_alarma", "descompensado", "compensado",
              "en_regresion", "perdida_contacto"]:
        c = r["por_estado"].get(e, 0)
        print(f"  {e:18s} {c:4d}  ({c / r['total'] * 100:5.1f}%)")

    print("\nDistribución tramo/estado:")
    for k in sorted(r["por_tramo_estado"]):
        print(f"  {k:26s} {r['por_tramo_estado'][k]:4d}")
    print("\n→ cohorte_sintetica.json")
