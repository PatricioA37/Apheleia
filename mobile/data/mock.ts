/**
 * Datos de ejemplo — 100% sintéticos, cero PII.
 *
 * La FORMA sigue `lib/contratos.ts`, que a su vez sigue
 * `specs/001-continuidad-cuidado/contracts/tools.md`. El contenido es inventado.
 *
 * Los nombres de medicamentos y condiciones salen del catálogo de
 * `src/data/seed_sintetico.py`, para que la demo sea coherente con el backend.
 *
 * El contenido clínico lo validó Joaquín (médico del equipo) el 6 de agosto de
 * 2026, por eso `validado: true`. Si el backend real llegara a mandar contenido
 * sin validar, la pantalla sigue sabiendo declararlo: el aviso depende del flag,
 * no de estos datos.
 */

import type { Aviso, Control, Medicamento, Perfil, PlanCarril } from '@/lib/contratos';

export const perfilMock: Perfil = {
  pseudonym_id: 'demo-0001',
  grupo_riesgo: 'G2',
  carril: 'cronico',
  origen_agudo: null,
  condiciones: ['Diabetes mellitus tipo 2', 'Hipertensión arterial', 'Dislipidemia'],
  resumen: 'Persona en seguimiento crónico, con controles al día.',
};

/**
 * Los tres vienen con posología en notación de tres tomas, para que las tres
 * tarjetas se vean y se marquen igual (decisión de Joaquín, 6 de agosto).
 *
 * Antes Atorvastatina traía `frecuencia: 'cada 8 h'` y `tomas: null`, puesto
 * por Patricio para ejercitar el camino sin grilla. Ese camino sigue existiendo
 * en la pantalla —si el backend manda `tomas: null` se muestra solo el texto—
 * pero ya no se ejercita con estos datos.
 */
export const medicamentosMock: Medicamento[] = [
  {
    id: 'm1',
    nombre: 'Metformina',
    dosis: '850 mg',
    frecuencia: '1-0-1',
    tomas: { manana: 1, mediodia: 0, noche: 1 },
    recomendacion: 'Acompañe con actividad física regular.',
  },
  {
    id: 'm2',
    nombre: 'Losartán',
    dosis: '50 mg',
    frecuencia: '1-0-0',
    tomas: { manana: 1, mediodia: 0, noche: 0 },
    recomendacion: 'Modere la sal en sus comidas.',
  },
  {
    id: 'm3',
    nombre: 'Atorvastatina',
    dosis: '20 mg',
    // Las estatinas suelen indicarse una vez al día, en la noche.
    frecuencia: '0-0-1',
    tomas: { manana: 0, mediodia: 0, noche: 1 },
    recomendacion: 'Tómela siempre a la misma hora.',
  },
];

/**
 * Controles — no son ejemplos sueltos: cada uno sale de lo que le corresponde
 * a esta persona por su grupo **G2** y por los programas en que está inscrita.
 *
 * La correspondencia con `data/grupos-riesgo.ts` y `data/programas.ts`:
 *
 * | Actividad del plan                  | Cada cuánto        | Acá |
 * |-------------------------------------|--------------------|-----|
 * | Control de patologías crónicas      | Cada 6 meses       | mar · sep |
 * | Taller de manejo de patologías      | Dos veces al año   | mar · sep |
 * | Taller preventivo                   | Una vez al año     | nov |
 * | Exámenes de laboratorio             | Una vez al año     | ago |
 * | Control Salud Cardiovascular        | Por programa       | abr · oct |
 *
 * Si Joaquín cambia una frecuencia en `grupos-riesgo.ts`, estas fechas hay que
 * moverlas a mano: hoy no hay nada que las genere, es un calendario escrito.
 */
export const controlesMock: Control[] = [
  {
    id: 'c1',
    fecha: '2026-08-18T08:00:00-04:00',
    titulo: 'Exámenes de laboratorio',
    detalle: 'Le corresponden una vez al año · Venga en ayunas · CESFAM',
    proximo: true,
  },
  {
    id: 'c2',
    fecha: '2026-09-02T10:30:00-04:00',
    titulo: 'Control de sus patologías crónicas',
    detalle: 'Cada 6 meses por su grupo de cuidado · Presencial · CESFAM',
  },
  {
    id: 'c3',
    fecha: '2026-09-24T15:00:00-04:00',
    titulo: 'Taller de manejo de patologías crónicas',
    detalle: 'Dos veces al año por su grupo de cuidado · Presencial · CESFAM',
  },
  {
    id: 'c4',
    fecha: '2026-10-14T11:00:00-04:00',
    titulo: 'Control de salud cardiovascular',
    detalle: 'Programa de Salud Cardiovascular · Presencial · CESFAM',
  },
  {
    id: 'c5',
    fecha: '2026-11-12T15:00:00-04:00',
    titulo: 'Taller preventivo',
    detalle: 'Una vez al año por su grupo de cuidado · Presencial · CESFAM',
  },
  {
    id: 'c6',
    fecha: '2026-04-15T11:30:00-04:00',
    titulo: 'Control de salud cardiovascular',
    detalle: 'Programa de Salud Cardiovascular · Presencial · CESFAM',
  },
  {
    id: 'c7',
    fecha: '2026-03-19T15:00:00-04:00',
    titulo: 'Taller de manejo de patologías crónicas',
    detalle: 'Dos veces al año por su grupo de cuidado · Presencial · CESFAM',
  },
  {
    id: 'c8',
    fecha: '2026-03-04T10:00:00-04:00',
    titulo: 'Control de sus patologías crónicas',
    detalle: 'Cada 6 meses por su grupo de cuidado · Presencial · CESFAM',
  },
];

export const planesMock: PlanCarril[] = [
  {
    aplica_a: 'cronico',
    titulo: 'Plan de gestión de enfermedad — riesgo moderado',
    contenido:
      'Mantener sus condiciones controladas, con seguimiento más seguido. El ' +
      'movimiento diario, la alimentación y bajar la sal son parte del tratamiento ' +
      'y pesan tanto como los remedios: no son un consejo aparte. Junto con eso, ' +
      'tomar sus remedios todos los días a la misma hora, asistir a los controles ' +
      'programados y avisar a su equipo de salud si aparece algo distinto a lo ' +
      'esperado.',
    fuente: 'Validado por su equipo de salud',
    version: '1.0',
    validado: true,
  },
];

/**
 * Avisos que el sistema envió al equipo de salud sobre esta persona.
 *
 * El `motivo` cita el criterio que lo gatilló, nunca interpreta ni diagnostica.
 * Y ningún aviso es un reproche: el sistema acompaña, no fiscaliza.
 *
 * `revisado` refleja que un humano lo validó — una alerta no se cierra sola.
 */
export const avisosMock: Aviso[] = [
  { id: 'a1', fecha: '2026-08-06T09:14:00-04:00', motivo: 'Usted contó que le dolía el pecho.', revisado: false },
  { id: 'a2', fecha: '2026-07-28T16:20:00-04:00', motivo: 'Pasaron 15 días sin que conversáramos.', revisado: true },
  { id: 'a3', fecha: '2026-07-12T08:45:00-04:00', motivo: 'No asistió al control programado.', revisado: true },
];
