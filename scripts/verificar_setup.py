#!/usr/bin/env python3
"""
Verificación de configuración — correr después de clonar y antes de trabajar.

    python3 scripts/verificar_setup.py

Detecta los problemas que rompen el arranque: rama incorrecta, variables de
entorno faltantes, dependencias sin instalar, imports rotos.

No requiere conexión a Supabase ni consumir API — solo valida que el entorno
esté bien armado.
"""

import importlib.util
import os
import subprocess
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))

fallos = []
avisos = []


def ok(msg):
    print(f"  \033[92mok\033[0m    {msg}")


def error(msg):
    print(f"  \033[91mERROR\033[0m {msg}")
    fallos.append(msg)


def aviso(msg):
    print(f"  \033[93maviso\033[0m {msg}")
    avisos.append(msg)


print("\n== Rama de git ==")
try:
    rama = subprocess.run(
        ["git", "branch", "--show-current"],
        cwd=RAIZ, capture_output=True, text=True, check=True,
    ).stdout.strip()

    if rama == "main":
        aviso("estás en 'main'. La rama principal del proyecto es 'master'")
    elif rama == "master":
        ok("en 'master' (recuerda crear tu rama de vértice antes de trabajar)")
    elif rama.startswith("001-continuidad-cuidado/"):
        ok(f"en rama de vértice: {rama}")
    else:
        aviso(f"rama inesperada: '{rama}' — ver docs/FLUJO-GIT.md")
except Exception as e:
    aviso(f"no se pudo verificar la rama ({e})")


print("\n== Variables de entorno ==")
try:
    from dotenv import load_dotenv
    load_dotenv(RAIZ / ".env")
except ImportError:
    aviso("python-dotenv no instalado — leyendo del entorno directamente")

REQUERIDAS = {
    "ANTHROPIC_API_KEY": "modelo de razonamiento (Claude)",
    "VOYAGE_API_KEY": "embeddings (biblioteca y memoria)",
    "SUPABASE_URL": "base de datos",
    "SUPABASE_KEY": "base de datos",
}

if not (RAIZ / ".env").exists():
    error(".env no existe. Copia .env.example a .env y complétalo")
else:
    for var, para_que in REQUERIDAS.items():
        valor = os.environ.get(var, "")
        if not valor:
            error(f"{var} sin valor — necesaria para {para_que}")
        elif valor.startswith(("sk-ant-...", "pa-...", "https://xxx")):
            error(f"{var} tiene el placeholder de .env.example, no un valor real")
        else:
            ok(f"{var} configurada")


print("\n== Dependencias Python ==")
PAQUETES = {
    "anthropic": "llamadas a Claude",
    "voyageai": "embeddings",
    "supabase": "base de datos",
    "fastapi": "API",
}
for paquete, para_que in PAQUETES.items():
    if importlib.util.find_spec(paquete) is None:
        error(f"'{paquete}' no instalado ({para_que}) — pip install -r requirements.txt")
    else:
        ok(f"{paquete}")


print("\n== Imports internos ==")
try:
    from src.core.estratificacion import estratificar
    r = estratificar(3, 9)
    assert r.grupo_riesgo.value == "G2", "estratificación devolvió valor inesperado"
    ok("src.core.estratificacion (G2 correcto para 3 condiciones)")
except Exception as e:
    error(f"src.core.estratificacion: {e}")

try:
    from src.agents.prompt_builder import GUARDRAILS_BASE
    if len(GUARDRAILS_BASE) < 500:
        error("base_guardrails.md parece vacío o truncado")
    else:
        ok(f"src.agents.prompt_builder (guardrails: {len(GUARDRAILS_BASE)} chars)")
except Exception as e:
    error(f"src.agents.prompt_builder: {e}")


print("\n== Archivos críticos ==")
for archivo in [
    ".specify/memory/constitution.md",
    "specs/001-continuidad-cuidado/spec.md",
    "specs/001-continuidad-cuidado/contracts/tools.md",
    "specs/001-continuidad-cuidado/tasks.md",
    "src/data/schema.sql",
    "src/agents/prompts/base_guardrails.md",
]:
    if (RAIZ / archivo).exists():
        ok(archivo)
    else:
        error(f"falta {archivo}")


print("\n" + "=" * 60)
if fallos:
    print(f"\033[91m{len(fallos)} problema(s) que impiden trabajar:\033[0m")
    for f in fallos:
        print(f"  · {f}")
    sys.exit(1)
elif avisos:
    print(f"\033[93mConfiguración OK con {len(avisos)} aviso(s).\033[0m")
    sys.exit(0)
else:
    print("\033[92mConfiguración correcta. Listo para trabajar.\033[0m")
    sys.exit(0)
