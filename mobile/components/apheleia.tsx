/**
 * Piezas compartidas de la interfaz del paciente.
 *
 * Reglas que se aplican acá y no se repiten en cada pantalla:
 * - Objetivos táctiles de 58 pt de alto como mínimo, separados 12 pt.
 * - Texto en peso regular o semibold. Nada de Light: se desvanece.
 * - El color nunca es el único indicador de nada.
 */

import { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { color, radius, space, touch, type } from '@/theme/tokens';

/** Contenedor de pantalla. El ScrollView maneja las áreas seguras de forma nativa. */
export function Pantalla({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      style={styles.pantalla}
      contentContainerStyle={styles.pantallaContenido}
      contentInsetAdjustmentBehavior="automatic">
      {children}
    </ScrollView>
  );
}

export function Titulo({ children }: { children: ReactNode }) {
  return <Text style={styles.titulo}>{children}</Text>;
}

export function Bajada({ children }: { children: ReactNode }) {
  return <Text style={styles.bajada}>{children}</Text>;
}

export function Tarjeta({ children }: { children: ReactNode }) {
  return <View style={styles.tarjeta}>{children}</View>;
}

/** Botón principal: alto, sólido y con etiqueta de verbo + objeto. */
export function BotonGrande({
  etiqueta,
  onPress,
  tono = 'principal',
}: {
  etiqueta: string;
  onPress: () => void;
  tono?: 'principal' | 'secundario' | 'emergencia';
}) {
  const fondo =
    tono === 'emergencia' ? color.alarm : tono === 'secundario' ? color.surface : color.accent;
  const texto = tono === 'secundario' ? color.accent : color.onAccent;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      onPress={onPress}
      style={({ pressed }) => [
        styles.boton,
        { backgroundColor: pressed && tono === 'principal' ? color.accentPressed : fondo },
        tono === 'secundario' ? styles.botonSecundario : null,
      ]}>
      <Text style={[styles.botonTexto, { color: texto }]}>{etiqueta}</Text>
    </Pressable>
  );
}

/** Nota de procedencia del contenido clínico. Obligatoria mientras sea mock. */
export function Fuente({ children }: { children: ReactNode }) {
  return <Text style={styles.fuente}>{children}</Text>;
}

const styles = StyleSheet.create({
  pantalla: {
    flex: 1,
    backgroundColor: color.bg,
  },
  pantallaContenido: {
    padding: space.md,
    paddingBottom: space.xl,
  },
  titulo: {
    fontSize: type.title,
    fontWeight: '700',
    color: color.ink,
    marginBottom: space.xs,
  },
  bajada: {
    fontSize: type.body,
    color: color.inkMuted,
    marginBottom: space.lg,
    lineHeight: type.body * 1.5,
  },
  tarjeta: {
    backgroundColor: color.surface,
    borderColor: color.line,
    borderWidth: 1,
    borderRadius: radius.card,
    padding: space.md,
    marginBottom: touch.gap,
  },
  boton: {
    minHeight: touch.minHeight,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.md,
    marginBottom: touch.gap,
  },
  botonSecundario: {
    borderWidth: 2,
    borderColor: color.accent,
  },
  botonTexto: {
    fontSize: type.button,
    fontWeight: '600',
    textAlign: 'center',
  },
  fuente: {
    fontSize: type.label - 2,
    color: color.inkMuted,
    marginTop: space.sm,
    lineHeight: (type.label - 2) * 1.4,
  },
});
