"""
Tests de estratificación ECICEP.

Verifican el criterio oficial (Figura 5) y el Principio VI de la Constitución:
la estratificación es determinista y no invoca ningún modelo.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.core.estratificacion import (  # noqa: E402
    GrupoRiesgo,
    ServicioFarmaceutico,
    calcular_grupo_riesgo,
    estratificar,
    sugerir_servicio_farmaceutico,
)


class TestCriterioECICEP:
    """Criterio oficial: conteo de condiciones crónicas activas."""

    def test_g0_sin_condiciones(self):
        assert calcular_grupo_riesgo(0) == GrupoRiesgo.G0

    def test_g1_una_condicion(self):
        assert calcular_grupo_riesgo(1) == GrupoRiesgo.G1

    def test_g2_rango_dos_a_cuatro(self):
        for n in (2, 3, 4):
            assert calcular_grupo_riesgo(n) == GrupoRiesgo.G2

    def test_g3_cinco_o_mas(self):
        for n in (5, 6, 12):
            assert calcular_grupo_riesgo(n) == GrupoRiesgo.G3

    def test_fronteras(self):
        """Los límites exactos entre tramos."""
        assert calcular_grupo_riesgo(1) == GrupoRiesgo.G1
        assert calcular_grupo_riesgo(2) == GrupoRiesgo.G2
        assert calcular_grupo_riesgo(4) == GrupoRiesgo.G2
        assert calcular_grupo_riesgo(5) == GrupoRiesgo.G3

    def test_rechaza_negativo(self):
        try:
            calcular_grupo_riesgo(-1)
            assert False, "debió lanzar ValueError"
        except ValueError:
            pass


class TestServicioFarmaceutico:
    """El nº de medicamentos modula la intensidad del seguimiento."""

    def test_g3_polifarmacia_alta(self):
        assert sugerir_servicio_farmaceutico(GrupoRiesgo.G3, 8) == \
            ServicioFarmaceutico.SEGUIMIENTO_FARMACOTERAPEUTICO

    def test_g2_umbral_nueve(self):
        assert sugerir_servicio_farmaceutico(GrupoRiesgo.G2, 9) == \
            ServicioFarmaceutico.SEGUIMIENTO_FARMACOTERAPEUTICO
        assert sugerir_servicio_farmaceutico(GrupoRiesgo.G2, 8) == \
            ServicioFarmaceutico.REVISION_CON_ENTREVISTA

    def test_g1_umbral_siete(self):
        assert sugerir_servicio_farmaceutico(GrupoRiesgo.G1, 7) == \
            ServicioFarmaceutico.REVISION_SIN_ENTREVISTA
        assert sugerir_servicio_farmaceutico(GrupoRiesgo.G1, 6) == \
            ServicioFarmaceutico.EDUCACION_GRUPAL


class TestPrincipioDeterminista:
    """
    Constitución, Principio VI: la estratificación no usa modelo de IA.
    """

    def test_es_reproducible(self):
        """Mismo input → mismo output, siempre."""
        resultados = {estratificar(3, 5).grupo_riesgo for _ in range(50)}
        assert len(resultados) == 1

    def test_no_importa_sdk_de_modelo(self):
        """
        El módulo core no debe IMPORTAR el SDK de ningún modelo.
        Se analiza el AST para evitar falsos positivos por menciones
        en comentarios o docstrings.
        """
        import ast

        fuente = (
            Path(__file__).resolve().parents[1]
            / "src" / "core" / "estratificacion.py"
        ).read_text()

        arbol = ast.parse(fuente)
        importados = set()
        for nodo in ast.walk(arbol):
            if isinstance(nodo, ast.Import):
                for alias in nodo.names:
                    importados.add(alias.name.split(".")[0])
            elif isinstance(nodo, ast.ImportFrom) and nodo.module:
                importados.add(nodo.module.split(".")[0])

        prohibidos = {"anthropic", "openai", "google", "cohere"}
        assert not (importados & prohibidos), (
            f"core importa SDK de modelo: {importados & prohibidos}"
        )


class TestResultadoCompleto:
    def test_cita_el_criterio_aplicado(self):
        """Principio IV: toda afirmación cita su fuente."""
        r = estratificar(3, 5)
        assert "ECICEP" in r.criterio_aplicado
        assert "G2" in r.criterio_aplicado

    def test_modalidad_corresponde_al_tramo(self):
        assert estratificar(6, 9).modalidad == "Gestión de caso"
        assert estratificar(1, 2).modalidad == "Automanejo apoyado"


if __name__ == "__main__":
    import traceback

    fallos = 0
    for clase in (
        TestCriterioECICEP,
        TestServicioFarmaceutico,
        TestPrincipioDeterminista,
        TestResultadoCompleto,
    ):
        inst = clase()
        for nombre in dir(inst):
            if nombre.startswith("test_"):
                try:
                    getattr(inst, nombre)()
                    print(f"  ok   {clase.__name__}.{nombre}")
                except Exception:
                    fallos += 1
                    print(f"  FAIL {clase.__name__}.{nombre}")
                    traceback.print_exc()

    print(f"\n{'FALLOS: ' + str(fallos) if fallos else 'Todos los tests pasaron.'}")
