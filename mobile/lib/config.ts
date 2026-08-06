/**
 * Decide de dónde salen los datos.
 *
 * Expo INLINEA `process.env.EXPO_PUBLIC_*` en tiempo de build. En un sitio
 * estático (Netlify) eso significa que volver a mock exigiría un rebuild
 * completo — inaceptable en medio de una demo. Por eso en web se admite un
 * override de runtime: `?fuente=mock` en la URL, persistido en localStorage.
 *
 * Orden de resolución:
 *   1. override de runtime (solo web)
 *   2. EXPO_PUBLIC_API_URL inlineado en el build
 *   3. sin ninguno de los dos: mock
 */
import { Platform } from 'react-native';

const CLAVE_OVERRIDE = 'apheleia_fuente';

type Override = 'mock' | 'api';

function leerOverrideWeb(): Override | null {
  if (Platform.OS !== 'web') return null;

  try {
    const pedido = new URLSearchParams(window.location.search).get('fuente');
    if (pedido === 'mock' || pedido === 'api') {
      window.localStorage.setItem(CLAVE_OVERRIDE, pedido);
      return pedido;
    }

    const guardado = window.localStorage.getItem(CLAVE_OVERRIDE);
    if (guardado === 'mock' || guardado === 'api') return guardado;
  } catch {
    // localStorage bloqueado (navegación privada, cookies desactivadas).
    // No es un error: se sigue con lo que diga el build.
  }

  return null;
}

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? null;

export const PACIENTE_ID = process.env.EXPO_PUBLIC_PACIENTE_ID ?? 'demo-0001';

const override = leerOverrideWeb();

/**
 * `?fuente=api` sin URL configurada cae a mock: pedir la API cuando no hay
 * API es un error de operación, no algo que la app deba intentar igual.
 */
export const MODO: 'mock' | 'http' =
  override === 'mock' ? 'mock' : API_URL ? 'http' : 'mock';

/** Texto para el indicador de `configuracion.tsx`. */
export function describirFuente(): string {
  if (MODO === 'mock') {
    return override === 'mock'
      ? 'Datos de ejemplo (forzado con ?fuente=mock)'
      : 'Datos de ejemplo';
  }
  return `Conectada a ${API_URL}`;
}
