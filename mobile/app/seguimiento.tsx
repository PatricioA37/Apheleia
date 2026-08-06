import { StyleSheet, Text, View } from 'react-native';

import { Bajada, Fuente, Pantalla, Tarjeta, Titulo } from '@/components/apheleia';
import { habitos } from '@/data/habitos';
import { medicamentosMock } from '@/data/mock';
import { patologias, type Patologia } from '@/data/patologias';
import { describirTomas } from '@/lib/contratos';
import { color, radius, space, type } from '@/theme/tokens';

/**
 * Seguimiento — sus condiciones, en palabras que se entienden.
 *
 * Primera pantalla del inicio, por recomendación de Joaquín. La persona ECICEP
 * tiene dos o más condiciones crónicas, así que la pantalla asume varias.
 *
 * EJEMPLO VISUAL. No hay carga, ni estados, ni backend: los datos salen de
 * `data/patologias.ts` y los remedios se leen de `medicamentosMock`, la misma
 * fuente que usa Indicaciones. Referenciarlos por `id` en vez de repetirlos es
 * lo que impide que las dos pantallas digan cosas distintas del mismo remedio.
 *
 * El estado que se muestra —«Estable»— lo asigna el profesional. El sistema no
 * lo calcula ni lo interpreta: solo lo repite (Principio I).
 */
export default function Seguimiento() {
  return (
    <Pantalla>
      <Titulo>Seguimiento</Titulo>
      <Bajada>Sus condiciones y cómo van</Bajada>

      {patologias.map((p) => (
        <TarjetaPatologia key={p.id} patologia={p} />
      ))}

      <Fuente>
        Esta información es general y se la explicó su equipo de salud. Si algo no se
        entiende, pregúntelo en su próximo control.
      </Fuente>
    </Pantalla>
  );
}

function TarjetaPatologia({ patologia }: { patologia: Patologia }) {
  // Búsqueda directa contra las mismas listas que ve el paciente en
  // Indicaciones. Nada se copia: si allá cambia, acá cambia.
  const suyosHabitos = patologia.habitoIds
    .map((id) => habitos.find((h) => h.id === id))
    .filter((h) => h !== undefined);

  const remedios = patologia.medicamentoIds
    .map((id) => medicamentosMock.find((m) => m.id === id))
    .filter((m) => m !== undefined);

  return (
    <Tarjeta>
      <Text style={styles.nombre}>{patologia.nombre}</Text>

      <Distintivo estado={patologia.estado} tono={patologia.tono} />

      <Text style={styles.subtitulo}>¿Qué es?</Text>
      <Text style={styles.parrafo}>{patologia.queEs}</Text>

      {/* Los hábitos van primero, y con los mismos estilos que los remedios.
          Si alguien cambia uno de los dos bloques, dejan de pesar igual. */}
      {suyosHabitos.length > 0 ? (
        <>
          <Text style={styles.subtitulo}>
            {suyosHabitos.length === 1 ? 'Su hábito para esto' : 'Sus hábitos para esto'}
          </Text>
          {suyosHabitos.map((h) => (
            <View key={h.id} style={styles.item}>
              <Text style={styles.itemNombre}>{h.titulo}</Text>
              <Text style={styles.itemPauta}>{h.frecuencia}</Text>
            </View>
          ))}
        </>
      ) : null}

      {remedios.length > 0 ? (
        <>
          <Text style={styles.subtitulo}>
            {remedios.length === 1 ? 'Su remedio para esto' : 'Sus remedios para esto'}
          </Text>
          {remedios.map((m) => (
            <View key={m.id} style={styles.item}>
              <Text style={styles.itemNombre}>
                {m.nombre} · {m.dosis}
              </Text>
              <Text style={styles.itemPauta}>
                {m.tomas ? describirTomas(m.tomas) : m.frecuencia}
              </Text>
            </View>
          ))}
        </>
      ) : null}
    </Tarjeta>
  );
}

/**
 * Distintivo de estado.
 *
 * El color va siempre con la palabra y con un punto: alguien con daltonismo o
 * con la pantalla al sol tiene que poder leerlo igual. Nunca es solo verde.
 */
function Distintivo({ estado, tono }: { estado: string; tono: Patologia['tono'] }) {
  const paleta = {
    ok: { fondo: color.okBg, tinta: color.ok },
    warn: { fondo: color.warnBg, tinta: color.warn },
    alarm: { fondo: color.alarmBg, tinta: color.alarm },
  }[tono];

  return (
    <View
      accessible
      accessibilityLabel={`Estado: ${estado}`}
      style={[styles.distintivo, { backgroundColor: paleta.fondo }]}>
      <View style={[styles.punto, { backgroundColor: paleta.tinta }]} />
      <Text style={[styles.distintivoTexto, { color: paleta.tinta }]}>{estado}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  nombre: {
    fontSize: type.heading,
    fontWeight: '600',
    color: color.ink,
  },
  distintivo: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: space.sm,
    paddingVertical: space.xs,
    paddingHorizontal: space.sm,
    borderRadius: radius.pill,
  },
  punto: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: space.xs,
  },
  distintivoTexto: {
    fontSize: type.label,
    fontWeight: '700',
  },
  subtitulo: {
    fontSize: type.body,
    fontWeight: '700',
    color: color.ink,
    marginTop: space.md,
    marginBottom: space.xs,
  },
  parrafo: {
    fontSize: type.body,
    color: color.ink,
    lineHeight: type.body * 1.45,
  },
  // Compartidos entre hábitos y remedios a propósito: un solo juego de estilos
  // es lo que garantiza que pesen igual.
  item: {
    marginTop: space.xs,
    paddingTop: space.sm,
    borderTopWidth: 1,
    borderTopColor: color.line,
  },
  itemNombre: {
    fontSize: type.body,
    fontWeight: '600',
    color: color.ink,
  },
  itemPauta: {
    fontSize: type.body,
    color: color.inkMuted,
    marginTop: 2,
  },
});
