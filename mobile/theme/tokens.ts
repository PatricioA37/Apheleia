/**
 * Tokens de diseño de Apheleia — app del paciente.
 *
 * Paleta fija y clara a propósito. No hay modo oscuro: con la edad aumenta la
 * dispersión de luz dentro del ojo, y el texto claro sobre fondo oscuro produce
 * halación — peor aún con astigmatismo o catarata incipiente, frecuentes sobre
 * los 65 años.
 *
 * Contraste objetivo: nivel alto (7:1 en cuerpo de texto), no el mínimo.
 */

export const color = {
  bg: '#F5F7F9',        // fondo de pantalla, blanco apenas frío
  surface: '#FFFFFF',   // tarjetas y burbujas
  ink: '#15181C',       // texto principal
  inkMuted: '#454D57',  // texto secundario — oscuro, nunca gris claro
  line: '#CFD5DB',      // bordes visibles de verdad

  accent: '#0F4C81',        // única acción primaria
  accentPressed: '#0B3A63',
  onAccent: '#FFFFFF',

  // Estados. Cada uno se acompaña SIEMPRE de texto y de una forma distinta:
  // el color nunca es el único indicador.
  ok: '#14603C',
  okBg: '#E1F1E8',
  warn: '#7A4E00',
  warnBg: '#FBEDD2',
  alarm: '#93211A',
  alarmBg: '#FCE1DF',
} as const;

export const space = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 22,
  xl: 32,
} as const;

export const radius = {
  card: 14,
  button: 14,
  pill: 999,
} as const;

/**
 * Escala tipográfica.
 *
 * Son tamaños base: NO se desactiva el escalado del sistema. Muchos adultos
 * mayores ya tienen el teléfono configurado con letra grande, y fijar el
 * tamaño les pisaría ese ajuste. El diseño debe sobrevivir a que suban la letra.
 */
export const type = {
  title: 30,
  heading: 23,
  body: 19,
  button: 20,
  label: 16,
} as const;

/** Alto mínimo de un objetivo táctil. Apple recomienda 44 pt como mínimo;
 *  apuntamos más arriba por temblor, artrosis y menor precisión motora. */
export const touch = {
  minHeight: 58,
  gap: 12,
} as const;
