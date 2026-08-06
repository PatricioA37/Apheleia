import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Bajada, Fuente, Pantalla, Seccion, Tarjeta, Titulo } from '@/components/apheleia';
import { Cargando, ErrorCarga } from '@/components/estado';
import { useRecurso } from '@/hooks/use-recurso';
import { obtenerControles } from '@/lib/api';
import { PACIENTE_ID } from '@/lib/config';
import type { Control } from '@/lib/contratos';
import { color, radius, space, type } from '@/theme/tokens';

/**
 * Controles — la agenda que se desprende de su plan de cuidado.
 *
 * No es una lista de atenciones sueltas: cada cita sale de lo que le
 * corresponde por su grupo de riesgo (G2) y por los programas en que está
 * inscrito. El `detalle` dice de dónde viene cada una —«cada 6 meses por su
 * grupo de cuidado», «Programa de Salud Cardiovascular»— para que la persona
 * entienda por qué le toca, y no solo cuándo.
 *
 * Lo que viene va primero y lo ya realizado después: alguien que abre esta
 * pantalla quiere saber cuándo es su próxima hora, no qué pasó en marzo.
 */
export default function Controles() {
  const cargar = useCallback(() => obtenerControles(PACIENTE_ID), []);
  const { datos, cargando, error, recargar } = useRecurso(cargar);

  const ahora = Date.now();
  const controles = datos ?? [];

  const proximos = controles
    .filter((c) => new Date(c.fecha).getTime() >= ahora)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  const realizados = controles
    .filter((c) => new Date(c.fecha).getTime() < ahora)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));

  return (
    <Pantalla>
      <Titulo>Calendario clínico</Titulo>
      <Bajada>Sus horas, según lo que le corresponde por su plan</Bajada>

      {cargando ? <Cargando que="sus controles" /> : null}
      {error ? <ErrorCarga onReintentar={recargar} /> : null}

      {datos && controles.length === 0 ? (
        <Tarjeta>
          <Text style={styles.vacio}>Todavía no hay horas registradas.</Text>
        </Tarjeta>
      ) : null}

      {proximos.length > 0 ? (
        <>
          <Seccion>Lo que viene</Seccion>
          {proximos.map((c, i) => (
            // La marca «Próximo» va solo en la primera: si todas la llevan,
            // ninguna destaca.
            <TarjetaControl key={c.id} control={c} destacar={i === 0} />
          ))}
        </>
      ) : null}

      {realizados.length > 0 ? (
        <>
          <Seccion>Ya realizados</Seccion>
          {realizados.map((c) => (
            <TarjetaControl key={c.id} control={c} destacar={false} />
          ))}
        </>
      ) : null}

      {controles.length > 0 ? (
        <Fuente>
          Si no puede asistir a alguna de sus horas, avísele a su centro de salud para
          que se la cambien.
        </Fuente>
      ) : null}
    </Pantalla>
  );
}

function TarjetaControl({ control, destacar }: { control: Control; destacar: boolean }) {
  return (
    <Tarjeta>
      {destacar ? (
        <View style={styles.marca}>
          <Text style={styles.marcaTexto}>Su próxima hora</Text>
        </View>
      ) : null}

      <Text style={styles.titulo}>{control.titulo}</Text>
      <Text style={styles.cuando}>{formatearFechaHora(control.fecha)}</Text>
      <Text style={styles.detalle}>{control.detalle}</Text>
    </Tarjeta>
  );
}

// Los formateadores se crean una vez y no en cada tarjeta: construir un
// `Intl.DateTimeFormat` es caro y acá se usa en cada fila de la lista.
const FECHA = new Intl.DateTimeFormat('es-CL', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const HORA = new Intl.DateTimeFormat('es-CL', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/**
 * Fecha y hora en una línea: «martes, 18 de agosto de 2026 · 08:00 h».
 *
 * Va el año completo a propósito. Una hora médica sin año se presta a
 * confusión cuando la lista mezcla lo que viene con lo que ya pasó.
 *
 * Si el valor no parsea se devuelve tal cual: mostrar la cadena cruda es
 * preferible a mostrar «Invalid Date».
 */
function formatearFechaHora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${FECHA.format(d)} · ${HORA.format(d)} h`;
}

const styles = StyleSheet.create({
  marca: {
    alignSelf: 'flex-start',
    backgroundColor: color.okBg,
    borderRadius: radius.pill,
    paddingVertical: 4,
    paddingHorizontal: space.sm,
    marginBottom: space.xs,
  },
  marcaTexto: {
    fontSize: type.label - 1,
    fontWeight: '700',
    color: color.ok,
  },
  titulo: {
    fontSize: type.heading,
    fontWeight: '600',
    color: color.ink,
  },
  // El dato que la persona viene a buscar. Va en tinta fuerte, no atenuado.
  cuando: {
    fontSize: type.body,
    fontWeight: '600',
    color: color.ink,
    marginTop: space.xs,
    lineHeight: type.body * 1.4,
  },
  detalle: {
    fontSize: type.label,
    color: color.inkMuted,
    marginTop: space.xs,
    lineHeight: type.label * 1.45,
  },
  vacio: {
    fontSize: type.body,
    color: color.inkMuted,
    lineHeight: type.body * 1.45,
  },
});
