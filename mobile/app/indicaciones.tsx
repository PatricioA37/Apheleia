import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Bajada, Fuente, Marcable, Pantalla, Seccion, Tarjeta, Titulo } from '@/components/apheleia';
import { Cargando, ErrorCarga } from '@/components/estado';
import { habitos } from '@/data/habitos';
import { medicamentosMock } from '@/data/mock';
import { useRecurso } from '@/hooks/use-recurso';
import { obtenerMedicamentos } from '@/lib/api';
import { PACIENTE_ID } from '@/lib/config';
import { describirTomas, type Tomas } from '@/lib/contratos';
import { color, radius, space, touch, type } from '@/theme/tokens';

/**
 * Indicaciones — todo lo que el equipo de salud le pidió a esta persona.
 *
 * Antes se llamaba «Medicamentos». Lo cambió Joaquín: los hábitos son
 * indicaciones clínicas, no consejos, y salían perdiendo cuando la pantalla se
 * llamaba por uno solo de los dos. Van primero por la misma razón.
 *
 * Las dos secciones comparten encabezado, tarjeta y tipografía porque caminar
 * treinta minutos pesa tanto como una dosis de metformina.
 *
 * Se marcan distinto y eso es a propósito: un remedio tiene tomas discretas en
 * el día y un hábito no. La diferencia viene del dato, no de la jerarquía.
 *
 * Sigue siendo SOLO LECTURA: el paciente no agrega, edita ni elimina nada. Las
 * indicaciones las determina el profesional (Principio I).
 */

/**
 * Marcas de «ya lo hice».
 *
 * Son un gesto VISUAL y nada más: no se guardan, no se envían y no existen
 * fuera de esta sesión. Viven en el módulo para que no se borren al ir y
 * volver de la pantalla, que es lo único que necesitan hoy.
 *
 * El día que esto sea adherencia de verdad, no es este `Set`: es un dato
 * estructurado que el backend recibe (ver D-06 en las disonancias).
 */
let marcasDeLaSesion = new Set<string>();

