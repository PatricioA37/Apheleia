import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Bajada, Fuente, Pantalla, Tarjeta, Titulo } from '@/components/apheleia';
import { Cargando, ErrorCarga } from '@/components/estado';
import { gruposRiesgo } from '@/data/grupos-riesgo';
import { perfilMock, planesMock } from '@/data/mock';
import { patologias } from '@/data/patologias';
import { programas } from '@/data/programas';
import { useRecurso } from '@/hooks/use-recurso';
import { obtenerPerfil, obtenerPlan } from '@/lib/api';
import { PACIENTE_ID } from '@/lib/config';
import { FUENTE_PLAN, type GrupoRiesgo } from '@/lib/contratos';
import { color, radius, space, type } from '@/theme/tokens';

/**
 * Plan de Salud Integral — la versión digital del plan de cuidados consensuado.
 *
 * El Marco Operativo ECICEP 2025 ya define este plan como el objeto central del
 * modelo, dice que debe compartirse con la persona y servirle de bitácora — y
 * hoy eso es un carné de papel (p. 51). Esta pantalla es ese carné.
 *
 * El contenido proviene de la biblioteca validada por el profesional, nunca de
 * generación libre del modelo (Principio IV: cita o di no sé). Un paciente en
 * carril `dual` recibe DOS planes y se muestran separados, sin mezclarlos.
 */
/**
 * Referencia estable del plan de ejemplo. Se define fuera del componente para
 * que la comparación por identidad de abajo funcione entre renders.
 */
const PLAN_EJEMPLO = { planes: planesMock };

/** 501 = el backend no expone el endpoint todavía. Cualquier otro error se
 *  propaga, para que una caída real de red se vea como caída y no como dato. */
function noImplementado(e: unknown): boolean {
  return e instanceof Error && e.message.includes('HTTP 501');
}

export default function Plan() {
  const cargar = useCallback(
    () =>
      obtenerPlan(PACIENTE_ID).catch((e: unknown) => {
        if (noImplementado(e)) return PLAN_EJEMPLO;
        throw e;
      }),
    []
  );
  const { datos, cargando, error, recargar } = useRecurso(cargar);

  // El perfil se pide aparte y falla aparte: si el grupo de riesgo no carga, el
  // plan igual se muestra. Son dos endpoints distintos del contrato.
  const cargarPerfil = useCallback(
    () =>
      obtenerPerfil(PACIENTE_ID).catch((e: unknown) => {
        if (noImplementado(e)) return perfilMock;
        throw e;
      }),
    []
  );
  const { datos: perfil } = useRecurso(cargarPerfil);

  const esEjemplo = datos === PLAN_EJEMPLO || perfil === perfilMock;
  const planes = datos?.planes ?? [];
  const hayNoValidado = planes.some((p) => !p.validado);

  return (
    <Pantalla>
      <Titulo>Plan de Salud Integral</Titulo>
      <Bajada>Lo que acordó con su equipo de salud</Bajada>

      {/* Primero las condiciones: son el punto de partida del plan. Todo lo que
          viene después —el grupo, las actividades, las horas— se explica por
          ellas. */}
      <TarjetaCondiciones />

      {perfil ? <TarjetaGrupo grupo={perfil.grupo_riesgo} /> : null}

      {cargando ? <Cargando que="su plan" /> : null}
      {error ? <ErrorCarga onReintentar={recargar} /> : null}

      {datos && planes.length === 0 ? (
        <Tarjeta>
          <Text style={styles.detalle}>
            Su plan todavía no está disponible. Su equipo de salud lo definirá en su
            próximo control.
          </Text>
        </Tarjeta>
      ) : null}

      {planes.map((p) => (
        <Tarjeta key={`${p.aplica_a ?? 'ambos'}-${p.titulo}`}>
          <Text style={styles.titulo}>{p.titulo}</Text>
          <Text style={styles.detalle}>{p.contenido}</Text>
          <Text style={styles.origen}>{p.fuente}</Text>
        </Tarjeta>
      ))}

      {esEjemplo ? (
        <Fuente>
          Plan de ejemplo — su equipo de salud aún no publica el suyo. Lo que ve acá no
          reemplaza lo que le indicaron en su control.
        </Fuente>
      ) : null}

      {hayNoValidado ? <Fuente>{FUENTE_PLAN}</Fuente> : null}
    </Pantalla>
  );
}

/**
 * Sus condiciones de salud, con el código CIE-10 de cada una.
 *
 * El código va en segundo plano y el nombre en primero: la persona lee
 * «Diabetes mellitus tipo 2», no «E11.9». Pero el código está porque es suyo y
 * porque le sirve cuando trata con el sistema —una derivación, una licencia,
 * otro centro de salud—, y la Ley 20.584 le da derecho a su información.
 *
 * No es un diagnóstico que haga la app: es el que ya le hizo su equipo.
 */
function TarjetaCondiciones() {
  return (
    <Tarjeta>
      <Text style={styles.rotuloGrupo}>Sus condiciones de salud</Text>

      {patologias.map((p) => (
        <View key={p.id} style={styles.item}>
          <View style={styles.filaCondicion}>
            <Text style={styles.condicionNombre}>{p.nombre}</Text>
            <View style={styles.cie} accessible accessibilityLabel={`Código CIE 10: ${p.cie10}`}>
              <Text style={styles.cieTexto}>{p.cie10}</Text>
            </View>
          </View>
        </View>
      ))}

      <Text style={styles.criterio}>
        CIE-10 es la clasificación internacional con que su equipo de salud registra
        cada condición. Sirve para que cualquier profesional que lo atienda entienda lo
        mismo.
      </Text>
    </Tarjeta>
  );
}

