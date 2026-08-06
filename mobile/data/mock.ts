/**
 * Datos de ejemplo — 100% sintéticos, cero PII.
 *
 * La FORMA sigue `lib/contratos.ts`, que a su vez sigue
 * `specs/001-continuidad-cuidado/contracts/tools.md`. El contenido es inventado.
 *
 * Los nombres de medicamentos y condiciones salen del catálogo de
 * `src/data/seed_sintetico.py`, para que la demo sea coherente con el backend.
 *
 * ⚠️ El contenido clínico de `planesMock` es MOCK sin validación profesional
 * (pendiente PD-03, Joaquín). Se declara como tal en pantalla.
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
 * Se incluyen los dos casos a propósito: dos medicamentos con posología de tres
 * tomas (grilla) y uno con frecuencia libre (solo texto). Así la pantalla
 * ejercita ambos caminos sin depender del backend.
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
    frecuencia: 'cada 8 h',
    tomas: null,
    recomendacion: 'Tómela siempre a la misma hora.',
  },
];

export const controlesMock: Control[] = [
  {
    id: 'c1',
    fecha: '2026-08-14T10:00:00-04:00',
    titulo: 'Próximo control',
    detalle: 'Presencial · CESFAM',
    proximo: true,
  },
  { id: 'c2', fecha: '2026-07-18T09:30:00-04:00', titulo: 'Control integral', detalle: 'Presencial · se revisó su plan' },
  { id: 'c3', fecha: '2026-07-02T11:00:00-04:00', titulo: 'Seguimiento a distancia', detalle: 'Telefónico · dupla gestora' },
  { id: 'c4', fecha: '2026-06-05T09:00:00-04:00', titulo: 'Control integral', detalle: 'Presencial · CESFAM' },
];

export const planesMock: PlanCarril[] = [
  {
    aplica_a: 'cronico',
    titulo: 'Plan de gestión de enfermedad — riesgo moderado (MOCK)',
    contenido:
      'Mantener su condición controlada, con seguimiento más seguido. Tomar sus ' +
      'remedios todos los días a la misma hora, asistir al control programado, y ' +
      'avisar a su equipo de salud si aparece algo distinto a lo esperado.',
    fuente: 'MOCK — pendiente validación profesional',
    version: 'mock-0.1',
    validado: false,
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
