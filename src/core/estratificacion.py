"""
Estratificación de riesgo ECICEP — G0 a G3.

Constitución, Principio VI: esta lógica es DETERMINISTA.
No importa el SDK de Anthropic ni llama a ningún modelo.
El tramo se calcula por conteo de condiciones crónicas activas.

Fuente: Marco Operativo ECICEP 2025 (MINSAL), Figura 5.
"""

from dataclasses import dataclass
from enum import Enum


class GrupoRiesgo(str, Enum):
    G0 = "G0"  # Sin condiciones crónicas detectadas
    G1 = "G1"  # Riesgo leve — 1 condición
    G2 = "G2"  # Riesgo moderado — 2 a 4 condiciones
    G3 = "G3"  # Riesgo severo — 5 o más condiciones


class ServicioFarmaceutico(str, Enum):
    SEGUIMIENTO_FARMACOTERAPEUTICO = "seguimiento_farmacoterapeutico"
    REVISION_CON_ENTREVISTA = "revision_con_entrevista"
    REVISION_SIN_ENTREVISTA = "revision_sin_entrevista"
    EDUCACION_GRUPAL = "educacion_grupal"


MODALIDAD_ECICEP = {
    GrupoRiesgo.G0: "Prevención y promoción",
    GrupoRiesgo.G1: "Automanejo apoyado",
    GrupoRiesgo.G2: "Gestión de enfermedad",
    GrupoRiesgo.G3: "Gestión de caso",
}


@dataclass
class ResultadoEstratificacion:
    grupo_riesgo: GrupoRiesgo
    n_condiciones: int
    n_medicamentos: int
    servicio_farmaceutico_sugerido: ServicioFarmaceutico
    modalidad: str
    criterio_aplicado: str


def calcular_grupo_riesgo(n_condiciones_activas: int) -> GrupoRiesgo:
    """
    Criterio oficial ECICEP por conteo de condiciones crónicas activas.

    >>> calcular_grupo_riesgo(0)
    <GrupoRiesgo.G0: 'G0'>
    >>> calcular_grupo_riesgo(1)
    <GrupoRiesgo.G1: 'G1'>
    >>> calcular_grupo_riesgo(3)
    <GrupoRiesgo.G2: 'G2'>
    >>> calcular_grupo_riesgo(5)
    <GrupoRiesgo.G3: 'G3'>
    """
    if n_condiciones_activas < 0:
        raise ValueError("El número de condiciones no puede ser negativo")
    if n_condiciones_activas == 0:
        return GrupoRiesgo.G0
    if n_condiciones_activas == 1:
        return GrupoRiesgo.G1
    if 2 <= n_condiciones_activas <= 4:
        return GrupoRiesgo.G2
    return GrupoRiesgo.G3


def sugerir_servicio_farmaceutico(
    grupo: GrupoRiesgo, n_medicamentos: int
) -> ServicioFarmaceutico:
    """
    El nº de medicamentos modula la intensidad del seguimiento
    farmacoterapéutico (ECICEP, Figura 5).
    """
    if grupo == GrupoRiesgo.G3:
        if n_medicamentos > 7:
            return ServicioFarmaceutico.SEGUIMIENTO_FARMACOTERAPEUTICO
        if 5 <= n_medicamentos <= 7:
            return ServicioFarmaceutico.REVISION_CON_ENTREVISTA
        return ServicioFarmaceutico.REVISION_SIN_ENTREVISTA

    if grupo == GrupoRiesgo.G2:
        if n_medicamentos >= 9:
            return ServicioFarmaceutico.SEGUIMIENTO_FARMACOTERAPEUTICO
        if 6 <= n_medicamentos <= 8:
            return ServicioFarmaceutico.REVISION_CON_ENTREVISTA
        return ServicioFarmaceutico.REVISION_SIN_ENTREVISTA

    if grupo == GrupoRiesgo.G1:
        if n_medicamentos >= 7:
            return ServicioFarmaceutico.REVISION_SIN_ENTREVISTA
        return ServicioFarmaceutico.EDUCACION_GRUPAL

    return ServicioFarmaceutico.EDUCACION_GRUPAL


def estratificar(
    n_condiciones_activas: int, n_medicamentos: int = 0
) -> ResultadoEstratificacion:
    """
    Punto de entrada. Determinista — mismo input, mismo output, sin modelo.
    """
    grupo = calcular_grupo_riesgo(n_condiciones_activas)
    servicio = sugerir_servicio_farmaceutico(grupo, n_medicamentos)

    descripcion = {
        GrupoRiesgo.G0: "sin condiciones crónicas detectadas",
        GrupoRiesgo.G1: "1 condición crónica",
        GrupoRiesgo.G2: "2 a 4 condiciones crónicas",
        GrupoRiesgo.G3: "5 o más condiciones crónicas",
    }[grupo]

    return ResultadoEstratificacion(
        grupo_riesgo=grupo,
        n_condiciones=n_condiciones_activas,
        n_medicamentos=n_medicamentos,
        servicio_farmaceutico_sugerido=servicio,
        modalidad=MODALIDAD_ECICEP[grupo],
        criterio_aplicado=f"ECICEP 2025 — {descripcion} = {grupo.value}",
    )


if __name__ == "__main__":
    for n_cond, n_med in [(0, 0), (1, 8), (3, 9), (6, 10)]:
        r = estratificar(n_cond, n_med)
        print(
            f"{n_cond} condiciones, {n_med} fármacos → "
            f"{r.grupo_riesgo.value} · {r.modalidad} · "
            f"{r.servicio_farmaceutico_sugerido.value}"
        )