/**
 * Grupo de cuidado ECICEP.
 *
 * El código viene del backend; el significado sale de `data/grupos-riesgo.ts`.
 *
 * Dos decisiones que sostienen esta tarjeta:
 *
 *  - **Nunca se muestra «G2» solo.** Es jerga: a alguien de 70 años no le dice
 *    nada. Siempre va con el nombre de la modalidad y con una frase que explica
 *    qué implica para él.
 *  - **Todos los grupos usan el mismo azul.** Pintar G3 de rojo y G0 de verde
 *    le diría a la persona que está en el grupo malo. El grupo describe cuánto
 *    acompañamiento necesita, no qué tan enferma está.
 */
function TarjetaGrupo({ grupo }: { grupo: GrupoRiesgo }) {
  const d = gruposRiesgo[grupo];

  return (
    <Tarjeta>
      <Text style={styles.rotuloGrupo}>Su grupo de cuidado</Text>

      <View style={styles.filaGrupo}>
        <View style={styles.codigo} accessible accessibilityLabel={`Grupo ${grupo}`}>
          <Text style={styles.codigoTexto}>{grupo}</Text>
        </View>
        <Text style={styles.modalidad}>{d.modalidad}</Text>
      </View>

      <Text style={styles.significa}>{d.queSignifica}</Text>

      {/* Lo que le corresponde por su grupo. Si la lista viene vacía el bloque
          no se dibuja: mejor no decir nada que prometer una prestación que
          nadie confirmó. */}
      {d.actividades.length > 0 ? (
        <>
          <Text style={styles.subtitulo}>Lo que le corresponde</Text>
          {d.actividades.map((a) => (
            <View key={a.que} style={styles.item}>
              <Text style={styles.itemNombre}>{a.que}</Text>
              <Text style={styles.itemPauta}>{a.cuando}</Text>
            </View>
          ))}
        </>
      ) : null}

      {/* Los programas son otra cosa que el grupo: de qué está inscrito en su
          centro de salud, no cuánto acompañamiento necesita. */}
      {programas.length > 0 ? (
        <>
          <Text style={styles.subtitulo}>Programas en los que participa</Text>
          <View style={styles.programas}>
            {programas.map((p) => (
              <View key={p} style={styles.programa}>
                <Text style={styles.programaTexto}>{p}</Text>
              </View>
            ))}
          </View>
        </>
      ) : null}

      {/* Quién lo asignó y con qué criterio. El sistema no clasifica a nadie. */}
      <Text style={styles.criterio}>
        {d.criterio} · Lo definió su equipo de salud según el criterio del programa ECICEP
        del Ministerio de Salud.
      </Text>
    </Tarjeta>
  );
}

const styles = StyleSheet.create({
  rotuloGrupo: {
    fontSize: type.label,
    color: color.inkMuted,
    fontWeight: '600',
  },
  filaGrupo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: space.sm,
  },
  codigo: {
    minWidth: 54,
    paddingVertical: space.xs,
    paddingHorizontal: space.sm,
    borderRadius: radius.card - 6,
    backgroundColor: color.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: space.sm,
  },
  codigoTexto: {
    fontSize: type.heading,
    fontWeight: '700',
    color: color.onAccent,
  },
  modalidad: {
    // Envuelve en vez de salirse si la persona subió el tamaño de letra.
    flex: 1,
    fontSize: type.heading,
    fontWeight: '600',
    color: color.ink,
  },
  significa: {
    fontSize: type.body,
    color: color.ink,
    marginTop: space.md,
    lineHeight: type.body * 1.45,
  },
  subtitulo: {
    fontSize: type.body,
    fontWeight: '700',
    color: color.ink,
    marginTop: space.md,
    marginBottom: space.xs,
  },
  // Mismos estilos que las listas de Seguimiento, para que la app se lea igual
  // en las dos pantallas.
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
  filaCondicion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  condicionNombre: {
    // El nombre manda y envuelve; el código se queda del tamaño que necesita.
    flex: 1,
    fontSize: type.body,
    fontWeight: '600',
    color: color.ink,
    lineHeight: type.body * 1.35,
  },
  cie: {
    paddingVertical: 3,
    paddingHorizontal: space.sm,
    borderRadius: radius.card - 8,
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: color.bg,
  },
  cieTexto: {
    fontSize: type.label - 1,
    fontWeight: '700',
    color: color.inkMuted,
  },
  programas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.xs,
  },
  programa: {
    paddingVertical: space.xs,
    paddingHorizontal: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: color.bg,
  },
  programaTexto: {
    fontSize: type.label,
    fontWeight: '600',
    color: color.ink,
  },
  criterio: {
    fontSize: type.label - 2,
    color: color.inkMuted,
    marginTop: space.sm,
    lineHeight: (type.label - 2) * 1.4,
  },
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
  // Ya no es una advertencia sino una cita de procedencia, así que va en tono
  // neutro. El ámbar quedaría diciendo «cuidado» sobre contenido validado.
  origen: {
    fontSize: type.label - 2,
    color: color.inkMuted,
    marginTop: 8,
    fontWeight: '600',
  },
});
