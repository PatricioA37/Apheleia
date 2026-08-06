/**
 * Programas de salud en los que participa la persona — dato LOCAL, ejemplo
 * visual. Igual que `habitos.ts`, `patologias.ts` y `signos-alarma.ts`.
 *
 * No está en el contrato: `GET /api/paciente/{id}/perfil` devuelve carril,
 * tramo, condiciones y resumen, pero no los programas. Va al registro de
 * disonancias.
 *
 * Ojo con la diferencia: el **grupo** (G0–G3) describe cuánto acompañamiento
 * necesita la persona; los **programas** son de qué está inscrita en su centro
 * de salud. Son dos cosas distintas y por eso van en bloques separados.
 *
 * Estos dos calzan con las condiciones del ejemplo —diabetes, hipertensión y
 * dislipidemia son el trío clásico del programa cardiovascular—. Otros
 * programas del sistema, como salud mental o enfermo respiratorio crónico,
 * existen pero NO corresponden a este paciente: agregárselos sería decir que
 * tiene condiciones que no tiene.
 */

export const programas: string[] = ['Programa de Salud Cardiovascular', 'ECICEP'];
