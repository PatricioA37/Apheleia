import { StyleSheet, Text, View } from 'react-native';

import { Bajada, Pantalla, Tarjeta, Titulo } from '@/components/apheleia';
import { controles } from '@/data/mock';
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
  return (
    <Pantalla>
      <Titulo>Controles</Titulo>
      <Bajada>Sus atenciones, de la más reciente a la más antigua</Bajada>

      {controles.map((c) => (
        <Tarjeta key={c.id}>
          <View style={styles.encabezado}>
            <Text style={styles.fecha}>{c.fecha}</Text>
            {c.proximo ? (
              <View style={styles.marca}>
                <Text style={styles.marcaTexto}>Próximo</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.titulo}>{c.titulo}</Text>
          <Text style={styles.modalidad}>{c.modalidad}</Text>
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
  modalidad: {
    fontSize: type.body,
    color: color.inkMuted,
    marginTop: 2,
  },
});
