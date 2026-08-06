/**
 * Carga un recurso y expone sus tres estados.
 *
 * El detalle técnico del error va a consola y NUNCA a pantalla: quien usa
 * esta app tiene 65+ años y multimorbilidad. «Network request failed» no le
 * dice nada y lo asusta.
 */
import { useCallback, useEffect, useState } from 'react';

export type Recurso<T> = {
  datos: T | null;
  cargando: boolean;
  error: Error | null;
  recargar: () => void;
};

export function useRecurso<T>(cargar: () => Promise<T>, deps: unknown[] = []): Recurso<T> {
  const [datos, setDatos] = useState<T | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [intento, setIntento] = useState(0);

  const recargar = useCallback(() => setIntento((n) => n + 1), []);

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    setError(null);

    cargar()
      .then((d) => {
        if (vivo) setDatos(d);
      })
      .catch((e: unknown) => {
        if (!vivo) return;
        const err = e instanceof Error ? e : new Error(String(e));
        console.error('[apheleia] fallo al cargar:', err);
        setError(err);
      })
      .finally(() => {
        if (vivo) setCargando(false);
      });

    return () => {
      vivo = false;
    };
    // `cargar` se recrea en cada render de la pantalla; incluirlo dispararía
    // un bucle. Las dependencias reales las declara quien llama, en `deps`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intento, ...deps]);

  return { datos, cargando, error, recargar };
}
