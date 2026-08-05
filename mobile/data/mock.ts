/**
 * Datos de ejemplo — 100% sintéticos, cero PII.
 *
 * La FORMA sigue `specs/001-continuidad-cuidado/contracts/tools.md`. El contenido
 * es inventado. Cuando existan los endpoints de Patricio se cambia la fuente de
 * datos y las pantallas no se tocan.
 *
 * Los nombres de medicamentos y condiciones salen del catálogo de
 * `src/data/seed_sintetico.py`, para que la demo sea coherente con el backend.
 *
 * ⚠️ El contenido clínico de `planCuidado` es MOCK sin validación profesional
 * (pendiente PD-03, Joaquín). Se declara como tal en pantalla.
 */

/**
 * Tomas del día en notación de posología (la de la receta médica).
 *
 * `1-0-1` = una en la mañana, ninguna al mediodía, una en la noche.
 *
 * MVP: tres tomas, decidido con Joaquín. Existe también el formato de cuatro
 * (agregando la toma antes de dormir) y las medias dosis (`½-0-½`); ninguno
 * entra ahora.
 *
 * ⚠️ Contrato: hoy `frecuencia` viaja como texto en
 * `/api/paciente/{id}/medicamentos`. Para dibujar esta grilla de forma confiable
 * debería ser un objeto estructurado. Pendiente de confirmar con Patricio.
 */
export type Tomas = {
  manana: number;
  mediodia: number;
  noche: number;
};

export type Medicamento = {
  id: string;
  nombre: string;
  dosis: string;
  tomas: Tomas;
  /**
   * Recomendación de acompañamiento del fármaco. Idea de Joaquín.
   *
   * ⚠️ Es CONTENIDO CLÍNICO: debe salir de la biblioteca validada por el
   * profesional, nunca de generación libre (Principio IV, cita o di no sé).
   * Los textos de abajo son ejemplos a reemplazar.
   *
   * Implica una categoría nueva en `biblioteca_clinica`, algo como
   * `recomendacion_farmaco`, indexada por medicamento. Pendiente con Patricio.
   */
  recomendacion?: string;
};

/** Sello obligatorio mientras el contenido no esté validado. */
export const SELLO_VALIDAR = 'Ejemplo — Validar por médico';

/** Traduce la notación a lenguaje corriente. El paciente ve las dos cosas. */
export function describirTomas(t: Tomas): string {
  const total = t.manana + t.mediodia + t.noche;
  if (total === 0) return 'Sin tomas indicadas';

  const veces =
    total === 1 ? 'Una vez al día' : total === 2 ? 'Dos veces al día' : `${total} veces al día`;

  const momentos: string[] = [];
  if (t.manana > 0) momentos.push('en la mañana');
  if (t.mediodia > 0) momentos.push('al mediodía');
  if (t.noche > 0) momentos.push('en la noche');

  // Con una sola toma vale la pena decir cuándo; con varias, la grilla ya lo muestra.
  return momentos.length === 1 ? `${veces}, ${momentos[0]}` : veces;
}

export type Control = {
  id: string;
  fecha: string;
  titulo: string;
  modalidad: string;
  proximo?: boolean;
};

export type ItemPlan = {
  id: string;
  titulo: string;
  detalle: string;
};

export type Mensaje = {
  id: string;
  de: 'agente' | 'paciente';
  texto: string;
  fuente?: string;
  derivacion?: boolean;
  /** Respuestas de un toque. Evitan teclear, que es la barrera más grande. */
  respuestas?: string[];
};

/**
 * Chequeo diario de adherencia.
 *
 * Lo pregunta el agente en la conversación, una vez al día, y se responde con un
 * toque. El paciente NO administra su lista de medicamentos (eso es del
 * profesional): solo reporta si los tomó. Son cosas distintas — la indicación es
 * clínica, la adherencia es la señal que alimenta el estado dinámico.
 *
 * ⚠️ Principio III, acompaña no fiscaliza: responder "no" nunca genera reproche.
 * El sistema ofrece apoyo y avisa al equipo; jamás atribuye culpa ni penaliza.
 */