export default function Indicaciones() {
  const cargar = useCallback(
    () =>
      obtenerMedicamentos(PACIENTE_ID).catch((e: unknown) => {
        // 501 = endpoint aún no implementado: se muestra el ejemplo y se
        // declara en pantalla. Cualquier otro error se propaga — una caída
        // real de red no debe parecer una lista de indicaciones válida.
        if (e instanceof Error && e.message.includes('HTTP 501')) return medicamentosMock;
        throw e;
      }),
    []
  );
  const { datos, cargando, error, recargar } = useRecurso(cargar);

  const esEjemplo = datos === medicamentosMock;

  const [marcas, setMarcas] = useState<Set<string>>(marcasDeLaSesion);

  // Reversible a propósito: uno se equivoca al tocar, y desmarcar tiene que ser
  // tan fácil como marcar.
  const alternar = useCallback((clave: string) => {
    setMarcas((actuales) => {
      const siguiente = new Set(actuales);
      if (siguiente.has(clave)) {
        siguiente.delete(clave);
      } else {
        siguiente.add(clave);
      }
      marcasDeLaSesion = siguiente;
      return siguiente;
    });
  }, []);

  return (
    <Pantalla>
      <Titulo>Indicaciones</Titulo>
      <Bajada>Lo que su equipo de salud le indicó</Bajada>

      {cargando ? <Cargando que="sus indicaciones" /> : null}
      {error ? <ErrorCarga onReintentar={recargar} /> : null}

      {datos ? (
        <>
          <Seccion>Sus hábitos</Seccion>

          {habitos.map((h) => {
            const clave = `hab:${h.id}`;
            return (
              <Tarjeta key={clave}>
                <Text style={styles.encabezado}>{h.titulo}</Text>
                {h.detalle ? <Text style={styles.secundario}>{h.detalle}</Text> : null}

                <Text style={styles.destacado}>{h.frecuencia}</Text>

                {h.recomendacion ? (
                  <View style={styles.recomendacion}>
                    <Text style={styles.recomendacionTexto}>{h.recomendacion}</Text>
                  </View>
                ) : null}

                <Marcable
                  marcado={marcas.has(clave)}
                  etiqueta="Ya lo hice"
                  etiquetaMarcada="Hecho"
                  descripcion={`Marcar que ya hizo: ${h.titulo}`}
                  onPress={() => alternar(clave)}
                />
              </Tarjeta>
            );
          })}

          {/* Misma jerarquía que la sección de arriba. Ninguna es la secundaria. */}
          <Seccion>Sus remedios</Seccion>

          {datos.length === 0 ? (
            <Tarjeta>
              <Text style={styles.vacio}>No hay medicamentos indicados en este momento.</Text>
            </Tarjeta>
          ) : null}

          {datos.map((m) => (
            <Tarjeta key={`med:${m.id}`}>
              <Text style={styles.encabezado}>{m.nombre}</Text>
              <Text style={styles.secundario}>{m.dosis}</Text>

              {m.tomas ? (
                <>
                  <GrillaTomas
                    tomas={m.tomas}
                    nombre={m.nombre}
                    claveBase={`med:${m.id}`}
                    marcas={marcas}
                    onAlternar={alternar}
                  />
                  <Text style={styles.destacado}>{describirTomas(m.tomas)}</Text>
                </>
              ) : (
                /* Sin notación de posología no hay tomas que marcar. «Cada 8 h»
                   no significa mañana/mediodía/noche, y dibujar la grilla le
                   atribuiría al profesional un horario que no indicó. Hoy los
                   datos de ejemplo no llegan por acá, pero el backend sí puede
                   mandar `tomas: null` y la pantalla no se puede caer. */
                <Text style={styles.destacado}>{m.frecuencia}</Text>
              )}

              {/* Recomendación de acompañamiento. Va en tono más suave que la
                  dosis: lo que la persona viene a ver es cuánto y cuándo. */}
              {m.recomendacion ? (
                <View style={styles.recomendacion}>
                  <Text style={styles.recomendacionTexto}>{m.recomendacion}</Text>
                </View>
              ) : null}
            </Tarjeta>
          ))}

          {esEjemplo ? (
            <Fuente>
              Indicaciones de ejemplo — su equipo de salud aún no publica las suyas. No
              cambie nada de lo que toma basándose en esta pantalla.
            </Fuente>
          ) : null}

          {/* Decir la verdad sobre las marcas. Dejar creer que quedaron
              registradas sería inventarle al paciente algo que no ocurrió. */}
          <Fuente>
            Por ahora sus marcas quedan solo en este teléfono, para que usted lleve la
            cuenta del día.
          </Fuente>

          {/* Explica la ausencia del botón de agregar. Un espacio vacío sin
              explicación se lee como una función que falta, no como una decisión. */}
          <View style={styles.aclaracion}>
            <Text style={styles.aclaracionTexto}>
              Sus indicaciones las define su equipo de salud. Si algo no calza con lo que le
              dijeron, coménteselo en su próximo control.
            </Text>
          </View>
        </>
      ) : null}
    </Pantalla>
  );
}

/**
 * Grilla de tomas: mañana · mediodía · noche. Cada toma se marca por separado.
 *
 * Reglas que sostienen esto:
 *  - El número NUNCA cambia al marcar. Es la dosis indicada, no un estado. Si
 *    cambiara de color o de tamaño, alguien podría leerlo como que le
 *    modificaron la receta.
 *  - Una toma en cero no se toca y no parece botón: nada que tomar, nada que
 *    marcar. Queda plana para que se distinga de las que sí son presionables.
 *  - El verde va siempre acompañado del visto. El color no es el único
 *    indicador: alguien con daltonismo o con la pantalla al sol lo ve igual.
 *  - Cada casilla es su propio control para el lector de pantalla, con su
 *    momento del día y su estado. Antes la grilla era un solo bloque hablado.
 */
