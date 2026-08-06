import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BotonGrande } from '@/components/apheleia';
import { color, radius, space, touch, type } from '@/theme/tokens';

/**
 * Inicio — el centro de la app.
 *
 * Mitad superior: tres accesos. Mitad inferior: el chat, siempre a la vista.
 * El chat no vive escondido en una pestaña porque es donde ocurre el
 * acompañamiento, que es el punto del sistema.
 *
 * No se muestra tramo ni estado dinámico: es información del equipo de salud,
 * y mostrarla al paciente rozaría el lenguaje diagnóstico.
 */
export default function Inicio() {
  const router = useRouter();

  return (
    <ScrollView
      style={styles.pantalla}
      contentContainerStyle={styles.contenido}
      contentInsetAdjustmentBehavior="automatic">
      <View style={styles.barraSuperior}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Abrir configuración"
          onPress={() => router.push('/configuracion')}
          style={({ pressed }) => [styles.botonConfig, pressed ? styles.botonConfigPress : null]}>
          <Text style={styles.iconoConfig}>☰</Text>
        </Pressable>
      </View>

      <Text style={styles.saludo}>Hola</Text>
      <Text style={styles.bajada}>Su cuidado, al día</Text>

      <View style={styles.accesos}>
        <BotonGrande etiqueta="Seguimiento" onPress={() => router.push('/seguimiento')} />
        <BotonGrande etiqueta="Indicaciones" onPress={() => router.push('/indicaciones')} />
        <BotonGrande etiqueta="Calendario clínico" onPress={() => router.push('/calendario')} />
        <BotonGrande etiqueta="Plan de Salud Integral" onPress={() => router.push('/plan')} />
        {/* En rojo a propósito: es la pantalla a la que uno corre. */}
        <BotonGrande
          etiqueta="Alertas"
          tono="emergencia"
          onPress={() => router.push('/alertas')}
        />
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Abrir la conversación"
        onPress={() => router.push('/chat')}
        style={styles.chat}>
        <Text style={styles.chatPregunta}>¿Cómo se ha sentido hoy?</Text>
        <View style={styles.chatEntrada}>
          <Text style={styles.chatPlaceholder}>Escriba aquí…</Text>
          <Text style={styles.chatEnviar}>Enviar</Text>
        </View>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pantalla: {
    flex: 1,
    backgroundColor: color.bg,
  },
  contenido: {
    flexGrow: 1,
    padding: space.md,
    paddingBottom: space.lg,
  },
  barraSuperior: {
    flexDirection: 'row',
    marginBottom: space.sm,
  },
  botonConfig: {
    width: touch.minHeight,
    height: touch.minHeight,
    borderRadius: radius.card,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botonConfigPress: {
    backgroundColor: color.line,
  },
  iconoConfig: {
    fontSize: 24,
    color: color.ink,
  },
  saludo: {
    fontSize: type.title,
    fontWeight: '700',
    color: color.ink,
  },
  bajada: {
    fontSize: type.body,
    color: color.inkMuted,
    marginBottom: space.lg,
  },
  accesos: {
    justifyContent: 'center',
  },
  chat: {
    marginTop: 'auto',
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.card,
    padding: space.md,
  },
  chatPregunta: {
    fontSize: type.body,
    color: color.ink,
    fontWeight: '600',
    marginBottom: space.sm,
  },
  chatEntrada: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: color.bg,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.pill,
    paddingVertical: space.sm + 2,
    paddingHorizontal: space.md,
  },
  chatPlaceholder: {
    fontSize: type.body,
    color: color.inkMuted,
  },
  chatEnviar: {
    fontSize: type.body,
    color: color.accent,
    fontWeight: '700',
  },
});