export const PREGUNTA_DIARIA = '¿Tomó sus remedios hoy?';

export const RESPUESTAS_DIARIAS = ['Sí, todos', 'Algunos', 'No'];

/** Respuesta del agente a cada opción. Ninguna culpa al paciente. */
export const REPLICAS: Record<string, string> = {
  'Sí, todos': 'Qué bueno. Lo dejo anotado para su equipo de salud.',
  Algunos:
    'Gracias por contarme, me sirve saberlo. Si quiere, cuénteme cuál se le quedó y lo anoto.',
  No: 'Gracias por contarme. Le pasa a mucha gente y no es un problema. Le voy a avisar a su equipo para que lo acompañen.',
};

export const medicamentos: Medicamento[] = [
  {
    id: 'm1',
    nombre: 'Metformina',
    dosis: '850 mg',
    tomas: { manana: 1, mediodia: 0, noche: 1 },
    recomendacion: 'Acompañe con actividad física regular.',
  },
  {
    id: 'm2',
    nombre: 'Losartán',
    dosis: '50 mg',
    tomas: { manana: 1, mediodia: 0, noche: 0 },
    recomendacion: 'Modere la sal en sus comidas.',
  },
  {
    id: 'm3',
    nombre: 'Atorvastatina',
    dosis: '20 mg',
    tomas: { manana: 0, mediodia: 0, noche: 1 },
    recomendacion: 'Tómela siempre a la misma hora.',
  },
];

export const controles: Control[] = [
  { id: 'c1', fecha: 'Jueves 14 de agosto', titulo: 'Próximo control', modalidad: 'Presencial · CESFAM', proximo: true },
  { id: 'c2', fecha: '18 de julio', titulo: 'Control integral', modalidad: 'Presencial · se revisó su plan' },
  { id: 'c3', fecha: '2 de julio', titulo: 'Seguimiento a distancia', modalidad: 'Telefónico · dupla gestora' },
  { id: 'c4', fecha: '5 de junio', titulo: 'Control integral', modalidad: 'Presencial · CESFAM' },
];

export const planCuidado: ItemPlan[] = [
  { id: 'p1', titulo: 'Mi objetivo', detalle: 'Mantener mi condición controlada, con seguimiento más seguido.' },
  { id: 'p2', titulo: 'Mis remedios', detalle: 'Tomarlos todos los días, a la misma hora.' },
  { id: 'p3', titulo: 'Mis controles', detalle: 'Asistir al control programado.' },
  { id: 'p4', titulo: 'Cuándo pedir ayuda', detalle: 'Si aparece algo distinto a lo esperado, avisar a mi equipo de salud.' },
];

export const FUENTE_PLAN = 'Contenido de ejemplo · MOCK — pendiente de validación profesional';

export const conversacion: Mensaje[] = [
  { id: 'x0', de: 'agente', texto: PREGUNTA_DIARIA, respuestas: RESPUESTAS_DIARIAS },
  { id: 'x2', de: 'paciente', texto: 'Ando como cansado y se me olvidó el remedio dos veces' },
  {
    id: 'x3',
    de: 'agente',
    texto:
      'Gracias por contarme. Olvidar una dosis le pasa a mucha gente, no es un problema. Su plan sugiere tomarlo siempre a la misma hora.',
    fuente: 'Plan de cuidado · MOCK — pendiente de validación profesional',
  },
  { id: 'x4', de: 'paciente', texto: 'Me duele el pecho desde ayer' },
  {
    id: 'x5',
    de: 'agente',
    texto:
      'Eso necesita que lo vea un profesional ahora. Voy a avisar a su equipo de salud.',
    derivacion: true,
  },
];
