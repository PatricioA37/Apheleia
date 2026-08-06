/**
 * Signos de alarma — qué debe hacer consultar de inmediato.
 *
 * Vive en el front a propósito y NO viaja por red. Esta es la pantalla a la
 * que uno corre: hacerla depender de la API significaría que justo cuando más
 * importa puede aparecer vacía.
 *
 * ⚠️ CONTENIDO CLÍNICO. Corresponde a PD-05 (Joaquín) y hoy son ejemplos.
 * El agente nunca interpreta un síntoma: esta pantalla informa y deriva.
 */
export const SIGNOS_ALARMA: string[] = [
  'Dolor en el pecho.',
  'Dificultad para respirar.',
  'Pérdida de fuerza o dificultad para hablar.',
  'Fiebre alta que no cede.',
  'Cualquier cosa distinta a lo que su equipo le dijo que esperara.',
];
