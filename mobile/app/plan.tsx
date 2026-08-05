import { StyleSheet, Text } from 'react-native';

import { Bajada, Fuente, Pantalla, Tarjeta, Titulo } from '@/components/apheleia';
import { FUENTE_PLAN, planCuidado } from '@/data/mock';
import { color, type } from '@/theme/tokens';

/**
 * Mi plan — la versión digital del plan de cuidados integral consensuado.
 *
 * El Marco Operativo ECICEP 2025 ya define este plan como el objeto central del
 * modelo, dice que debe compartirse con la persona y servirle de bitácora — y
 * hoy eso es un carné de papel (p. 51). Esta pantalla es ese carné.
 *
 * El contenido proviene de la biblioteca validada por el profesional, nunca de
 * generación libre del modelo (Principio IV: cita o di no sé). Mientras el
 * contenido real no llegue (PD-03), se declara en pantalla que es un ejemplo.
 */
export default function Plan() {
  return (
    <Pantalla>
      <Titulo>Mi plan</Titulo>
      <Bajada>Lo que acordó con su equipo de salud</Bajada>

      {planCuidado.map((item) => (
        <Tarjeta key={item.id}>
          <Text style={styles.titulo}>{item.titulo}</Text>
          <Text style={styles.detalle}>{item.detalle}</Text>
        </Tarjeta>
      ))}

      <Fuente>{FUENTE_PLAN}</Fuente>
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
});
