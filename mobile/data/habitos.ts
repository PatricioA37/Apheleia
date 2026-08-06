/**
 * Indicaciones de hábito — dato LOCAL, igual que `signos-alarma.ts`.
 *
 * No pasa por `lib/api.ts` ni por `lib/contratos.ts` a propósito: el contrato
 * del equipo no define hábitos todavía, y declarar una forma que el backend no
 * promete es exactamente lo que revienta el día de la integración.
 *
 * Cuando exista un endpoint acordado, esto se mueve a la capa de datos como el
 * resto. Hoy no.
 *
 * Contenido validado por Joaquín (médico del equipo) el 6 de agosto de 2026.
 *
 * Por decisión de Joaquín van a la par de los medicamentos, no debajo: están
 * redactadas como indicación —qué hacer y cada cuánto— y no como consejo
 * general, porque eso es lo que las hace comparables a una receta.
 */

export type Habito = {
  id: string;
  titulo: string;
  /** Cada cuánto. Ocupa el mismo lugar que `frecuencia` en un medicamento. */
  frecuencia: string;
  detalle?: string;
  recomendacion?: string;
};

export const habitos: Habito[] = [
  {
    id: 'h1',
    titulo: 'Caminar 30 minutos',
    frecuencia: 'La mayoría de los días',
    detalle: 'Puede repartirlo en dos caminatas de 15 minutos.',
    recomendacion: 'Si un día se cansa antes, camine menos. Lo que importa es no parar.',
  },
  {
    id: 'h2',
    titulo: 'Bajar la sal en las comidas',
    frecuencia: 'Todos los días',
    detalle: 'Cocinar sin sal y no llevar el salero a la mesa.',
    recomendacion: 'Puede reemplazarla por ajo, limón, orégano o comino.',
  },
  {
    id: 'h3',
    titulo: 'Tomar agua durante el día',
    frecuencia: 'Todos los días',
    detalle: 'Tenga un vaso o una botella a la vista.',
  },
];
