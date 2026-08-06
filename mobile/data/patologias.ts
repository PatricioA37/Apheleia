/**
 * Patologías del paciente — dato LOCAL, igual que `habitos.ts` y
 * `signos-alarma.ts`. Ejemplo visual, sin backend.
 *
 * No pasa por `lib/api.ts` ni por `lib/contratos.ts`: el contrato no define
 * hoy ni el texto educativo de una condición ni el estado por patología.
 *
 * Los medicamentos NO se repiten acá. Se referencian por su `id` contra
 * `medicamentosMock`, que es la misma fuente que usa la pantalla de
 * Indicaciones. Así las dos pantallas no pueden decir cosas distintas del
 * mismo remedio.
 *
 * Los textos de «¿Qué es?» los validó Joaquín (médico del equipo) el 6 de
 * agosto de 2026. Están escritos de forma descriptiva a propósito: explican qué
 * pasa en el cuerpo, sin pronóstico, sin cifras y sin indicar tratamiento.
 *
 * Contexto ECICEP: estas personas tienen dos o más condiciones crónicas. La
 * pantalla asume varias, no una.
 */

export type Patologia = {
  id: string;
  nombre: string;
  /**
   * Código CIE-10 con que el equipo de salud registra la condición.
   *
   * ⚠️ El subcódigo depende del cuadro real de cada persona —E11.9 es diabetes
   * tipo 2 *sin complicaciones*, y con complicaciones cambia—. Estos tres son
   * los del caso de ejemplo y los debe confirmar Joaquín.
   */
  cie10: string;
  /** Palabra que ve el paciente. La asigna el profesional, no el sistema. */
  estado: string;
  /** Tono del distintivo. Que sea dato y no código permite cambiarlo sin tocar la pantalla. */
  tono: 'ok' | 'warn' | 'alarm';
  queEs: string;
  /**
   * `id` de `habitos`. Van primero en la tarjeta: son tan o más importantes
   * que el remedio, y un hábito sirve a varias condiciones a la vez —caminar
   * aparece en las tres, y eso no es repetición, es cómo funciona.
   */
  habitoIds: string[];
  /** `id` de `medicamentosMock`. Nunca el nombre: el nombre se lee de allá. */
  medicamentoIds: string[];
};

export const patologias: Patologia[] = [
  {
    id: 'p1',
    nombre: 'Diabetes mellitus tipo 2',
    cie10: 'E11.9',
    estado: 'Estable',
    tono: 'ok',
    queEs:
      'El azúcar de los alimentos le cuesta más entrar a las células y se queda ' +
      'en la sangre. Casi nunca duele ni se siente, y por eso su equipo la ' +
      'controla aunque usted se sienta bien.',
    habitoIds: ['h1', 'h3'],
    medicamentoIds: ['m1'],
  },
  {
    id: 'p2',
    nombre: 'Hipertensión arterial',
    cie10: 'I10',
    estado: 'Estable',
    tono: 'ok',
    queEs:
      'La sangre empuja con más fuerza de lo conveniente dentro de sus arterias. ' +
      'Tampoco se nota por fuera, y con el tiempo hace trabajar de más al corazón.',
    habitoIds: ['h2', 'h1'],
    medicamentoIds: ['m2'],
  },
  {
    id: 'p3',
    nombre: 'Dislipidemia',
    cie10: 'E78.5',
    estado: 'Estable',
    tono: 'ok',
    queEs:
      'Hay más grasa de la conveniente circulando en su sangre. No se ve ni se ' +
      'siente, y se cuida con la alimentación, el movimiento y su remedio.',
    habitoIds: ['h1'],
    medicamentoIds: ['m3'],
  },
];