function GrillaTomas({
  tomas,
  nombre,
  claveBase,
  marcas,
  onAlternar,
}: {
  tomas: Tomas;
  nombre: string;
  claveBase: string;
  marcas: Set<string>;
  onAlternar: (clave: string) => void;
}) {
  const columnas = [
    { id: 'manana', rotulo: 'Mañana', valor: tomas.manana },
    { id: 'mediodia', rotulo: 'Mediodía', valor: tomas.mediodia },
    { id: 'noche', rotulo: 'Noche', valor: tomas.noche },
  ];

  return (
    <View style={styles.grilla}>
      {columnas.map((c, i) => {
        const conBorde = i < columnas.length - 1 ? styles.columnaConBorde : null;

        // Sin toma indicada: informa, no invita. Sin fondo propio y sin visto.
        if (c.valor === 0) {
          return (
            <View
              key={c.id}
              accessible
              accessibilityLabel={`${c.rotulo}: sin toma indicada`}
              style={[styles.columna, styles.columnaVacia, conBorde]}>
              <Text style={styles.rotulo}>{c.rotulo}</Text>
              <Text style={[styles.numero, styles.numeroCero]}>{c.valor}</Text>
              <View style={styles.filaVisto} />
            </View>
          );
        }

        const clave = `${claveBase}:${c.id}`;
        const marcada = marcas.has(clave);

        return (
          <Pressable
            key={c.id}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: marcada }}
            accessibilityLabel={
              marcada
                ? `${c.rotulo}, ${c.valor} de ${nombre}. Tomado`
                : `${c.rotulo}, ${c.valor} de ${nombre}. Tocar para marcar que la tomó`
            }
            onPress={() => onAlternar(clave)}
            style={({ pressed }) => [
              styles.columna,
              styles.columnaTocable,
              marcada ? styles.columnaMarcada : null,
              pressed ? styles.columnaPresionada : null,
              conBorde,
            ]}>
            <Text style={[styles.rotulo, marcada ? styles.rotuloMarcado : null]}>{c.rotulo}</Text>
            <Text style={styles.numero}>{c.valor}</Text>
            <View style={styles.filaVisto}>
              {marcada ? <Text style={styles.visto}>✓</Text> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

// Los estilos de tarjeta son compartidos entre hábitos y remedios a propósito:
// si alguien cambia uno solo, las dos secciones dejan de pesar igual.
const styles = StyleSheet.create({
  vacio: {
    fontSize: type.body,
    color: color.inkMuted,
    lineHeight: type.body * 1.45,
  },
  encabezado: {
    fontSize: type.heading,
    fontWeight: '600',
    color: color.ink,
  },
  secundario: {
    fontSize: type.body,
    color: color.inkMuted,
    marginTop: 2,
    lineHeight: type.body * 1.4,
  },
  destacado: {
    fontSize: type.body,
    color: color.ink,
    marginTop: space.sm,
    fontWeight: '600',
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
    // 58 pt es el piso de un objetivo táctil en esta app. La casilla vacía lo
    // respeta también, para que las tres columnas queden alineadas.
    minHeight: touch.minHeight,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space.sm,
  },
  // Blanco: se lee como superficie presionable frente al fondo de la grilla.
  columnaTocable: {
    backgroundColor: color.surface,
  },
  columnaMarcada: {
    backgroundColor: color.okBg,
  },
  columnaPresionada: {
    backgroundColor: color.line,
  },
  // Plana y sin fondo propio: nada que tomar, nada que marcar.
  columnaVacia: {
    backgroundColor: color.bg,
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
  rotuloMarcado: {
    color: color.ok,
    fontWeight: '600',
  },
  // El número es la dosis indicada. No cambia nunca al marcar.
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
  // Altura fija aunque esté vacía: así las columnas no se desalinean cuando
  // una queda marcada y otra no.
  filaVisto: {
    height: 22,
    justifyContent: 'center',
  },
  visto: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
    color: color.ok,
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
  aclaracion: {
    marginTop: space.md,
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
