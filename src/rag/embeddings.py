"""
Cliente de embeddings — familia Voyage 4.

Decisión de arquitectura: voyage-4-large y voyage-4-lite comparten espacio
vectorial (Matryoshka). Esto permite retrieval asimétrico: el corpus se
embebe una vez con el modelo grande (calidad), las consultas en vivo se
embeben con el modelo liviano (costo), y ambas se comparan en el mismo
índice.

    biblioteca_clinica  -> voyage-4-large, input_type="document"
    memoria_paciente     -> voyage-4-lite,  input_type="document"
    consulta en vivo      -> voyage-4-lite,  input_type="query"

`input_type` importa tanto como el modelo: Voyage optimiza distinto según
si el texto es lo que se busca o lo que se está buscando.
"""

import os
from dataclasses import dataclass
from enum import Enum

import voyageai

DIMENSION = 1024  # Debe coincidir con vector(1024) en schema.sql


class ModeloEmbedding(str, Enum):
    LARGE = "voyage-4-large"  # biblioteca clínica — calidad, baja frecuencia
    LITE = "voyage-4-lite"    # memoria de paciente + queries — costo, alto volumen


class TipoInput(str, Enum):
    DOCUMENT = "document"
    QUERY = "query"


@dataclass
class ResultadoEmbedding:
    vector: list[float]
    modelo: str
    tokens: int


class ClienteEmbeddings:
    def __init__(self):
        self._client = voyageai.Client(api_key=os.environ["VOYAGE_API_KEY"])

    def embeber_documento_clinico(self, texto: str) -> ResultadoEmbedding:
        """Para chunks de biblioteca_clinica. Se llama una vez por chunk,
        no en el camino caliente de la conversación."""
        return self._embeber(texto, ModeloEmbedding.LARGE, TipoInput.DOCUMENT)

    def embeber_memoria_paciente(self, texto: str) -> ResultadoEmbedding:
        """Para perfil_snapshot / resumen_conversacion en memoria_paciente."""
        return self._embeber(texto, ModeloEmbedding.LITE, TipoInput.DOCUMENT)

    def embeber_consulta(self, texto: str) -> ResultadoEmbedding:
        """Para el mensaje en vivo del paciente. Se ejecuta en cada turno
        de conversación — es el punto de mayor volumen, por eso LITE."""
        return self._embeber(texto, ModeloEmbedding.LITE, TipoInput.QUERY)

    def _embeber(
        self, texto: str, modelo: ModeloEmbedding, tipo: TipoInput
    ) -> ResultadoEmbedding:
        resp = self._client.embed(
            texts=[texto],
            model=modelo.value,
            input_type=tipo.value,
            output_dimension=DIMENSION,
        )
        return ResultadoEmbedding(
            vector=resp.embeddings[0],
            modelo=modelo.value,
            tokens=resp.total_tokens,
        )
