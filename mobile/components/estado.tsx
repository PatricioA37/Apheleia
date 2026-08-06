/**
 * Estados de carga y error, compartidos por todas las pantallas.
 *
 * El texto de error es deliberadamente humano y accionable: dice qué pasó en
 * términos de la persona («su equipo de salud»), no del sistema, y ofrece
 * exactamente una acción.
 */
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { color, radius, space, touch, type } from '@/theme/tokens';

export function Cargando({ que }: { que: string }) {
  return (
    <View style={styles.centro} accessible accessibilityLabel={`Cargando ${que}`}>
      <ActivityIndicator size="large" color={color.accent} />
      <Text style={styles.textoCargando}>Cargando {que}…</Text>
    </View>
  );
}

export function ErrorCarga({ onReintentar }: { onReintentar: () => void }) {
  return (
    <View style={styles.centro}>
      <Text style={styles.textoError}>
        No pude conectar con su equipo de salud. Intente de nuevo.
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Intentar de nuevo"
        onPress={onReintentar}
        style={({ pressed }) => [styles.boton, pressed ? styles.botonPress : null]}>
        <Text style={styles.botonTexto}>Intentar de nuevo</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  centro: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space.xl,
    gap: space.md,
  },
  textoCargando: {
    fontSize: type.body,
    color: color.inkMuted,
  },
  textoError: {
    fontSize: type.body,
    color: color.ink,
    textAlign: 'center',
    lineHeight: type.body * 1.45,
  },
  boton: {
    minHeight: touch.minHeight,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    borderRadius: radius.button,
    backgroundColor: color.accent,
  },
  botonPress: {
    backgroundColor: color.accentPressed,
  },
  botonTexto: {
    fontSize: type.button,
    fontWeight: '700',
    color: color.onAccent,
  },
});
