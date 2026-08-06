import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Bajada, Pantalla, Titulo } from '@/components/apheleia';
import { MODO, describirFuente } from '@/lib/config';
import { color, radius, space, touch, type } from '@/theme/tokens';

/**
 * Configuración — maqueta. El contenido definitivo está por definir.
 *
 * Notas para cuando se defina:
 * - "Mi cuidador" conecta con la tabla `cuidador`: el consentimiento pasa por el
 *   usuario principal, nunca por el cuidador.
 * - "Datos y privacidad" es la pantalla que responde a la Ley 21.719 si alguien
 *   pregunta en el pitch.
 * - No se incluye "tamaño de letra": la app respeta el ajuste del sistema, así
 *   que duplicarlo acá sería peor (dos fuentes de verdad para lo mismo).
 */
const OPCIONES = [
  { id: 'cuidador', etiqueta: 'Mi cuidador' },
  { id: 'privacidad', etiqueta: 'Datos y privacidad' },
  { id: 'ayuda', etiqueta: 'Ayuda' },
];

export default function Configuracion() {
  return (
    <Pantalla>
      <Titulo>Configuración</Titulo>
      <Bajada>Ajustes de su cuenta</Bajada>

      <View style={styles.grupo}>
        {OPCIONES.map((o, i) => (
          <Pressable
            key={o.id}
            accessibilityRole="button"
            accessibilityLabel={o.etiqueta}
            onPress={() => {}}
            style={({ pressed }) => [
              styles.fila,
              i === OPCIONES.length - 1 ? styles.filaUltima : null,
              pressed ? styles.filaPress : null,
            ]}>
            <Text style={styles.etiqueta}>{o.etiqueta}</Text>
            <Text style={styles.flecha}>›</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.fuente}>
        <Text style={styles.fuenteRotulo}>Origen de los datos</Text>
        <Text style={styles.fuenteValor}>{describirFuente()}</Text>
        {MODO === 'mock' ? (
          <Text style={styles.fuenteNota}>
            La información que ve es de ejemplo, no corresponde a una persona real.
          </Text>
        ) : null}
      </View>

      <View style={styles.aviso}>
        <Text style={styles.avisoTexto}>
          Opciones de ejemplo. El contenido real está por definir.
        </Text>
      </View>
    </Pantalla>
  );
}

const styles = StyleSheet.create({
  grupo: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  fila: {
    minHeight: touch.minHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    borderBottomWidth: 1,
    borderBottomColor: color.line,
  },
  filaUltima: {
    borderBottomWidth: 0,
  },
  filaPress: {
    backgroundColor: color.bg,
  },
  etiqueta: {
    fontSize: type.body,
    color: color.ink,
  },
  flecha: {
    fontSize: type.heading,
    color: color.inkMuted,
  },
  fuente: {
    marginTop: space.md,
    padding: space.md,
    borderRadius: radius.card,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.line,
  },
  fuenteRotulo: {
    fontSize: type.label - 2,
    color: color.inkMuted,
    marginBottom: 2,
  },
  fuenteValor: {
    fontSize: type.body,
    color: color.ink,
    fontWeight: '600',
  },
  fuenteNota: {
    fontSize: type.label - 2,
    color: color.inkMuted,
    marginTop: space.xs,
    lineHeight: (type.label - 2) * 1.45,
  },
  aviso: {
    marginTop: space.md,
    backgroundColor: color.warnBg,
    borderRadius: radius.card,
    padding: space.md,
  },
  avisoTexto: {
    fontSize: type.label,
    color: color.warn,
    lineHeight: type.label * 1.45,
  },
});
