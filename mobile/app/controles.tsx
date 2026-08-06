import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Bajada, Pantalla, Tarjeta, Titulo } from '@/components/apheleia';
import { Cargando, ErrorCarga } from '@/components/estado';
import { useRecurso } from '@/hooks/use-recurso';
import { obtenerControles } from '@/lib/api';
import { PACIENTE_ID } from '@/lib/config';
import { formatearFecha } from '@/lib/contratos';
import { color, radius, space, type } from '@/theme/tokens';

/**
 * Controles — historial cronológico de atenciones.
 *
 * Cada control muestra su modalidad ECICEP (presencial, seguimiento a distancia,
 * transición del cuidado). No es decorativo: son las prestaciones que Apheleia
 * dice habilitar, y aparecen en el registro oficial.
 *
 * El próximo control va primero porque es lo que la persona necesita saber.
 */
export default function Controles() {
  const cargar = useCallback(() => obtenerControles(PACIENTE_ID), []);
  const { datos, cargando, error, recargar } = useRecurso(cargar);

  return (
    <Pantalla>
      <Titulo>Controles</Titulo>
      <Bajada>Sus atenciones, de la más reciente a la más antigua</Bajada>

      {cargando ? <Cargando que="sus controles" /> : null}
      {error ? <ErrorCarga onReintentar={recargar} /> : null}

      {datos?.length === 0 ? (
        <Tarjeta>
          <Text style={styles.vacio}>Todavía no hay controles registrados.</Text>
        </Tarjeta>
      ) : null}

      {datos?.map((c) => (
        <Tarjeta key={c.id}>
          <View style={styles.encabezado}>
            <Text style={styles.fecha}>{formatearFecha(c.fecha)}</Text>
            {c.proximo ? (
              <View style={styles.marca}>
                <Text style={styles.marcaTexto}>Próximo</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.titulo}>{c.titulo}</Text>
          <Text style={styles.detalle}>{c.detalle}</Text>
        </Tarjeta>
      ))}
    </Pantalla>
  );
}

const styles = StyleSheet.create({
  encabezado: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  fecha: {
    fontSize: type.label,
    color: color.inkMuted,
  },
  marca: {
    backgroundColor: color.okBg,
    borderRadius: radius.pill,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  marcaTexto: {
    fontSize: type.label - 2,
    fontWeight: '700',
    color: color.ok,
  },
  titulo: {
    fontSize: type.heading,
    fontWeight: '600',
    color: color.ink,
    marginTop: 4,
  },
  detalle: {
    fontSize: type.body,
    color: color.inkMuted,
    marginTop: 2,
  },
  vacio: {
    fontSize: type.body,
    color: color.inkMuted,
    lineHeight: type.body * 1.45,
  },
});
