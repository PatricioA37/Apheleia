/**
 * Adaptador HTTP. Implementa `ClienteApi` contra `EXPO_PUBLIC_API_URL`.
 *
 * Dos cosas rompen esto en producción y no se ven en local:
 *  - Netlify sirve por HTTPS. Un backend en HTTP plano queda bloqueado por
 *    mixed content y `fetch` falla sin llegar a la red.
 *  - Sin CORSMiddleware en FastAPI el navegador descarta la respuesta aunque
 *    el backend haya devuelto 200.
 * En ambos casos el síntoma acá es el mismo: TypeError. El detalle real está
 * en la consola del navegador.
 */
import { API_URL } from '@/lib/config';
import type {
  Aviso,
  ClienteApi,
  Control,
  Medicamento,
  Perfil,
  PlanCarril,
  RespuestaChat,
} from '@/lib/contratos';

const TIMEOUT_MS = 10000;

async function pedir<T>(ruta: string, init?: RequestInit): Promise<T> {
  if (!API_URL) {
    throw new Error('cliente-http usado sin EXPO_PUBLIC_API_URL configurada');
  }

  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), TIMEOUT_MS);

  try {
    const respuesta = await fetch(`${API_URL}${ruta}`, {
      ...init,
      signal: control.signal,
      headers: {
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
    });

    if (!respuesta.ok) {
      throw new Error(`HTTP ${respuesta.status} en ${ruta}`);
    }

    return (await respuesta.json()) as T;
  } finally {
    clearTimeout(reloj);
  }
}

export const clienteHttp: ClienteApi = {
  obtenerPerfil: (id) => pedir<Perfil>(`/api/paciente/${id}/perfil`),

  obtenerMedicamentos: (id) => pedir<Medicamento[]>(`/api/paciente/${id}/medicamentos`),

  obtenerControles: (id) => pedir<Control[]>(`/api/paciente/${id}/controles`),

  obtenerPlan: (id) => pedir<{ planes: PlanCarril[] }>(`/api/paciente/${id}/plan`),

  obtenerAvisos: (id) => pedir<Aviso[]>(`/api/paciente/${id}/avisos`),

  enviarMensaje: (id, texto) =>
    pedir<RespuestaChat>(`/api/paciente/${id}/chat`, {
      method: 'POST',
      body: JSON.stringify({ mensaje: texto }),
    }),
};
