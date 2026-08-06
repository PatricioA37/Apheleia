/**
 * Adaptador mock. Implementa `ClienteApi` leyendo de `data/mock.ts`.
 *
 * La latencia simulada NO es decorativa: sin ella los estados de carga nunca
 * se ejercitan y aparecen rotos recién al conectar el backend real.
 *
 * Acá viven las réplicas del agente simulado. Que estén en este archivo y no
 * en `data/` es lo que hace imposible el fallback prohibido: en modo HTTP,
 * `chat.tsx` no tiene forma de alcanzarlas.
 */
import {
  avisosMock,
  controlesMock,
  medicamentosMock,
  perfilMock,
  planesMock,
} from '@/data/mock';
import type {
  Aviso,
  ClienteApi,
  Control,
  Medicamento,
  Mensaje,
  Perfil,
  PlanCarril,
  RespuestaChat,
} from '@/lib/contratos';

const LATENCIA_MS = 300;

/**
 * Interruptor de pruebas. Poner en `true` a mano para ejercitar los caminos
 * de error de todas las pantallas sin desconectar nada. Volver a `false`
 * antes de commitear.
 */
const FALLAR = false;

async function responder<T>(datos: T): Promise<T> {
  await new Promise((r) => setTimeout(r, LATENCIA_MS));
  if (FALLAR) throw new Error('Falla simulada del cliente mock');
  return datos;
}

/** Chequeo diario de adherencia. Se responde con un toque, sin teclear. */
export const PREGUNTA_DIARIA = '¿Tomó sus remedios hoy?';

export const RESPUESTAS_DIARIAS = ['Sí, todos', 'Algunos', 'No'];

/**
 * Respuesta del agente simulado a cada opción. Ninguna culpa al paciente:
 * Principio III — acompaña, no fiscaliza.
 */
const REPLICAS: Record<string, string> = {
  'Sí, todos': 'Qué bueno. Lo dejo anotado para su equipo de salud.',
  Algunos:
    'Gracias por contarme, me sirve saberlo. Si quiere, cuénteme cuál se le quedó y lo anoto.',
  No: 'Gracias por contarme. Le pasa a mucha gente y no es un problema. Le voy a avisar a su equipo para que lo acompañen.',
};

/** Palabras que disparan derivación en el agente simulado. */
const SENALES_DERIVACION = ['pecho', 'respirar', 'desmay', 'sangr', 'hablar'];

export const conversacionInicial: Mensaje[] = [
  { id: 'x0', de: 'agente', texto: PREGUNTA_DIARIA, respuestas: RESPUESTAS_DIARIAS },
];

export const clienteMock: ClienteApi = {
  obtenerPerfil(_id: string): Promise<Perfil> {
    return responder(perfilMock);
  },

  obtenerMedicamentos(_id: string): Promise<Medicamento[]> {
    return responder(medicamentosMock);
  },

  obtenerControles(_id: string): Promise<Control[]> {
    return responder(controlesMock);
  },

  obtenerPlan(_id: string): Promise<{ planes: PlanCarril[] }> {
    return responder({ planes: planesMock });
  },

  obtenerAvisos(_id: string): Promise<Aviso[]> {
    return responder(avisosMock);
  },

  enviarMensaje(_id: string, texto: string): Promise<RespuestaChat> {
    const normalizado = texto.toLowerCase();

    if (SENALES_DERIVACION.some((s) => normalizado.includes(s))) {
      return responder({
        respuesta: 'Eso necesita que lo vea un profesional ahora. Voy a avisar a su equipo de salud.',
        derivacion: true,
      });
    }

    const replica = REPLICAS[texto];
    if (replica) {
      return responder({ respuesta: replica });
    }

    return responder({
      respuesta:
        'Gracias por contarme. Lo dejo anotado para su equipo de salud.',
      fuente: 'Respuesta de ejemplo — el agente real responde en modo conectado',
    });
  },
};
