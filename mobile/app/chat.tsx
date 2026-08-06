import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { enviarMensaje } from '@/lib/api';
import { conversacionInicial } from '@/lib/cliente-mock';
import { PACIENTE_ID } from '@/lib/config';
import type { Mensaje } from '@/lib/contratos';
import { color, radius, space, touch, type } from '@/theme/tokens';

/**
 * Conversar — la pantalla que más pesa en la evaluación del Lab.
 *
 * Acá es donde el sistema llama a Claude, vía `POST /api/paciente/{id}/chat`.
 *
 * Guardrails visibles en esta pantalla:
 * - El agente deriva ante un signo de alarma, nunca interpreta el síntoma.
 * - Cita la fuente del contenido clínico, y declara cuando es mock sin validar.
 * - Ante emergencia, deriva a SAMU 131 con un botón sólido, no con texto suelto.
 *
 * ⚠️ Si la llamada falla NO se inventa una réplica. Fabricar una respuesta del
 * agente cuando el agente no respondió es exactamente lo que prohíbe el
 * Principio IV. Se avisa de la falla de conexión y se deja el 131 a la vista.
 */
export default function Chat() {
  const [mensajes, setMensajes] = useState<Mensaje[]>(conversacionInicial);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);

  function enviar() {
    const limpio = texto.trim();
    if (limpio.length === 0 || enviando) return;
    responder(limpio);
    setTexto('');
  }

  async function responder(mensajePaciente: string) {
    setEnviando(true);

    const n = mensajes.length;

    // Consumida la pregunta, se retiran sus botones: no se responde dos veces.
    setMensajes((actual) => [
      ...actual.map((m) => (m.respuestas ? { ...m, respuestas: undefined } : m)),
      { id: `u${n}`, de: 'paciente', texto: mensajePaciente },
    ]);

    try {
      const r = await enviarMensaje(PACIENTE_ID, mensajePaciente);
      setMensajes((actual) => [
        ...actual,
        {
          id: `a${n}`,
          de: 'agente',
          texto: r.respuesta,
          fuente: r.fuente,
          derivacion: r.derivacion,
          respuestas: r.respuestas,
        },
      ]);
    } catch (e) {
      console.error('[apheleia] fallo al enviar mensaje:', e);
      // Aviso de sistema, NO una respuesta del agente: sin `fuente` clínica y
      // con el 131 disponible por si la persona lo necesitaba ahora.
      setMensajes((actual) => [
        ...actual,
        {
          id: `e${n}`,
          de: 'agente',
          texto:
            'No pude conectar con su equipo de salud. Su mensaje no se envió. ' +
            'Si es urgente, llame al 131.',
          derivacion: true,
        },
      ]);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.pantalla}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}>
      <ScrollView
        style={styles.lista}
        contentContainerStyle={styles.listaContenido}
        contentInsetAdjustmentBehavior="automatic">
        {mensajes.map((m) => (
          <View
            key={m.id}
            style={[
              styles.burbuja,
              m.de === 'paciente' ? styles.burbujaPaciente : styles.burbujaAgente,
              m.derivacion ? styles.burbujaDerivacion : null,
            ]}>
            <Text
              style={[
                styles.texto,
                m.de === 'paciente' ? styles.textoPaciente : styles.textoAgente,
                m.derivacion ? styles.textoDerivacion : null,
              ]}>
              {m.texto}
            </Text>

            {m.fuente ? <Text style={styles.fuente}>{m.fuente}</Text> : null}

            {m.derivacion ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Llamar al 131, servicio de urgencia"
                onPress={() => Linking.openURL('tel:131')}
                style={styles.botonEmergencia}>
                <Text style={styles.botonEmergenciaTexto}>Llamar al 131</Text>
              </Pressable>
            ) : null}

            {/* Respuestas de un toque: el chequeo diario se contesta sin teclear. */}
            {m.respuestas ? (
              <View style={styles.respuestas}>
                {m.respuestas.map((r) => (
                  <Pressable
                    key={r}
                    accessibilityRole="button"
                    accessibilityLabel={`Responder: ${r}`}
                    onPress={() => responder(r)}
                    style={({ pressed }) => [
                      styles.respuesta,
                      pressed ? styles.respuestaPress : null,
                    ]}>
                    <Text style={styles.respuestaTexto}>{r}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        ))}
      </ScrollView>

      <View style={styles.barra}>
        <TextInput
          style={styles.entrada}
          value={texto}
          onChangeText={setTexto}
          placeholder="Escriba aquí…"
          placeholderTextColor={color.inkMuted}
          multiline
          accessibilityLabel="Escribir un mensaje"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Enviar mensaje"
          onPress={enviar}
          disabled={enviando}
          style={({ pressed }) => [
            styles.enviar,
            pressed ? styles.enviarPress : null,
            enviando ? styles.enviarInactivo : null,
          ]}>
          <Text style={styles.enviarTexto}>{enviando ? 'Enviando…' : 'Enviar'}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  pantalla: {
    flex: 1,
    backgroundColor: color.bg,
  },
  lista: {
    flex: 1,
  },
  listaContenido: {
    padding: space.md,
  },
  burbuja: {
    maxWidth: '88%',
    borderRadius: radius.card + 4,
    padding: space.md,
    marginBottom: space.sm + 2,
  },
  burbujaAgente: {
    alignSelf: 'flex-start',
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.line,
  },
  burbujaPaciente: {
    alignSelf: 'flex-end',
    backgroundColor: color.accent,
  },
  burbujaDerivacion: {
    backgroundColor: color.alarmBg,
    borderColor: color.alarm,
    borderWidth: 2,
  },
  texto: {
    fontSize: type.body,
    lineHeight: type.body * 1.45,
  },
  textoAgente: {
    color: color.ink,
  },
  textoPaciente: {
    color: color.onAccent,
  },
  textoDerivacion: {
    color: color.alarm,
    fontWeight: '700',
  },
  fuente: {
    fontSize: type.label - 3,
    color: color.inkMuted,
    marginTop: space.sm,
    paddingTop: space.xs,
    borderTopWidth: 1,
    borderTopColor: color.line,
    lineHeight: (type.label - 3) * 1.4,
  },
  botonEmergencia: {
    minHeight: touch.minHeight - 4,
    backgroundColor: color.alarm,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.md,
  },
  botonEmergenciaTexto: {
    color: color.onAccent,
    fontSize: type.button,
    fontWeight: '700',
  },
  respuestas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
    marginTop: space.md,
  },
  respuesta: {
    minHeight: touch.minHeight - 10,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: color.accent,
    backgroundColor: color.surface,
  },
  respuestaPress: {
    backgroundColor: color.accent,
  },
  respuestaTexto: {
    fontSize: type.button,
    fontWeight: '600',
    color: color.accent,
  },
  barra: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.sm,
    padding: space.md,
    borderTopWidth: 1,
    borderTopColor: color.line,
    backgroundColor: color.surface,
  },
  entrada: {
    flex: 1,
    minHeight: touch.minHeight - 8,
    maxHeight: 140,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.card,
    paddingHorizontal: space.md,
    paddingTop: space.sm + 2,
    paddingBottom: space.sm + 2,
    fontSize: type.body,
    color: color.ink,
    backgroundColor: color.bg,
  },
  enviar: {
    minHeight: touch.minHeight - 8,
    paddingHorizontal: space.lg,
    borderRadius: radius.card,
    backgroundColor: color.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  enviarPress: {
    backgroundColor: color.accentPressed,
  },
  enviarInactivo: {
    opacity: 0.5,
  },
  enviarTexto: {
    color: color.onAccent,
    fontSize: type.button,
    fontWeight: '700',
  },
});
