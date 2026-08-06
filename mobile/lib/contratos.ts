/**
 * Tipos derivados de `specs/001-continuidad-cuidado/contracts/tools.md`.
 *
 * Esta es la única definición de forma del front. Si un campo no está acá,
 * ninguna pantalla puede leerlo — y eso es a propósito: el compilador es lo
 * que impide que una pantalla dependa de algo que el backend no promete.
 */

export type Carril = 'agudo' | 'cronico' | 'dual';
export type GrupoRiesgo = 'G0' | 'G1' | 'G2' | 'G3';

export type Perfil = {
  pseudonym_id: string;
  grupo_riesgo: GrupoRiesgo;
  /** null = CARRIL_NO_ASIGNADO: el profesional aún no lo definió. */
  carril: Carril | null;
  origen_agudo: string | null;
  condiciones: string[];
  resumen: string;
};

/**
 * Tomas del día en notación de posología (`1-0-1`).
 * MVP: tres tomas, sin medias dosis. Decidido con Joaquín.
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
  /** Canónico: lo que dice la indicación del profesional. Siempre presente. */
  frecuencia: string;
  /**
   * Solo cuando la posología cabe en tres tomas. `null` para indicaciones
   * como «cada 8 h», que NO significan mañana/mediodía/noche. La grilla se
   * dibuja únicamente si esto viene poblado: inventar el horario sería
   * atribuirle al profesional algo que no indicó (Principio IV).
   */
  tomas: Tomas | null;
  recomendacion?: string;
};

export type Control = {
  id: string;
  /** ISO 8601. El formato legible lo produce `formatearFecha`. */
  fecha: string;
  titulo: string;
  detalle: string;
  proximo?: boolean;
};

/** Forma tomada de los chunks de `biblioteca_clinica`, no inventada. */
export type PlanCarril = {
  /** null = aplica a los dos carriles. */
  aplica_a: Carril | null;
  titulo: string;
  contenido: string;
  fuente: string;
  version: string;
  /** `validado_por !== null` en la biblioteca. Hoy siempre false (mock). */
  validado: boolean;
};

export type Aviso = {
  id: string;
  fecha: string;
  /** Cita del criterio que lo gatilló. Nunca interpretación ni diagnóstico. */
  motivo: string;
  /** Refleja validación humana: una alerta no se cierra sola (Principio II). */
  revisado: boolean;
};

export type Mensaje = {
  id: string;
  de: 'agente' | 'paciente';
  texto: string;
  fuente?: string;
  derivacion?: boolean;
  /** Respuestas de un toque. Evitan teclear, la barrera más grande. */
  respuestas?: string[];
};

export type RespuestaChat = {
  respuesta: string;
  fuente?: string;
  derivacion?: boolean;
  respuestas?: string[];
};

export interface ClienteApi {
  obtenerPerfil(id: string): Promise<Perfil>;
  obtenerMedicamentos(id: string): Promise<Medicamento[]>;
  obtenerControles(id: string): Promise<Control[]>;
  obtenerPlan(id: string): Promise<{ planes: PlanCarril[] }>;
  obtenerAvisos(id: string): Promise<Aviso[]>;
  enviarMensaje(id: string, texto: string): Promise<RespuestaChat>;
}

/** Sello obligatorio mientras el contenido no esté validado por un profesional. */
export const SELLO_VALIDAR = 'Ejemplo — Validar por médico';

export const FUENTE_PLAN = 'Contenido de ejemplo, pendiente de validación profesional.';

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

/**
 * Fecha legible en español de Chile. Si el valor no parsea, se devuelve tal
 * cual: mostrar la cadena cruda es preferible a mostrar "Invalid Date".
 */
export function formatearFecha(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('es-CL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(d);
}
