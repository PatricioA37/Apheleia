"""
Cliente de embeddings — dos proveedores tras una sola interfaz.

El proveedor se elige con `EMBEDDING_PROVIDER` en `.env` (`voyage` | `jina`).
Por defecto `voyage`, que es con lo que se construyó y verificó T021–T022.

    biblioteca_clinica  -> modelo de documento, input_type="document"
    memoria_paciente     -> modelo de memoria,   input_type="document"
    consulta en vivo      -> modelo de consulta,  input_type="query"

`input_type` importa tanto como el modelo: ambos proveedores optimizan
distinto según si el texto es lo que se busca o lo que se está buscando.

--- Voyage (familia 4) ---
voyage-4-large y voyage-4-lite comparten espacio vectorial (Matryoshka).
Esto permite retrieval asimétrico: el corpus se embebe una vez con el modelo
grande (calidad), las consultas en vivo con el liviano (costo), y ambas se
comparan en el mismo índice.

--- Jina (v3) ---
Un solo modelo, `jina-embeddings-v3`, con LoRA por tarea
(`retrieval.passage` / `retrieval.query`). No hay distinción grande/liviano:
la asimetría la da la tarea, no el modelo. Al ser un único modelo, el espacio
compartido está garantizado por construcción.

ADVERTENCIA — los espacios de Voyage y Jina NO son intercambiables. Un índice
poblado con un proveedor y consultado con el otro devuelve vecinos sin
sentido, y lo hace en silencio: no hay error, solo ranking basura. Si se
cambia `EMBEDDING_PROVIDER`, hay que re-embeber todo lo ya indexado
(`index_documents.py --reembeber-existentes`).
"""

import os
from dataclasses import dataclass
from enum import Enum

DIMENSION = 1024  # Debe coincidir con vector(1024) en schema.sql


class ModeloEmbedding(str, Enum):
    """Rol del modelo, no nombre comercial: cada proveedor lo resuelve al suyo."""
    LARGE = "large"  # biblioteca clínica — calidad, baja frecuencia
    LITE = "lite"    # memoria de paciente + queries — costo, alto volumen


class TipoInput(str, Enum):
    DOCUMENT = "document"
    QUERY = "query"


@dataclass
class ResultadoEmbedding:
    vector: list[float]
    modelo: str
    tokens: int


@dataclass
class ResultadoLote:
    vectores: list[list[float]]
    modelo: str
    tokens: int


# ============================================================
# Proveedores
# ============================================================

class _ProveedorVoyage:
    """Familia Voyage 4. Tier gratuito: 3 peticiones por minuto."""

    MODELOS = {
        ModeloEmbedding.LARGE: "voyage-4-large",
        ModeloEmbedding.LITE: "voyage-4-lite",
    }

    def __init__(self):
        import voyageai

        self._client = voyageai.Client(api_key=os.environ["VOYAGE_API_KEY"])

    def embeber(
        self, textos: list[str], modelo: ModeloEmbedding, tipo: TipoInput
    ) -> ResultadoLote:
        nombre = self.MODELOS[modelo]
        resp = self._client.embed(
            texts=textos,
            model=nombre,
            input_type=tipo.value,
            output_dimension=DIMENSION,
        )
        return ResultadoLote(
            vectores=resp.embeddings,
            modelo=nombre,
            tokens=resp.total_tokens,
        )


