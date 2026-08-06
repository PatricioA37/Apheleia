/**
 * Qué significa cada grupo de riesgo ECICEP, en palabras que se entienden.
 *
 * El grupo (`G0`–`G3`) NO se calcula acá: viene del backend en
 * `GET /api/paciente/{id}/perfil`. Esta tabla solo traduce el código a algo
 * legible para la persona.
 *
 * La modalidad y el criterio están copiados de `src/core/estratificacion.py`,
 * que a su vez cita el **Marco Operativo ECICEP 2025 (MINSAL), Figura 5**. Si
 * allá cambian, acá hay que cambiarlos: son la misma verdad escrita dos veces,
 * y eso está anotado en el registro de disonancias.
 *
 * Los textos de «qué significa» los validó Joaquín (médico del equipo) el 6 de
 * agosto de 2026. Descriptivos a propósito: dicen por qué su equipo lo acompaña
 * como lo acompaña, sin pronóstico y sin sugerir que un grupo sea peor que otro.
 */

import type { GrupoRiesgo } from '@/lib/contratos';

/** Prestación que le corresponde a la persona por el grupo en que está. */
export type Actividad = {
  que: string;
  /** Cada cuánto le toca. En palabras, no en números sueltos. */
  cuando: string;
};

export type DescripcionGrupo = {
  /** Nombre oficial de la modalidad ECICEP. */
  modalidad: string;
  /** Criterio con que se asigna, tal como lo aplica el backend. */
  criterio: string;
  /** Qué implica para la persona, en lenguaje corriente. */
  queSignifica: string;
  /**
   * Lo que le corresponde por estar en este grupo.
   *
   * Solo G2 está definido: lo dictó Joaquín el 6 de agosto. Los otros tres
   * quedan vacíos a propósito — inventar una frecuencia de controles sería
   * prometerle a alguien una prestación que nadie confirmó. La tarjeta no
   * dibuja el bloque cuando la lista está vacía.
   */
  actividades: Actividad[];
};

export const gruposRiesgo: Record<GrupoRiesgo, DescripcionGrupo> = {
  G0: {
    modalidad: 'Prevención y promoción',
    criterio: 'Sin condiciones crónicas detectadas',
    queSignifica:
      'Por ahora no se le ha detectado una condición crónica. Su equipo lo acompaña ' +
      'para que siga así.',
    actividades: [],
  },
  G1: {
    modalidad: 'Automanejo apoyado',
    criterio: '1 condición crónica',
    queSignifica:
      'Vive con una condición crónica. Su equipo lo apoya para que usted mismo pueda ' +
      'manejarla en el día a día.',
    actividades: [],
  },
  G2: {
    modalidad: 'Gestión de enfermedad',
    criterio: '2 a 4 condiciones crónicas',
    queSignifica:
      'Vive con dos a cuatro condiciones crónicas a la vez. Por eso su equipo lo ' +
      'acompaña de cerca y sus controles son más seguidos.',
    actividades: [
      { que: 'Control de sus patologías crónicas', cuando: 'Cada 6 meses' },
      { que: 'Taller de manejo de patologías crónicas', cuando: 'Dos veces al año' },
      { que: 'Taller preventivo', cuando: 'Una vez al año' },
      { que: 'Exámenes de laboratorio', cuando: 'Una vez al año' },
    ],
  },
  G3: {
    modalidad: 'Gestión de caso',
    criterio: '5 o más condiciones crónicas',
    queSignifica:
      'Vive con cinco o más condiciones crónicas. Su equipo le asigna un seguimiento ' +
      'más cercano y alguien a cargo de coordinar su cuidado.',
    actividades: [],
  },
};
