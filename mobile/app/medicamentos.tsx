import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Bajada, Pantalla, Tarjeta, Titulo } from '@/components/apheleia';
import { Cargando, ErrorCarga } from '@/components/estado';
import { useRecurso } from '@/hooks/use-recurso';
import { obtenerMedicamentos } from '@/lib/api';
import { PACIENTE_ID } from '@/lib/config';
import { SELLO_VALIDAR, describirTomas, type Tomas } from '@/lib/contratos';
import { color, radius, space, type } from '@/theme/tokens';

/**
 * Medicamentos — solo lectura.
 *
 * El paciente NO agrega, edita ni elimina medicamentos. Las indicaciones las
 * determina el profesional de salud (Principio I: el sistema no prescribe ni
 * modifica dosis).
 *
 * La grilla de tomas se dibuja SOLO si la indicación viene en notación de
 * posología. Una frecuencia como «cada 8 h» no significa mañana/mediodía/
 * noche: mostrarla en la grilla le atribuiría al profesional un horario que
 * no indicó. En ese caso se muestra el texto tal cual.
 */
export default function Medicamentos() {
  const cargar = useCallback(() => obtenerMedicamentos(PACIENTE_ID), []);
  const { datos, cargando, error, recargar } = useRecurso(cargar);

  return (
    <Pantalla>
      <Titulo>Medicamentos</Titulo>
      <Bajada>Lo que su equipo de salud le indicó</Bajada>

      {cargando ? <Cargando que="sus medicamentos" /> : null}
      {error ? <ErrorCarga onReintentar={recargar} /> : null}

      {datos?.length === 0 ? (
        <Tarjeta>
          <Text style={styles.vacio}>
            No hay medicamentos indicados en este momento.
          </Text>
        </Tarjeta>
      ) : null}

      {datos?.map((m) => (
        <Tarjeta key={m.id}>
          <Text style={styles.nombre}>{m.nombre}</Text>
          <Text style={styles.dosis}>{m.dosis}</Text>

          {m.tomas ? (
            <>
              <GrillaTomas tomas={m.tomas} />
              <Text style={styles.enPalabras}>{describirTomas(m.tomas)}</Text>
            </>
          ) : (
            <Text style={styles.enPalabras}>{m.frecuencia}</Text>
          )}

          {/* Recomendación de acompañamiento. Va en tono más suave que la dosis:
              lo que la persona viene a ver es cuánto y cuándo. */}
          {m.recomendacion ? (
            <View style={styles.recomendacion}>
              <Text style={styles.recomendacionTexto}>{m.recomendacion}</Text>
              <Text style={styles.sello}>{SELLO_VALIDAR}</Text>
            </View>
          ) : null}
        </Tarjeta>
      ))}

      {/* Explica la ausencia del botón. Un espacio vacío sin explicación se lee
          como una función que falta, no como una decisión. */}
      <View style={styles.aclaracion}>
        <Text style={styles.aclaracionTexto}>
          Sus medicamentos los indica su equipo de salud. Si algo no calza con su receta,
          coménteselo en su próximo control.
        </Text>
      </View>
    </Pantalla>
  );
}

/**
 * Grilla de tomas: mañana · mediodía · noche.
 *
 * El rótulo va sobre cada número para que la notación se entienda sola. El lector
 * de pantalla recibe la versión hablada, no los números sueltos.
 */
function GrillaTomas({ tomas }: { tomas: Tomas }) {
  const columnas = [
    { rotulo: 'Mañana', valor: tomas.manana },
    { rotulo: 'Mediodía', valor: tomas.mediodia },
    { rotulo: 'Noche', valor: tomas.noche },
  ];

  const hablado = columnas.map((c) => `${c.rotulo}: ${c.valor}`).join(', ');

  return (
    <View style={styles.grilla} accessible accessibilityLabel={hablado}>
      {columnas.map((c, i) => (
        <View
          key={c.rotulo}
          style={[styles.columna, i < columnas.length - 1 ? styles.columnaConBorde : null]}>
          <Text style={styles.rotulo}>{c.rotulo}</Text>
          <Text style={[styles.numero, c.valor === 0 ? styles.numeroCero : null]}>{c.valor}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  vacio: {
    fontSize: type.body,
    color: color.inkMuted,
    lineHeight: type.body * 1.45,
  },
  nombre: {
    fontSize: type.heading,
    fontWeight: '600',
    color: color.ink,
  },
  dosis: {
    fontSize: type.body,
    color: color.inkMuted,
    marginTop: 2,
  },
  grilla: {
    flexDirection: 'row',
    marginTop: space.md,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.card - 4,
    overflow: 'hidden',
    backgroundColor: color.bg,
  },
  columna: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: space.sm,
  },
  columnaConBorde: {
    borderRightWidth: 1,
    borderRightColor: color.line,
  },
  rotulo: {
    fontSize: type.label - 2,
    color: color.inkMuted,
    marginBottom: 2,
  },
  numero: {
    fontSize: type.title,
    fontWeight: '700',
    color: color.ink,
    lineHeight: type.title * 1.1,
  },
  // Un cero atenuado deja que el ojo salte directo a las tomas que sí existen.
  numeroCero: {
    color: color.inkMuted,
    fontWeight: '400',
  },
  enPalabras: {
    fontSize: type.body,
    color: color.ink,
    marginTop: space.sm,
    fontWeight: '600',
  },
  recomendacion: {
    marginTop: space.md,
    paddingTop: space.sm,
    borderTopWidth: 1,
    borderTopColor: color.line,
  },
  recomendacionTexto: {
    fontSize: type.body,
    color: color.ink,
    lineHeight: type.body * 1.45,
  },
  sello: {
    fontSize: type.label - 3,
    color: color.warn,
    marginTop: space.xs,
    fontWeight: '600',
  },
  aclaracion: {
    marginTop: space.sm,
    padding: space.md,
    borderRadius: radius.card,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.line,
  },
  aclaracionTexto: {
    fontSize: type.label,
    color: color.inkMuted,
    lineHeight: type.label * 1.5,
  },
});
