import { useCallback } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { Bajada, Pantalla, Tarjeta, Titulo } from '@/components/apheleia';
import { Cargando, ErrorCarga } from '@/components/estado';
import { SIGNOS_ALARMA } from '@/data/signos-alarma';
import { useRecurso } from '@/hooks/use-recurso';
import { obtenerAvisos } from '@/lib/api';
import { PACIENTE_ID } from '@/lib/config';
import { SELLO_VALIDAR, formatearFecha } from '@/lib/contratos';
import { color, radius, space, touch, type } from '@/theme/tokens';

/**
 * Alertas — dos cosas en una pantalla, en este orden a propósito.
 *
 * 1. Signos de alarma: qué debe hacer consultar de inmediato, con el 131 a mano.
 *    Es la razón de que el botón del inicio sea rojo — es la pantalla a la que
 *    uno corre.
 * 2. Avisos enviados a su equipo: qué se informó, cuándo, y si ya lo revisaron.
 *
 * ⚠️ El bloque de emergencia es LOCAL y se renderiza siempre, aunque la carga
 * de avisos falle o no haya red. Hacerlo depender de la API significaría que
 * justo cuando más importa puede aparecer vacío. Solo degrada la mitad de
 * abajo.
 *
 * Guardrails que se ven acá:
 * - Ningún aviso interpreta un síntoma ni nombra una condición: cita el criterio
 *   que lo gatilló y nada más.
 * - Ningún aviso es un reproche. El sistema acompaña, no fiscaliza.
 * - "Su equipo lo revisó" refleja que una alerta no se cierra sin un humano.
 *
 * ⚠️ Los signos de alarma son contenido clínico pendiente de PD-05 (Joaquín).
 */
export default function Alertas() {
  const cargar = useCallback(() => obtenerAvisos(PACIENTE_ID), []);
  const { datos, cargando, error, recargar } = useRecurso(cargar);

  return (
    <Pantalla>
      <Titulo>Alertas</Titulo>
      <Bajada>Cuándo pedir ayuda, y qué se le informó a su equipo</Bajada>

      <View style={styles.bloqueAlarma}>
        <Text style={styles.tituloAlarma}>Consulte de inmediato si tiene</Text>

        {SIGNOS_ALARMA.map((s) => (
          <View key={s} style={styles.fila}>
            <Text style={styles.vinneta}>•</Text>
            <Text style={styles.signo}>{s}</Text>
          </View>
        ))}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Llamar al 131, servicio de urgencia"
          onPress={() => Linking.openURL('tel:131')}
          style={styles.boton131}>
          <Text style={styles.boton131Texto}>Llamar al 131</Text>
        </Pressable>

        <Text style={styles.sello}>{SELLO_VALIDAR}</Text>
      </View>

      <Text style={styles.subtitulo}>Avisos a su equipo de salud</Text>
      <Text style={styles.explicacion}>
        Cuando algo necesita atención, su equipo se entera. Nadie queda solo esperando.
      </Text>

      {cargando ? <Cargando que="sus avisos" /> : null}
      {error ? <ErrorCarga onReintentar={recargar} /> : null}

      {datos?.length === 0 ? (
        <Tarjeta>
          <Text style={styles.explicacion}>
            No se ha enviado ningún aviso a su equipo.
          </Text>
        </Tarjeta>
      ) : null}

      {datos?.map((a) => (
        <Tarjeta key={a.id}>
          <View style={styles.encabezado}>
            <Text style={styles.fecha}>{formatearFecha(a.fecha)}</Text>
            <View style={[styles.marca, a.revisado ? styles.marcaRevisado : styles.marcaPendiente]}>
              <Text
                style={[
                  styles.marcaTexto,
                  a.revisado ? styles.marcaTextoRevisado : styles.marcaTextoPendiente,
                ]}>
                {a.revisado ? '✓ Su equipo lo revisó' : '• En revisión'}
              </Text>
            </View>
          </View>
          <Text style={styles.motivo}>{a.motivo}</Text>
        </Tarjeta>
      ))}
    </Pantalla>
  );
}

const styles = StyleSheet.create({
  bloqueAlarma: {
    backgroundColor: color.alarmBg,
    borderColor: color.alarm,
    borderWidth: 2,
    borderRadius: radius.card,
    padding: space.md,
    marginBottom: space.xl,
  },
  tituloAlarma: {
    fontSize: type.heading,
    fontWeight: '700',
    color: color.alarm,
    marginBottom: space.sm,
  },
  fila: {
    flexDirection: 'row',
    gap: space.sm,
    marginBottom: space.xs,
  },
  vinneta: {
    fontSize: type.body,
    color: color.alarm,
    lineHeight: type.body * 1.45,
  },
  signo: {
    flex: 1,
    fontSize: type.body,
    color: color.ink,
    lineHeight: type.body * 1.45,
  },
  boton131: {
    minHeight: touch.minHeight,
    backgroundColor: color.alarm,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.md,
  },
  boton131Texto: {
    color: color.onAccent,
    fontSize: type.button,
    fontWeight: '700',
  },
  sello: {
    fontSize: type.label - 3,
    color: color.warn,
    marginTop: space.sm,
    fontWeight: '600',
  },
  subtitulo: {
    fontSize: type.heading,
    fontWeight: '700',
    color: color.ink,
    marginBottom: space.xs,
  },
  explicacion: {
    fontSize: type.body,
    color: color.inkMuted,
    marginBottom: space.md,
    lineHeight: type.body * 1.45,
  },
  encabezado: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    flexWrap: 'wrap',
  },
  fecha: {
    fontSize: type.label,
    color: color.inkMuted,
  },
  marca: {
    borderRadius: radius.pill,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  marcaRevisado: {
    backgroundColor: color.okBg,
  },
  marcaPendiente: {
    backgroundColor: color.warnBg,
  },
  marcaTexto: {
    fontSize: type.label - 3,
    fontWeight: '700',
  },
  marcaTextoRevisado: {
    color: color.ok,
  },
  marcaTextoPendiente: {
    color: color.warn,
  },
  motivo: {
    fontSize: type.body,
    color: color.ink,
    marginTop: 4,
    lineHeight: type.body * 1.45,
  },
});