class _ProveedorJina:
    """jina-embeddings-v3 vía API REST.

    Un único modelo para documento y consulta; lo que cambia es `task`.
    `dimensions=1024` usa el recorte Matryoshka para calzar con el
    `vector(1024)` del schema sin migración.
    """

    URL = "https://api.jina.ai/v1/embeddings"
    MODELO = "jina-embeddings-v3"
    TAREAS = {
        TipoInput.DOCUMENT: "retrieval.passage",
        TipoInput.QUERY: "retrieval.query",
    }
    # La API acepta hasta 2048 entradas por petición; se deja margen porque
    # el límite real que se toca antes es el de tokens del cuerpo.
    MAX_POR_PETICION = 128
    TIMEOUT = 120

    def __init__(self):
        import requests

        self._requests = requests
        try:
            self._api_key = os.environ["JINA_API_KEY"]
        except KeyError:
            raise RuntimeError(
                "EMBEDDING_PROVIDER=jina pero falta JINA_API_KEY en .env. "
                "Consíguela en https://jina.ai/embeddings (tier gratuito)."
            ) from None

    def embeber(
        self, textos: list[str], modelo: ModeloEmbedding, tipo: TipoInput
    ) -> ResultadoLote:
        # `modelo` se ignora a propósito: Jina v3 es un solo modelo. Se
        # mantiene en la firma para que la interfaz no dependa del proveedor.
        vectores: list[list[float]] = []
        tokens = 0

        for i in range(0, len(textos), self.MAX_POR_PETICION):
            bloque = textos[i : i + self.MAX_POR_PETICION]
            resp = self._requests.post(
                self.URL,
                headers={
                    "Authorization": f"Bearer {self._api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self.MODELO,
                    "task": self.TAREAS[tipo],
                    "dimensions": DIMENSION,
                    "input": bloque,
                },
                timeout=self.TIMEOUT,
            )
            if resp.status_code != 200:
                raise RuntimeError(
                    f"Jina respondió {resp.status_code}: {resp.text[:300]}"
                )
            cuerpo = resp.json()

            # La API no garantiza el orden de `data`; se reordena por `index`
            # para no desalinear vectores y chunks en silencio.
            datos = sorted(cuerpo["data"], key=lambda d: d["index"])
            if len(datos) != len(bloque):
                raise RuntimeError(
                    f"Jina devolvió {len(datos)} vectores para {len(bloque)} textos."
                )
            vectores.extend(d["embedding"] for d in datos)
            tokens += cuerpo.get("usage", {}).get("total_tokens", 0)

        return ResultadoLote(vectores=vectores, modelo=self.MODELO, tokens=tokens)


_PROVEEDORES = {"voyage": _ProveedorVoyage, "jina": _ProveedorJina}


# ============================================================
# Interfaz pública — estable, no depende del proveedor
# ============================================================

class ClienteEmbeddings:
    def __init__(self, proveedor: str | None = None):
        nombre = (proveedor or os.getenv("EMBEDDING_PROVIDER", "voyage")).lower()
        if nombre not in _PROVEEDORES:
            raise ValueError(
                f"EMBEDDING_PROVIDER='{nombre}' desconocido. "
                f"Válidos: {', '.join(sorted(_PROVEEDORES))}."
            )
        self.proveedor = nombre
        self._impl = _PROVEEDORES[nombre]()

    def embeber_documento_clinico(self, texto: str) -> ResultadoEmbedding:
        """Para chunks de biblioteca_clinica. Se llama una vez por chunk,
        no en el camino caliente de la conversación."""
        return self._uno(texto, ModeloEmbedding.LARGE, TipoInput.DOCUMENT)

    def embeber_documentos_clinicos(self, textos: list[str]) -> ResultadoLote:
        """Igual que embeber_documento_clinico pero en una sola petición.

        Los tiers gratuitos limitan por peticiones por minuto, no solo por
        tokens (Voyage: 3 RPM). Sembrar la biblioteca chunk por chunk agota
        ese límite de inmediato, así que el seed embebe en lote.
        """
        return self._impl.embeber(textos, ModeloEmbedding.LARGE, TipoInput.DOCUMENT)

    def embeber_consultas(self, textos: list[str]) -> ResultadoLote:
        """Varias consultas en una petición. NO es el camino de producción
        —ahí cada turno trae un mensaje— sino el de scripts de verificación,
        que si no agotan los 3 RPM del tier gratuito."""
        return self._impl.embeber(textos, ModeloEmbedding.LITE, TipoInput.QUERY)

    def embeber_memoria_paciente(self, texto: str) -> ResultadoEmbedding:
        """Para perfil_snapshot / resumen_conversacion en memoria_paciente."""
        return self._uno(texto, ModeloEmbedding.LITE, TipoInput.DOCUMENT)

    def embeber_consulta(self, texto: str) -> ResultadoEmbedding:
        """Para el mensaje en vivo del paciente. Se ejecuta en cada turno
        de conversación — es el punto de mayor volumen, por eso LITE."""
        return self._uno(texto, ModeloEmbedding.LITE, TipoInput.QUERY)

    def _uno(
        self, texto: str, modelo: ModeloEmbedding, tipo: TipoInput
    ) -> ResultadoEmbedding:
        lote = self._impl.embeber([texto], modelo, tipo)
        return ResultadoEmbedding(
            vector=lote.vectores[0], modelo=lote.modelo, tokens=lote.tokens
        )
