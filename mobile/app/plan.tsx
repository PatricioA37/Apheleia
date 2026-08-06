import { useCallback } from 'react';
import { StyleSheet, Text } from 'react-native';

import { Bajada, Fuente, Pantalla, Tarjeta, Titulo } from '@/components/apheleia';
import { Cargando, ErrorCarga } from '@/components/estado';
import { useRecurso } from '@/hooks/use-recurso';
import { obtenerPlan } from '@/lib/api';
import { PACIENTE_ID } from '@/lib/config';
import { FUENTE_PLAN } from '@/lib/contratos';
import { color, type } from '@/theme/tokens';

/**
 * Mi plan — la versión digital del plan de cuidados integral consensuado.
 *
 * El Marco Operativo ECICEP 2025 ya define este plan como el objeto central del
 * modelo, dice que debe compartirse con la persona y servirle de bitácora — y
 * hoy eso es un carné de papel (p. 51). Esta pantalla es ese carné.
 *
 * El contenido proviene de la biblioteca validada por el profesional, nunca de
 * generación libre del modelo (Principio IV: cita o di no sé). Un paciente en
 * carril `dual` recibe DOS planes y se muestran separados, sin mezclarlos.
 */
export default function Plan() {
  const cargar = useCallback(() => obtenerPlan(PACIENTE_ID), []);
  const { datos, cargando, error, recargar } = useRecurso(cargar);

  const planes = datos?.planes ?? [];
  const hayNoValidado = planes.some((p) => !p.validado);

  return (
    <Pantalla>
      <Titulo>Mi plan</Titulo>
      <Bajada>Lo que acordó con su equipo de salud</Bajada>

      {cargando ? <Cargando que="su plan" /> : null}
      {error ? <ErrorCarga onReintentar={recargar} /> : null}

      {datos && planes.length === 0 ? (
        <Tarjeta>
          <Text style={styles.detalle}>
            Su plan todavía no está disponible. Su equipo de salud lo definirá en su
            próximo control.
          </Text>
        </Tarjeta>
      ) : null}

      {planes.map((p) => (
        <Tarjeta key={`${p.aplica_a ?? 'ambos'}-${p.titulo}`}>
          <Text style={styles.titulo}>{p.titulo}</Text>
          <Text style={styles.detalle}>{p.contenido}</Text>
          <Text style={styles.origen}>{p.fuente}</Text>
        </Tarjeta>
      ))}

      {hayNoValidado ? <Fuente>{FUENTE_PLAN}</Fuente> : null}
    </Pantalla>
  );
}

const styles = StyleSheet.create({
  titulo: {
    fontSize: type.heading,
    fontWeight: '600',
    color: color.ink,
  },
  detalle: {
    fontSize: type.body,
    color: color.inkMuted,
    marginTop: 4,
    lineHeight: type.body * 1.5,
  },
  origen: {
    fontSize: type.label - 3,
    color: color.warn,
    marginTop: 8,
    fontWeight: '600',
  },
});
