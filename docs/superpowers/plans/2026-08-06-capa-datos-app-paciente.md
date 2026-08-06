# Capa de datos de la app paciente — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que las siete pantallas de la app paciente consuman datos por una sola interfaz con dos adaptadores intercambiables (mock / HTTP), que el sitio se despliegue solo en Netlify, y que apuntar al backend sea cambiar una variable.

**Architecture:** `mobile/lib/contratos.ts` define los tipos derivados de `contracts/tools.md` y la interfaz `ClienteApi`. `cliente-mock.ts` y `cliente-http.ts` la implementan; `config.ts` elige cuál según `EXPO_PUBLIC_API_URL` y un override de runtime en web. `api.ts` reexporta el elegido y es lo único que importan las pantallas. El backend llega en la fase 3 sin tocar ninguna pantalla.

**Tech Stack:** Expo 54 · React Native 0.81.5 · React 19.1 · expo-router 6 · TypeScript 5.9 · FastAPI · supabase-py · pytest

**Spec:** `docs/superpowers/specs/2026-08-06-front-back-mock-design.md`

## Global Constraints

- **Idioma del código**: identificadores, comentarios y mensajes en español, como todo el repo.
- **Cero PII**: `pseudonym_id` es el único identificador. Ni nombre, ni RUT, ni contacto en ninguna capa del front.
- **`contracts/tools.md` es la fuente de verdad de forma.** Si un tipo no calza con el contrato, se arregla el tipo o se cambia el contrato explícitamente (tarea 18) — nunca se improvisa.
- **Nunca `git add -A`.** Agregar por archivo, como manda `docs/FLUJO-GIT.md:87`.
- **Trabajo directo en `master`** por decisión explícita de Patricio para este tramo, aunque `FLUJO-GIT.md:18` diga lo contrario. Commits chicos y frecuentes.
- **Ningún texto de error técnico llega a pantalla.** El usuario tiene 65+ años. `console.error` para el detalle.
- **El agente no inventa.** Si `/chat` falla, no se fabrica respuesta ni se cae a textos precocinados.
- **Sin runner de tests en `mobile/`.** El gate es `npx tsc --noEmit` + verificación manual. Es una decisión del spec, no un olvido: montar Jest a mitad de evento no se paga. El backend (fase 3) sí usa pytest, que ya está en el repo.

---

## Estructura de archivos

**Se crean:**

| Archivo | Responsabilidad |
|---|---|
| `mobile/lib/contratos.ts` | Tipos del contrato, `ClienteApi`, sellos, helpers de formato |
| `mobile/lib/config.ts` | Resuelve modo y URL; override de runtime en web |
| `mobile/lib/cliente-mock.ts` | Adaptador mock: latencia, interruptor de fallas, agente simulado |
| `mobile/lib/cliente-http.ts` | Adaptador HTTP contra `EXPO_PUBLIC_API_URL` |
| `mobile/lib/api.ts` | Superficie pública. Lo único que importan las pantallas |
| `mobile/hooks/use-recurso.ts` | `{ datos, cargando, error, recargar }` |
| `mobile/components/estado.tsx` | `<Cargando>` y `<ErrorCarga>` |
| `mobile/data/signos-alarma.ts` | Contenido clínico local, nunca por red |
| `netlify.toml` | Build del sitio desde `mobile/` |
| `src/api/app.py` | App FastAPI, CORS, arranque |
| `src/api/paciente.py` | Los seis endpoints `/api/paciente/*` |
| `src/api/formato.py` | `parsear_tomas`, mapeo de modalidades |
| `tests/test_formato_api.py` | Tests de `formato.py` |

**Se modifican:**

| Archivo | Cambio |
|---|---|
| `mobile/data/mock.ts` | Queda solo con datos crudos en la forma del contrato |
| `mobile/app/medicamentos.tsx` | Consume `api.ts`; grilla condicional |
| `mobile/app/controles.tsx` | Consume `api.ts` |
| `mobile/app/plan.tsx` | Consume `api.ts` |
| `mobile/app/alertas.tsx` | Avisos por API; bloque de emergencia siempre local |
| `mobile/app/chat.tsx` | Consume `api.ts`; sin fallback inventado |
| `mobile/app/configuracion.tsx` | Indicador de modo y fuente |
| `src/data/loader.py` | Siembra más controles y alertas clínicas |
| `specs/001-continuidad-cuidado/contracts/tools.md` | Cuatro cambios de contrato |

---

# FASE 1 — Capa de datos

### Task 1: Tipos del contrato

**Files:**
- Create: `mobile/lib/contratos.ts`

**Interfaces:**
- Consumes: nada (primera tarea).
- Produces: `Carril`, `GrupoRiesgo`, `Tomas`, `Perfil`, `Medicamento`, `Control`, `PlanCarril`, `Aviso`, `Mensaje`, `RespuestaChat`, `ClienteApi`, `SELLO_VALIDAR`, `FUENTE_PLAN`, `describirTomas()`, `formatearFecha()`.

- [ ] **Step 1: Crear el archivo de tipos**

```ts
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

export const FUENTE_PLAN = 'Contenido de ejemplo · MOCK — pendiente de validación profesional';

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
```

- [ ] **Step 2: Verificar que compila**

Run: `cd mobile && npx tsc --noEmit`
Expected: PASS. `data/mock.ts` todavía define sus propios tipos y aún nadie importa `contratos.ts`, así que no hay conflicto.

- [ ] **Step 3: Commit**

```bash
git add mobile/lib/contratos.ts
git commit -m "front: tipos del contrato en lib/contratos.ts"
```

---

### Task 2: Datos crudos en la forma del contrato

**Files:**
- Modify: `mobile/data/mock.ts` (reescritura completa)
- Create: `mobile/data/signos-alarma.ts`

**Interfaces:**
- Consumes: `Medicamento`, `Control`, `PlanCarril`, `Aviso`, `Perfil` de `lib/contratos.ts`.
- Produces: `perfilMock`, `medicamentosMock`, `controlesMock`, `planesMock`, `avisosMock` (de `data/mock.ts`); `SIGNOS_ALARMA` (de `data/signos-alarma.ts`).

**Nota:** `describirTomas`, `SELLO_VALIDAR` y `FUENTE_PLAN` ya no viven acá — se movieron a `contratos.ts` en la tarea 1. `REPLICAS`, `PREGUNTA_DIARIA`, `RESPUESTAS_DIARIAS` y `conversacion` se van a `cliente-mock.ts` en la tarea 4.

- [ ] **Step 1: Reescribir `data/mock.ts`**

```ts
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
```

- [ ] **Step 2: Crear `data/signos-alarma.ts`**

```ts
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
```

- [ ] **Step 3: Verificar que falla como se espera**

Run: `cd mobile && npx tsc --noEmit`
Expected: FAIL. Las cinco pantallas todavía importan `medicamentos`, `controles`, `planCuidado`, `avisos`, `signosAlarma`, `describirTomas`, `SELLO_VALIDAR`, `FUENTE_PLAN` y los tipos `Tomas` / `Mensaje` desde `@/data/mock`, y ya no existen ahí. Los errores esperados son `TS2305` («has no exported member») en `medicamentos.tsx`, `controles.tsx`, `plan.tsx`, `alertas.tsx` y `chat.tsx`.

Esto es el gate haciendo su trabajo: nada se puede dar por migrado hasta que las tareas 7–11 lo arreglen. **No arreglar las pantallas todavía.**

- [ ] **Step 4: Commit**

```bash
git add mobile/data/mock.ts mobile/data/signos-alarma.ts
git commit -m "front: datos mock en la forma del contrato; signos de alarma aparte"
```

---

### Task 3: Resolución de modo y URL

**Files:**
- Create: `mobile/lib/config.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `API_URL: string | null`, `PACIENTE_ID: string`, `MODO: 'mock' | 'http'`, `describirFuente(): string`.

- [ ] **Step 1: Crear `lib/config.ts`**

```ts
/**
 * Decide de dónde salen los datos.
 *
 * Expo INLINEA `process.env.EXPO_PUBLIC_*` en tiempo de build. En un sitio
 * estático (Netlify) eso significa que volver a mock exigiría un rebuild
 * completo — inaceptable en medio de una demo. Por eso en web se admite un
 * override de runtime: `?fuente=mock` en la URL, persistido en localStorage.
 *
 * Orden de resolución:
 *   1. override de runtime (solo web)
 *   2. EXPO_PUBLIC_API_URL inlineado en el build
 *   3. sin ninguno de los dos: mock
 */
import { Platform } from 'react-native';

const CLAVE_OVERRIDE = 'apheleia_fuente';

type Override = 'mock' | 'api';

function leerOverrideWeb(): Override | null {
  if (Platform.OS !== 'web') return null;

  try {
    const pedido = new URLSearchParams(window.location.search).get('fuente');
    if (pedido === 'mock' || pedido === 'api') {
      window.localStorage.setItem(CLAVE_OVERRIDE, pedido);
      return pedido;
    }

    const guardado = window.localStorage.getItem(CLAVE_OVERRIDE);
    if (guardado === 'mock' || guardado === 'api') return guardado;
  } catch {
    // localStorage bloqueado (navegación privada, cookies desactivadas).
    // No es un error: se sigue con lo que diga el build.
  }

  return null;
}

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? null;

export const PACIENTE_ID = process.env.EXPO_PUBLIC_PACIENTE_ID ?? 'demo-0001';

const override = leerOverrideWeb();

/**
 * `?fuente=api` sin URL configurada cae a mock: pedir la API cuando no hay
 * API es un error de operación, no algo que la app deba intentar igual.
 */
export const MODO: 'mock' | 'http' =
  override === 'mock' ? 'mock' : API_URL ? 'http' : 'mock';

/** Texto para el indicador de `configuracion.tsx`. */
export function describirFuente(): string {
  if (MODO === 'mock') {
    return override === 'mock'
      ? 'Datos de ejemplo (forzado con ?fuente=mock)'
      : 'Datos de ejemplo';
  }
  return `Conectada a ${API_URL}`;
}
```

- [ ] **Step 2: Verificar que compila**

Run: `cd mobile && npx tsc --noEmit`
Expected: los mismos errores `TS2305` de la tarea 2 en las pantallas, y **ninguno nuevo** en `lib/`. Si aparece un error sobre `window`, falta `"dom"` en `lib` de `tsconfig.json` — comprobarlo antes de seguir.

- [ ] **Step 3: Commit**

```bash
git add mobile/lib/config.ts
git commit -m "front: config de fuente de datos con override de runtime en web"
```

---

### Task 4: Adaptador mock

**Files:**
- Create: `mobile/lib/cliente-mock.ts`

**Interfaces:**
- Consumes: `ClienteApi` y tipos de `lib/contratos.ts`; `perfilMock`, `medicamentosMock`, `controlesMock`, `planesMock`, `avisosMock` de `data/mock.ts`.
- Produces: `clienteMock: ClienteApi`, `PREGUNTA_DIARIA`, `RESPUESTAS_DIARIAS`, `conversacionInicial: Mensaje[]`.

- [ ] **Step 1: Crear `lib/cliente-mock.ts`**

```ts
/**
 * Adaptador mock. Implementa `ClienteApi` leyendo de `data/mock.ts`.
 *
 * La latencia simulada NO es decorativa: sin ella los estados de carga nunca
 * se ejercitan y aparecen rotos recién al conectar el backend real.
 *
 * Acá viven las réplicas del agente simulado. Que estén en este archivo y no
 * en `data/` es lo que hace imposible el fallback prohibido: en modo HTTP,
 * `chat.tsx` no tiene forma de alcanzarlas.
 */
import {
  avisosMock,
  controlesMock,
  medicamentosMock,
  perfilMock,
  planesMock,
} from '@/data/mock';
import type {
  Aviso,
  ClienteApi,
  Control,
  Medicamento,
  Mensaje,
  Perfil,
  PlanCarril,
  RespuestaChat,
} from '@/lib/contratos';

const LATENCIA_MS = 300;

/**
 * Interruptor de pruebas. Poner en `true` a mano para ejercitar los caminos
 * de error de todas las pantallas sin desconectar nada. Volver a `false`
 * antes de commitear.
 */
const FALLAR = false;

async function responder<T>(datos: T): Promise<T> {
  await new Promise((r) => setTimeout(r, LATENCIA_MS));
  if (FALLAR) throw new Error('Falla simulada del cliente mock');
  return datos;
}

/** Chequeo diario de adherencia. Se responde con un toque, sin teclear. */
export const PREGUNTA_DIARIA = '¿Tomó sus remedios hoy?';

export const RESPUESTAS_DIARIAS = ['Sí, todos', 'Algunos', 'No'];

/**
 * Respuesta del agente simulado a cada opción. Ninguna culpa al paciente:
 * Principio III — acompaña, no fiscaliza.
 */
const REPLICAS: Record<string, string> = {
  'Sí, todos': 'Qué bueno. Lo dejo anotado para su equipo de salud.',
  Algunos:
    'Gracias por contarme, me sirve saberlo. Si quiere, cuénteme cuál se le quedó y lo anoto.',
  No: 'Gracias por contarme. Le pasa a mucha gente y no es un problema. Le voy a avisar a su equipo para que lo acompañen.',
};

/** Palabras que disparan derivación en el agente simulado. */
const SENALES_DERIVACION = ['pecho', 'respirar', 'desmay', 'sangr', 'hablar'];

export const conversacionInicial: Mensaje[] = [
  { id: 'x0', de: 'agente', texto: PREGUNTA_DIARIA, respuestas: RESPUESTAS_DIARIAS },
];

export const clienteMock: ClienteApi = {
  obtenerPerfil(_id: string): Promise<Perfil> {
    return responder(perfilMock);
  },

  obtenerMedicamentos(_id: string): Promise<Medicamento[]> {
    return responder(medicamentosMock);
  },

  obtenerControles(_id: string): Promise<Control[]> {
    return responder(controlesMock);
  },

  obtenerPlan(_id: string): Promise<{ planes: PlanCarril[] }> {
    return responder({ planes: planesMock });
  },

  obtenerAvisos(_id: string): Promise<Aviso[]> {
    return responder(avisosMock);
  },

  enviarMensaje(_id: string, texto: string): Promise<RespuestaChat> {
    const normalizado = texto.toLowerCase();

    if (SENALES_DERIVACION.some((s) => normalizado.includes(s))) {
      return responder({
        respuesta: 'Eso necesita que lo vea un profesional ahora. Voy a avisar a su equipo de salud.',
        derivacion: true,
      });
    }

    const replica = REPLICAS[texto];
    if (replica) {
      return responder({ respuesta: replica });
    }

    return responder({
      respuesta:
        'Gracias por contarme. Lo dejo anotado para su equipo de salud.',
      fuente: 'Respuesta de ejemplo — el agente real responde en modo conectado',
    });
  },
};
```

- [ ] **Step 2: Verificar que compila**

Run: `cd mobile && npx tsc --noEmit`
Expected: los mismos errores `TS2305` de las pantallas, ninguno nuevo en `lib/`. Si `clienteMock` no satisface `ClienteApi`, TypeScript lo dice acá — ese es el punto de anotar el tipo en la constante.

- [ ] **Step 3: Commit**

```bash
git add mobile/lib/cliente-mock.ts
git commit -m "front: adaptador mock con latencia e interruptor de fallas"
```

---

### Task 5: Adaptador HTTP y superficie pública

**Files:**
- Create: `mobile/lib/cliente-http.ts`
- Create: `mobile/lib/api.ts`

**Interfaces:**
- Consumes: `ClienteApi` y tipos de `lib/contratos.ts`; `API_URL`, `MODO` de `lib/config.ts`; `clienteMock` de `lib/cliente-mock.ts`.
- Produces: `obtenerPerfil`, `obtenerMedicamentos`, `obtenerControles`, `obtenerPlan`, `obtenerAvisos`, `enviarMensaje` — todas desde `lib/api.ts`.

- [ ] **Step 1: Crear `lib/cliente-http.ts`**

```ts
/**
 * Adaptador HTTP. Implementa `ClienteApi` contra `EXPO_PUBLIC_API_URL`.
 *
 * Dos cosas rompen esto en producción y no se ven en local:
 *  - Netlify sirve por HTTPS. Un backend en HTTP plano queda bloqueado por
 *    mixed content y `fetch` falla sin llegar a la red.
 *  - Sin CORSMiddleware en FastAPI el navegador descarta la respuesta aunque
 *    el backend haya devuelto 200.
 * En ambos casos el síntoma acá es el mismo: TypeError. El detalle real está
 * en la consola del navegador.
 */
import { API_URL } from '@/lib/config';
import type {
  Aviso,
  ClienteApi,
  Control,
  Medicamento,
  Perfil,
  PlanCarril,
  RespuestaChat,
} from '@/lib/contratos';

const TIMEOUT_MS = 10000;

async function pedir<T>(ruta: string, init?: RequestInit): Promise<T> {
  if (!API_URL) {
    throw new Error('cliente-http usado sin EXPO_PUBLIC_API_URL configurada');
  }

  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), TIMEOUT_MS);

  try {
    const respuesta = await fetch(`${API_URL}${ruta}`, {
      ...init,
      signal: control.signal,
      headers: {
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
    });

    if (!respuesta.ok) {
      throw new Error(`HTTP ${respuesta.status} en ${ruta}`);
    }

    return (await respuesta.json()) as T;
  } finally {
    clearTimeout(reloj);
  }
}

export const clienteHttp: ClienteApi = {
  obtenerPerfil: (id) => pedir<Perfil>(`/api/paciente/${id}/perfil`),

  obtenerMedicamentos: (id) => pedir<Medicamento[]>(`/api/paciente/${id}/medicamentos`),

  obtenerControles: (id) => pedir<Control[]>(`/api/paciente/${id}/controles`),

  obtenerPlan: (id) => pedir<{ planes: PlanCarril[] }>(`/api/paciente/${id}/plan`),

  obtenerAvisos: (id) => pedir<Aviso[]>(`/api/paciente/${id}/avisos`),

  enviarMensaje: (id, texto) =>
    pedir<RespuestaChat>(`/api/paciente/${id}/chat`, {
      method: 'POST',
      body: JSON.stringify({ mensaje: texto }),
    }),
};
```

- [ ] **Step 2: Crear `lib/api.ts`**

```ts
/**
 * Superficie pública de datos. Lo ÚNICO que importan las pantallas.
 *
 * Ninguna pantalla sabe ni debe saber si detrás hay mock o HTTP. Esa es la
 * propiedad que permite conectar el backend sin tocar una sola pantalla.
 */
import { clienteHttp } from '@/lib/cliente-http';
import { clienteMock } from '@/lib/cliente-mock';
import { MODO } from '@/lib/config';
import type { ClienteApi } from '@/lib/contratos';

const cliente: ClienteApi = MODO === 'http' ? clienteHttp : clienteMock;

export const obtenerPerfil: ClienteApi['obtenerPerfil'] = (id) => cliente.obtenerPerfil(id);
export const obtenerMedicamentos: ClienteApi['obtenerMedicamentos'] = (id) =>
  cliente.obtenerMedicamentos(id);
export const obtenerControles: ClienteApi['obtenerControles'] = (id) =>
  cliente.obtenerControles(id);
export const obtenerPlan: ClienteApi['obtenerPlan'] = (id) => cliente.obtenerPlan(id);
export const obtenerAvisos: ClienteApi['obtenerAvisos'] = (id) => cliente.obtenerAvisos(id);
export const enviarMensaje: ClienteApi['enviarMensaje'] = (id, texto) =>
  cliente.enviarMensaje(id, texto);
```

- [ ] **Step 3: Verificar que compila**

Run: `cd mobile && npx tsc --noEmit`
Expected: solo los errores `TS2305` de las pantallas. Si `clienteHttp` no cumple `ClienteApi`, sale acá.

- [ ] **Step 4: Commit**

```bash
git add mobile/lib/cliente-http.ts mobile/lib/api.ts
git commit -m "front: adaptador HTTP y superficie unica en lib/api.ts"
```

---

### Task 6: Hook de carga y componentes de estado

**Files:**
- Create: `mobile/hooks/use-recurso.ts`
- Create: `mobile/components/estado.tsx`

**Interfaces:**
- Consumes: tokens de `@/theme/tokens`.
- Produces: `useRecurso<T>(cargar, deps?)` → `{ datos: T | null; cargando: boolean; error: Error | null; recargar: () => void }`; componentes `<Cargando que="..." />` y `<ErrorCarga onReintentar={...} />`.

- [ ] **Step 1: Crear `hooks/use-recurso.ts`**

```ts
/**
 * Carga un recurso y expone sus tres estados.
 *
 * El detalle técnico del error va a consola y NUNCA a pantalla: quien usa
 * esta app tiene 65+ años y multimorbilidad. «Network request failed» no le
 * dice nada y lo asusta.
 */
import { useCallback, useEffect, useState } from 'react';

export type Recurso<T> = {
  datos: T | null;
  cargando: boolean;
  error: Error | null;
  recargar: () => void;
};

export function useRecurso<T>(cargar: () => Promise<T>, deps: unknown[] = []): Recurso<T> {
  const [datos, setDatos] = useState<T | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [intento, setIntento] = useState(0);

  const recargar = useCallback(() => setIntento((n) => n + 1), []);

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    setError(null);

    cargar()
      .then((d) => {
        if (vivo) setDatos(d);
      })
      .catch((e: unknown) => {
        if (!vivo) return;
        const err = e instanceof Error ? e : new Error(String(e));
        console.error('[apheleia] fallo al cargar:', err);
        setError(err);
      })
      .finally(() => {
        if (vivo) setCargando(false);
      });

    return () => {
      vivo = false;
    };
    // `cargar` se recrea en cada render de la pantalla; incluirlo dispararía
    // un bucle. Las dependencias reales las declara quien llama, en `deps`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intento, ...deps]);

  return { datos, cargando, error, recargar };
}
```

- [ ] **Step 2: Crear `components/estado.tsx`**

```tsx
/**
 * Estados de carga y error, compartidos por todas las pantallas.
 *
 * El texto de error es deliberadamente humano y accionable: dice qué pasó en
 * términos de la persona («su equipo de salud»), no del sistema, y ofrece
 * exactamente una acción.
 */
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { color, radius, space, touch, type } from '@/theme/tokens';

export function Cargando({ que }: { que: string }) {
  return (
    <View style={styles.centro} accessible accessibilityLabel={`Cargando ${que}`}>
      <ActivityIndicator size="large" color={color.accent} />
      <Text style={styles.textoCargando}>Cargando {que}…</Text>
    </View>
  );
}

export function ErrorCarga({ onReintentar }: { onReintentar: () => void }) {
  return (
    <View style={styles.centro}>
      <Text style={styles.textoError}>
        No pude conectar con su equipo de salud. Intente de nuevo.
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Intentar de nuevo"
        onPress={onReintentar}
        style={({ pressed }) => [styles.boton, pressed ? styles.botonPress : null]}>
        <Text style={styles.botonTexto}>Intentar de nuevo</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  centro: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space.xl,
    gap: space.md,
  },
  textoCargando: {
    fontSize: type.body,
    color: color.inkMuted,
  },
  textoError: {
    fontSize: type.body,
    color: color.ink,
    textAlign: 'center',
    lineHeight: type.body * 1.45,
  },
  boton: {
    minHeight: touch.minHeight,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    borderRadius: radius.button,
    backgroundColor: color.accent,
  },
  botonPress: {
    backgroundColor: color.accentPressed,
  },
  botonTexto: {
    fontSize: type.button,
    fontWeight: '700',
    color: color.onAccent,
  },
});
```

- [ ] **Step 3: Verificar que compila**

Run: `cd mobile && npx tsc --noEmit`
Expected: solo los errores `TS2305` de las pantallas.

- [ ] **Step 4: Commit**

```bash
git add mobile/hooks/use-recurso.ts mobile/components/estado.tsx
git commit -m "front: hook de carga y componentes de estado"
```

---

# FASE 1B — Pantallas

### Task 7: Medicamentos

**Files:**
- Modify: `mobile/app/medicamentos.tsx`

**Interfaces:**
- Consumes: `obtenerMedicamentos` de `@/lib/api`; `PACIENTE_ID` de `@/lib/config`; `describirTomas`, `SELLO_VALIDAR`, tipos `Medicamento`/`Tomas` de `@/lib/contratos`; `useRecurso`; `Cargando`, `ErrorCarga`.
- Produces: nada para otras tareas.

- [ ] **Step 1: Reemplazar el cuerpo del componente**

Sustituir el bloque de imports y la función `Medicamentos` (líneas 1–55 del archivo actual) por:

```tsx
import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Bajada, Pantalla, Tarjeta, Titulo } from '@/components/apheleia';
import { Cargando, ErrorCarga } from '@/components/estado';
import { useRecurso } from '@/hooks/use-recurso';
import { obtenerMedicamentos } from '@/lib/api';
import { PACIENTE_ID } from '@/lib/config';
import { SELLO_VALIDAR, describirTomas, type Tomas } from '@/lib/contratos';
import { color, radius, space, type } from '@/theme/tokens';

/**
 * Medicamentos — solo lectura.
 *
 * El paciente NO agrega, edita ni elimina medicamentos. Las indicaciones las
 * determina el profesional de salud (Principio I: el sistema no prescribe ni
 * modifica dosis).
 *
 * La grilla de tomas se dibuja SOLO si la indicación viene en notación de
 * posología. Una frecuencia como «cada 8 h» no significa mañana/mediodía/
 * noche: mostrarla en la grilla le atribuiría al profesional un horario que
 * no indicó. En ese caso se muestra el texto tal cual.
 */
export default function Medicamentos() {
  const cargar = useCallback(() => obtenerMedicamentos(PACIENTE_ID), []);
  const { datos, cargando, error, recargar } = useRecurso(cargar);

  return (
    <Pantalla>
      <Titulo>Medicamentos</Titulo>
      <Bajada>Lo que su equipo de salud le indicó</Bajada>

      {cargando ? <Cargando que="sus medicamentos" /> : null}
      {error ? <ErrorCarga onReintentar={recargar} /> : null}

      {datos?.length === 0 ? (
        <Tarjeta>
          <Text style={styles.vacio}>
            No hay medicamentos indicados en este momento.
          </Text>
        </Tarjeta>
      ) : null}

      {datos?.map((m) => (
        <Tarjeta key={m.id}>
          <Text style={styles.nombre}>{m.nombre}</Text>
          <Text style={styles.dosis}>{m.dosis}</Text>

          {m.tomas ? (
            <>
              <GrillaTomas tomas={m.tomas} />
              <Text style={styles.enPalabras}>{describirTomas(m.tomas)}</Text>
            </>
          ) : (
            <Text style={styles.enPalabras}>{m.frecuencia}</Text>
          )}

          {/* Recomendación de acompañamiento. Va en tono más suave que la dosis:
              lo que la persona viene a ver es cuánto y cuándo. */}
          {m.recomendacion ? (
            <View style={styles.recomendacion}>
              <Text style={styles.recomendacionTexto}>{m.recomendacion}</Text>
              <Text style={styles.sello}>{SELLO_VALIDAR}</Text>
            </View>
          ) : null}
        </Tarjeta>
      ))}

      {/* Explica la ausencia del botón. Un espacio vacío sin explicación se lee
          como una función que falta, no como una decisión. */}
      <View style={styles.aclaracion}>
        <Text style={styles.aclaracionTexto}>
          Sus medicamentos los indica su equipo de salud. Si algo no calza con su receta,
          coménteselo en su próximo control.
        </Text>
      </View>
    </Pantalla>
  );
}
```

La función `GrillaTomas` y el `StyleSheet` quedan **sin cambios**, salvo agregar un estilo nuevo:

```tsx
  vacio: {
    fontSize: type.body,
    color: color.inkMuted,
    lineHeight: type.body * 1.45,
  },
```

- [ ] **Step 2: Verificar**

Run: `cd mobile && npx tsc --noEmit`
Expected: desaparecen los errores de `medicamentos.tsx`; siguen los de `controles.tsx`, `plan.tsx`, `alertas.tsx` y `chat.tsx`.

- [ ] **Step 3: Verificación visual**

Run: `cd mobile && npx expo start --web`
Abrir `/medicamentos`. Esperado: aparece «Cargando sus medicamentos…» ~300 ms; luego tres tarjetas. Metformina y Losartán con grilla; **Atorvastatina sin grilla y con el texto «cada 8 h»** — ese es el caso que el cambio de contrato protege.

- [ ] **Step 4: Commit**

```bash
git add mobile/app/medicamentos.tsx
git commit -m "front: medicamentos consume api.ts; grilla solo con posologia"
```

---

### Task 8: Controles y plan

**Files:**
- Modify: `mobile/app/controles.tsx`
- Modify: `mobile/app/plan.tsx`

**Interfaces:**
- Consumes: `obtenerControles`, `obtenerPlan` de `@/lib/api`; `formatearFecha`, `FUENTE_PLAN` de `@/lib/contratos`.
- Produces: nada para otras tareas.

- [ ] **Step 1: Reescribir `app/controles.tsx`**

```tsx
import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Bajada, Pantalla, Tarjeta, Titulo } from '@/components/apheleia';
import { Cargando, ErrorCarga } from '@/components/estado';
import { useRecurso } from '@/hooks/use-recurso';
import { obtenerControles } from '@/lib/api';
import { PACIENTE_ID } from '@/lib/config';
import { formatearFecha } from '@/lib/contratos';
import { color, radius, space, type } from '@/theme/tokens';

/**
 * Controles — historial cronológico de atenciones.
 *
 * Cada control muestra su modalidad ECICEP (presencial, seguimiento a distancia,
 * transición del cuidado). No es decorativo: son las prestaciones que Apheleia
 * dice habilitar, y aparecen en el registro oficial.
 *
 * El próximo control va primero porque es lo que la persona necesita saber.
 */
export default function Controles() {
  const cargar = useCallback(() => obtenerControles(PACIENTE_ID), []);
  const { datos, cargando, error, recargar } = useRecurso(cargar);

  return (
    <Pantalla>
      <Titulo>Controles</Titulo>
      <Bajada>Sus atenciones, de la más reciente a la más antigua</Bajada>

      {cargando ? <Cargando que="sus controles" /> : null}
      {error ? <ErrorCarga onReintentar={recargar} /> : null}

      {datos?.length === 0 ? (
        <Tarjeta>
          <Text style={styles.vacio}>Todavía no hay controles registrados.</Text>
        </Tarjeta>
      ) : null}

      {datos?.map((c) => (
        <Tarjeta key={c.id}>
          <View style={styles.encabezado}>
            <Text style={styles.fecha}>{formatearFecha(c.fecha)}</Text>
            {c.proximo ? (
              <View style={styles.marca}>
                <Text style={styles.marcaTexto}>Próximo</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.titulo}>{c.titulo}</Text>
          <Text style={styles.detalle}>{c.detalle}</Text>
        </Tarjeta>
      ))}
    </Pantalla>
  );
}

const styles = StyleSheet.create({
  encabezado: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  fecha: {
    fontSize: type.label,
    color: color.inkMuted,
  },
  marca: {
    backgroundColor: color.okBg,
    borderRadius: radius.pill,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  marcaTexto: {
    fontSize: type.label - 2,
    fontWeight: '700',
    color: color.ok,
  },
  titulo: {
    fontSize: type.heading,
    fontWeight: '600',
    color: color.ink,
    marginTop: 4,
  },
  detalle: {
    fontSize: type.body,
    color: color.inkMuted,
    marginTop: 2,
  },
  vacio: {
    fontSize: type.body,
    color: color.inkMuted,
    lineHeight: type.body * 1.45,
  },
});
```

- [ ] **Step 2: Reescribir `app/plan.tsx`**

```tsx
import { useCallback } from 'react';
import { StyleSheet, Text } from 'react-native';

import { Bajada, Fuente, Pantalla, Tarjeta, Titulo } from '@/components/apheleia';
import { Cargando, ErrorCarga } from '@/components/estado';
import { useRecurso } from '@/hooks/use-recurso';
import { obtenerPlan } from '@/lib/api';
import { PACIENTE_ID } from '@/lib/config';
import { FUENTE_PLAN } from '@/lib/contratos';
import { color, type } from '@/theme/tokens';

/**
 * Mi plan — la versión digital del plan de cuidados integral consensuado.
 *
 * El Marco Operativo ECICEP 2025 ya define este plan como el objeto central del
 * modelo, dice que debe compartirse con la persona y servirle de bitácora — y
 * hoy eso es un carné de papel (p. 51). Esta pantalla es ese carné.
 *
 * El contenido proviene de la biblioteca validada por el profesional, nunca de
 * generación libre del modelo (Principio IV: cita o di no sé). Un paciente en
 * carril `dual` recibe DOS planes y se muestran separados, sin mezclarlos.
 */
export default function Plan() {
  const cargar = useCallback(() => obtenerPlan(PACIENTE_ID), []);
  const { datos, cargando, error, recargar } = useRecurso(cargar);

  const planes = datos?.planes ?? [];
  const hayNoValidado = planes.some((p) => !p.validado);

  return (
    <Pantalla>
      <Titulo>Mi plan</Titulo>
      <Bajada>Lo que acordó con su equipo de salud</Bajada>

      {cargando ? <Cargando que="su plan" /> : null}
      {error ? <ErrorCarga onReintentar={recargar} /> : null}

      {datos && planes.length === 0 ? (
        <Tarjeta>
          <Text style={styles.detalle}>
            Su plan todavía no está disponible. Su equipo de salud lo definirá en su
            próximo control.
          </Text>
        </Tarjeta>
      ) : null}

      {planes.map((p) => (
        <Tarjeta key={`${p.aplica_a ?? 'ambos'}-${p.titulo}`}>
          <Text style={styles.titulo}>{p.titulo}</Text>
          <Text style={styles.detalle}>{p.contenido}</Text>
          <Text style={styles.origen}>{p.fuente}</Text>
        </Tarjeta>
      ))}

      {hayNoValidado ? <Fuente>{FUENTE_PLAN}</Fuente> : null}
    </Pantalla>
  );
}

const styles = StyleSheet.create({
  titulo: {
    fontSize: type.heading,
    fontWeight: '600',
    color: color.ink,
  },
  detalle: {
    fontSize: type.body,
    color: color.inkMuted,
    marginTop: 4,
    lineHeight: type.body * 1.5,
  },
  origen: {
    fontSize: type.label - 3,
    color: color.warn,
    marginTop: 8,
    fontWeight: '600',
  },
});
```

- [ ] **Step 3: Verificar**

Run: `cd mobile && npx tsc --noEmit`
Expected: quedan solo los errores de `alertas.tsx` y `chat.tsx`.

- [ ] **Step 4: Commit**

```bash
git add mobile/app/controles.tsx mobile/app/plan.tsx
git commit -m "front: controles y plan consumen api.ts"
```

---

### Task 9: Alertas

**Files:**
- Modify: `mobile/app/alertas.tsx`

**Interfaces:**
- Consumes: `obtenerAvisos` de `@/lib/api`; `SIGNOS_ALARMA` de `@/data/signos-alarma`; `SELLO_VALIDAR`, `formatearFecha` de `@/lib/contratos`.
- Produces: nada para otras tareas.

**Propiedad crítica:** el bloque de emergencia se renderiza **antes** de cualquier condicional de carga o error, y nunca depende de `datos`. Si esta tarea se implementa de forma que el 131 pueda no aparecer, está mal hecha.

- [ ] **Step 1: Reemplazar imports y el cuerpo del componente**

Sustituir las líneas 1–74 del archivo actual por:

```tsx
import { useCallback } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { Bajada, Pantalla, Tarjeta, Titulo } from '@/components/apheleia';
import { Cargando, ErrorCarga } from '@/components/estado';
import { SIGNOS_ALARMA } from '@/data/signos-alarma';
import { useRecurso } from '@/hooks/use-recurso';
import { obtenerAvisos } from '@/lib/api';
import { PACIENTE_ID } from '@/lib/config';
import { SELLO_VALIDAR, formatearFecha } from '@/lib/contratos';
import { color, radius, space, touch, type } from '@/theme/tokens';

/**
 * Alertas — dos cosas en una pantalla, en este orden a propósito.
 *
 * 1. Signos de alarma: qué debe hacer consultar de inmediato, con el 131 a mano.
 *    Es la razón de que el botón del inicio sea rojo — es la pantalla a la que
 *    uno corre.
 * 2. Avisos enviados a su equipo: qué se informó, cuándo, y si ya lo revisaron.
 *
 * ⚠️ El bloque de emergencia es LOCAL y se renderiza siempre, aunque la carga
 * de avisos falle o no haya red. Hacerlo depender de la API significaría que
 * justo cuando más importa puede aparecer vacío. Solo degrada la mitad de
 * abajo.
 *
 * Guardrails que se ven acá:
 * - Ningún aviso interpreta un síntoma ni nombra una condición: cita el criterio
 *   que lo gatilló y nada más.
 * - Ningún aviso es un reproche. El sistema acompaña, no fiscaliza.
 * - "Su equipo lo revisó" refleja que una alerta no se cierra sin un humano.
 *
 * ⚠️ Los signos de alarma son contenido clínico pendiente de PD-05 (Joaquín).
 */
export default function Alertas() {
  const cargar = useCallback(() => obtenerAvisos(PACIENTE_ID), []);
  const { datos, cargando, error, recargar } = useRecurso(cargar);

  return (
    <Pantalla>
      <Titulo>Alertas</Titulo>
      <Bajada>Cuándo pedir ayuda, y qué se le informó a su equipo</Bajada>

      <View style={styles.bloqueAlarma}>
        <Text style={styles.tituloAlarma}>Consulte de inmediato si tiene</Text>

        {SIGNOS_ALARMA.map((s) => (
          <View key={s} style={styles.fila}>
            <Text style={styles.vinneta}>•</Text>
            <Text style={styles.signo}>{s}</Text>
          </View>
        ))}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Llamar al 131, servicio de urgencia"
          onPress={() => Linking.openURL('tel:131')}
          style={styles.boton131}>
          <Text style={styles.boton131Texto}>Llamar al 131</Text>
        </Pressable>

        <Text style={styles.sello}>{SELLO_VALIDAR}</Text>
      </View>

      <Text style={styles.subtitulo}>Avisos a su equipo de salud</Text>
      <Text style={styles.explicacion}>
        Cuando algo necesita atención, su equipo se entera. Nadie queda solo esperando.
      </Text>

      {cargando ? <Cargando que="sus avisos" /> : null}
      {error ? <ErrorCarga onReintentar={recargar} /> : null}

      {datos?.length === 0 ? (
        <Tarjeta>
          <Text style={styles.explicacion}>
            No se ha enviado ningún aviso a su equipo.
          </Text>
        </Tarjeta>
      ) : null}

      {datos?.map((a) => (
        <Tarjeta key={a.id}>
          <View style={styles.encabezado}>
            <Text style={styles.fecha}>{formatearFecha(a.fecha)}</Text>
            <View style={[styles.marca, a.revisado ? styles.marcaRevisado : styles.marcaPendiente]}>
              <Text
                style={[
                  styles.marcaTexto,
                  a.revisado ? styles.marcaTextoRevisado : styles.marcaTextoPendiente,
                ]}>
                {a.revisado ? '✓ Su equipo lo revisó' : '• En revisión'}
              </Text>
            </View>
          </View>
          <Text style={styles.motivo}>{a.motivo}</Text>
        </Tarjeta>
      ))}
    </Pantalla>
  );
}
```

El `StyleSheet` queda **sin cambios**.

- [ ] **Step 2: Verificar**

Run: `cd mobile && npx tsc --noEmit`
Expected: queda solo el error de `chat.tsx`.

- [ ] **Step 3: Verificar la propiedad crítica**

Run: `cd mobile && npx expo start --web`

En `mobile/lib/cliente-mock.ts`, cambiar temporalmente `const FALLAR = false;` por `const FALLAR = true;`. Recargar `/alertas`.

Expected: los cinco signos de alarma y el botón «Llamar al 131» **siguen visibles**; abajo aparece el mensaje de error con «Intentar de nuevo». Si el bloque rojo desaparece, la implementación está mal.

Devolver `FALLAR` a `false` antes de commitear.

- [ ] **Step 4: Commit**

```bash
git add mobile/app/alertas.tsx
git commit -m "front: avisos por api; bloque de emergencia siempre local"
```

---

### Task 10: Chat

**Files:**
- Modify: `mobile/app/chat.tsx`

**Interfaces:**
- Consumes: `enviarMensaje` de `@/lib/api`; `conversacionInicial` de `@/lib/cliente-mock`; `PACIENTE_ID` de `@/lib/config`; tipo `Mensaje` de `@/lib/contratos`.
- Produces: nada para otras tareas.

**Propiedad crítica:** si `enviarMensaje` falla, **no** se fabrica una respuesta del agente. Se muestra un aviso de conexión, se conserva el mensaje del paciente, y el 131 sigue accesible.

**Nota sobre `conversacionInicial`:** en modo HTTP la semilla es solo la pregunta diaria, que no es contenido clínico ni una respuesta del modelo — es la apertura fija de la conversación. Importarla de `cliente-mock` es aceptable justamente porque no es una réplica.

- [ ] **Step 1: Reemplazar imports y el cuerpo del componente**

Sustituir las líneas 1–65 del archivo actual por:

```tsx
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { enviarMensaje } from '@/lib/api';
import { conversacionInicial } from '@/lib/cliente-mock';
import { PACIENTE_ID } from '@/lib/config';
import type { Mensaje } from '@/lib/contratos';
import { color, radius, space, touch, type } from '@/theme/tokens';

/**
 * Conversar — la pantalla que más pesa en la evaluación del Lab.
 *
 * Acá es donde el sistema llama a Claude, vía `POST /api/paciente/{id}/chat`.
 *
 * Guardrails visibles en esta pantalla:
 * - El agente deriva ante un signo de alarma, nunca interpreta el síntoma.
 * - Cita la fuente del contenido clínico, y declara cuando es mock sin validar.
 * - Ante emergencia, deriva a SAMU 131 con un botón sólido, no con texto suelto.
 *
 * ⚠️ Si la llamada falla NO se inventa una réplica. Fabricar una respuesta del
 * agente cuando el agente no respondió es exactamente lo que prohíbe el
 * Principio IV. Se avisa de la falla de conexión y se deja el 131 a la vista.
 */
export default function Chat() {
  const [mensajes, setMensajes] = useState<Mensaje[]>(conversacionInicial);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);

  function enviar() {
    const limpio = texto.trim();
    if (limpio.length === 0 || enviando) return;
    responder(limpio);
    setTexto('');
  }

  async function responder(mensajePaciente: string) {
    setEnviando(true);

    const n = mensajes.length;

    // Consumida la pregunta, se retiran sus botones: no se responde dos veces.
    setMensajes((actual) => [
      ...actual.map((m) => (m.respuestas ? { ...m, respuestas: undefined } : m)),
      { id: `u${n}`, de: 'paciente', texto: mensajePaciente },
    ]);

    try {
      const r = await enviarMensaje(PACIENTE_ID, mensajePaciente);
      setMensajes((actual) => [
        ...actual,
        {
          id: `a${n}`,
          de: 'agente',
          texto: r.respuesta,
          fuente: r.fuente,
          derivacion: r.derivacion,
          respuestas: r.respuestas,
        },
      ]);
    } catch (e) {
      console.error('[apheleia] fallo al enviar mensaje:', e);
      // Aviso de sistema, NO una respuesta del agente: sin `fuente` clínica y
      // con el 131 disponible por si la persona lo necesitaba ahora.
      setMensajes((actual) => [
        ...actual,
        {
          id: `e${n}`,
          de: 'agente',
          texto:
            'No pude conectar con su equipo de salud. Su mensaje no se envió. ' +
            'Si es urgente, llame al 131.',
          derivacion: true,
        },
      ]);
    } finally {
      setEnviando(false);
    }
  }
```

El resto del archivo —el `return` con el `KeyboardAvoidingView`, el `map` de burbujas y el `StyleSheet`— queda **sin cambios**, con una sola modificación en el botón de enviar para reflejar el estado:

```tsx
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Enviar mensaje"
          onPress={enviar}
          disabled={enviando}
          style={({ pressed }) => [
            styles.enviar,
            pressed ? styles.enviarPress : null,
            enviando ? styles.enviarInactivo : null,
          ]}>
          <Text style={styles.enviarTexto}>{enviando ? 'Enviando…' : 'Enviar'}</Text>
        </Pressable>
```

Y un estilo nuevo:

```tsx
  enviarInactivo: {
    opacity: 0.5,
  },
```

- [ ] **Step 2: Verificar**

Run: `cd mobile && npx tsc --noEmit`
Expected: **PASS, sin errores.** Este es el hito: todas las pantallas migradas y el contrato cumplido de punta a punta.

- [ ] **Step 3: Verificar los dos caminos**

Run: `cd mobile && npx expo start --web`

Camino feliz: escribir «me duele el pecho» → el agente deriva, burbuja roja, botón «Llamar al 131».

Camino de falla: poner `const FALLAR = true;` en `cliente-mock.ts`, recargar, enviar cualquier mensaje. Esperado: el mensaje del paciente queda en pantalla y aparece el aviso de conexión con el 131. **No** debe aparecer ninguna réplica del agente. Devolver `FALLAR` a `false`.

- [ ] **Step 4: Lint y commit**

```bash
cd mobile && npx expo lint
```

```bash
git add mobile/app/chat.tsx
git commit -m "front: chat consume api.ts; sin replica inventada ante falla"
```

---

### Task 11: Indicador de fuente en configuración

**Files:**
- Modify: `mobile/app/configuracion.tsx`

**Interfaces:**
- Consumes: `describirFuente`, `MODO` de `@/lib/config`.
- Produces: nada para otras tareas.

**Por qué:** un demostrador que no sabe en qué modo está es un demostrador que va a afirmar algo falso frente al jurado.

- [ ] **Step 1: Agregar el bloque de estado**

Añadir a los imports:

```tsx
import { MODO, describirFuente } from '@/lib/config';
```

Insertar, justo antes del `<View style={styles.aviso}>` final:

```tsx
      <View style={styles.fuente}>
        <Text style={styles.fuenteRotulo}>Origen de los datos</Text>
        <Text style={styles.fuenteValor}>{describirFuente()}</Text>
        {MODO === 'mock' ? (
          <Text style={styles.fuenteNota}>
            La información que ve es de ejemplo, no corresponde a una persona real.
          </Text>
        ) : null}
      </View>
```

Y al `StyleSheet`:

```tsx
  fuente: {
    marginTop: space.md,
    padding: space.md,
    borderRadius: radius.card,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.line,
  },
  fuenteRotulo: {
    fontSize: type.label - 2,
    color: color.inkMuted,
    marginBottom: 2,
  },
  fuenteValor: {
    fontSize: type.body,
    color: color.ink,
    fontWeight: '600',
  },
  fuenteNota: {
    fontSize: type.label - 2,
    color: color.inkMuted,
    marginTop: space.xs,
    lineHeight: (type.label - 2) * 1.45,
  },
```

- [ ] **Step 2: Verificar**

Run: `cd mobile && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add mobile/app/configuracion.tsx
git commit -m "front: indicador de origen de los datos en configuracion"
```

---

# FASE 2 — Despliegue

### Task 12: Netlify

**Files:**
- Create: `netlify.toml` (raíz del repo)

**Interfaces:**
- Consumes: nada del código.
- Produces: sitio desplegable; variables `EXPO_PUBLIC_API_URL` y `EXPO_PUBLIC_PACIENTE_ID` configurables en Netlify.

- [ ] **Step 1: Verificar que el export funciona localmente**

Run: `cd mobile && npx expo export --platform web`
Expected: termina sin error y `mobile/dist/` contiene `index.html`, `medicamentos.html`, `controles.html`, `plan.html`, `alertas.html`, `chat.html`, `configuracion.html`.

Si falla acá, va a fallar en Netlify con logs peores. Arreglar antes de seguir.

- [ ] **Step 2: Crear `netlify.toml`**

```toml
# Despliegue del front paciente. Netlify construye desde `mobile/`.
#
# `app.json` declara `web.output: "static"`, así que el export genera un HTML
# por ruta y las pretty URLs de Netlify los sirven directo (`/alertas` →
# `alertas.html`). No hace falta regla de reescritura SPA.
#
# EXPO_PUBLIC_API_URL se define en la UI de Netlify, no acá: se inlinea en el
# bundle durante el build, así que cambiarla exige un redeploy. Para volver a
# mock sin rebuild, usar `?fuente=mock` en la URL del sitio.

[build]
  base = "mobile"
  command = "npx expo export --platform web"
  publish = "dist"

[build.environment]
  NODE_VERSION = "20"
```

- [ ] **Step 3: Verificar que `dist/` no se commitea**

Run: `git status --short`
Expected: solo `netlify.toml` como archivo nuevo. `mobile/dist/` está en `mobile/.gitignore:11` y no debe aparecer.

- [ ] **Step 4: Commit**

```bash
git add netlify.toml
git commit -m "deploy: netlify construye el front desde mobile/"
```

- [ ] **Step 5: Desplegar (lo hace Patricio)**

En Netlify: conectar el repo, elegir la rama, dejar que `netlify.toml` defina el build. **No** configurar `EXPO_PUBLIC_API_URL` todavía — el sitio debe quedar en modo mock, funcionando solo, antes de intentar conectar nada.

Verificación post-deploy:
1. La portada carga y los cuatro botones navegan.
2. `/configuracion` dice «Datos de ejemplo».
3. `/alertas` muestra los signos y el botón del 131.
4. `<url>/?fuente=mock` sigue en mock (el override no rompe nada cuando ya está en mock).

---

# FASE 3 — Backend

### Task 13: Tapar los huecos de la cohorte

**Files:**
- Modify: `src/data/loader.py`

**Interfaces:**
- Consumes: la estructura existente de `construir_filas`.
- Produces: filas de `control` (3–4 por paciente, una futura) y de `alerta_clinica`.

**Por qué:** hoy `loader.py` siembra un solo control por paciente y ninguna alerta. Sin esto, `/controles` devuelve una tarjeta y `/avisos` devuelve vacío para los 200 — con el backend perfectamente sano.

- [ ] **Step 1: Agregar controles de seguimiento**

En `construir_filas`, justo después del bloque que crea el control de ingreso (`controles.append({... "modalidad_ecicep": "ingreso" ...})`), agregar:

```python
        # Controles de seguimiento. El de ingreso solo no alcanza: la pantalla
        # muestra historial y "próximo control", y con una sola fila se ve
        # como si el sistema no tuviera datos.
        for i, modalidad in enumerate(("control", "seguimiento_distancia", "control")):
            controles.append(
                {
                    "control_id": _uuid("control", alias, str(i)),
                    "pseudonym_id": pseudonym_id,
                    "profesional_id": profesional["profesional_id"],
                    "modalidad_ecicep": modalidad,
                    "fecha": _dias_atras(rnd.randint(15, 150)),
                    "resumen": "Control de seguimiento (cohorte sintética)",
                    "rce_referencia": f"RCE-SINT-{alias}-{i}",
                }
            )

        # Próximo control: fecha futura. Es el dato que la persona busca primero.
        controles.append(
            {
                "control_id": _uuid("control", alias, "proximo"),
                "pseudonym_id": pseudonym_id,
                "profesional_id": profesional["profesional_id"],
                "modalidad_ecicep": "control",
                "fecha": (
                    datetime.now(timezone.utc) + timedelta(days=rnd.randint(5, 45))
                ).isoformat(),
                "resumen": "Control programado (cohorte sintética)",
                "rce_referencia": f"RCE-SINT-{alias}-prox",
            }
        )
```

`datetime` y `timezone` ya están importados en `loader.py:40` — no hace falta tocar los imports.

- [ ] **Step 2: Agregar alertas clínicas**

Declarar la lista junto a las demás, cambiando:

```python
    consentimientos, estados = [], []
```

por:

```python
    consentimientos, estados = [], []
    alertas = []
```

Y después del bloque que arma `estados`, agregar:

```python
        # Alerta clínica: solo para los estados que la justifican
        # (contracts/tools.md — `generar_alerta`). `compensado` y
        # `en_regresion` NO generan alerta.
        #
        # `validada_por` en None = pendiente. Una alerta no se cierra sola
        # (Principio II): el constraint de la tabla lo hace cumplir.
        if p["estado_dinamico"] in ("signo_alarma", "descompensado", "perdida_contacto"):
            revisada = rnd.random() < 0.6
            alertas.append(
                {
                    "alerta_id": _uuid("alerta", alias),
                    "pseudonym_id": pseudonym_id,
                    # Mismo id que genera el bloque de `estados` (loader.py:286).
                    "estado_id": _uuid("estado", alias),
                    "criterio_disparo": CRITERIO_POR_ESTADO[p["estado_dinamico"]],
                    "severidad": "alta" if p["estado_dinamico"] == "signo_alarma" else "media",
                    "destino": "profesional",
                    "derivada_a": profesional["profesional_id"],
                    "generada_at": _dias_atras(rnd.randint(1, 30)),
                    "validada_por": profesional["profesional_id"] if revisada else None,
                    "validada_at": _dias_atras(rnd.randint(1, 5)) if revisada else None,
                    "resultado": "acompañamiento activado" if revisada else None,
                }
            )
```

Agregar cerca de las constantes del módulo:

```python
# Cita del criterio que gatilló la alerta. NUNCA interpreta ni diagnostica, y
# jamás atribuye culpa: el sistema acompaña, no fiscaliza (Principio III).
CRITERIO_POR_ESTADO = {
    "signo_alarma": "La persona describió una molestia que requiere evaluación inmediata.",
    "descompensado": "Los datos de seguimiento se apartaron de lo esperado para su plan.",
    "perdida_contacto": "Pasaron 15 días sin contacto con la persona.",
}
```

- [ ] **Step 3: Incluir la tabla en la carga y la limpieza**

Tres cambios, todos con ubicación exacta:

1. En el `return` de `construir_filas` (`loader.py:298-311`), agregar como última clave:

```python
        "estado_dinamico": estados,
        "alerta_clinica": alertas,
    }
```

2. En la tupla de orden de inserción de `cargar` (`loader.py:349-362`), agregar al final. Va **después** de `estado_dinamico` porque `estado_id` es FK:

```python
        "estado_dinamico",
        "alerta_clinica",
    ):
```

3. En `TABLAS_EN_ORDEN_INVERSO` (`loader.py:70`), agregar como **primer** elemento. El borrado va en orden inverso de dependencia:

```python
TABLAS_EN_ORDEN_INVERSO = [
    "alerta_clinica",
    "estado_dinamico",
    "indicacion",
```

- [ ] **Step 4: Verificar en seco**

Run: `python -m src.data.loader --dry-run`
Expected: el conteo de `control` sube a ~5 por paciente (~1000 filas) y aparece `alerta_clinica` con un conteo distinto de cero, cercano al número de pacientes en `signo_alarma`, `descompensado` o `perdida_contacto`.

- [ ] **Step 5: Recargar la cohorte**

```bash
python -m src.data.loader --limpiar
python -m src.data.loader --generar
```

Expected: termina sin violar constraints. Si `alerta_requiere_validacion_humana` falla, hay una alerta con `resultado` y sin `validada_por` — revisar el paso 2.

- [ ] **Step 6: Commit**

```bash
git add src/data/loader.py
git commit -m "datos: siembra controles de seguimiento y alertas clinicas"
```

---

### Task 14: Formato compartido del backend

**Files:**
- Create: `src/api/formato.py`
- Create: `tests/test_formato_api.py`

**Interfaces:**
- Consumes: nada.
- Produces: `parsear_tomas(frecuencia: str) -> dict | None`, `titulo_modalidad(modalidad: str) -> str`.

Esta tarea sí usa TDD real: pytest ya está en el repo.

- [ ] **Step 1: Escribir los tests que fallan**

```python
"""Tests del formato compartido de los endpoints de paciente."""

from src.api.formato import parsear_tomas, titulo_modalidad


def test_posologia_de_tres_tomas_se_parsea():
    assert parsear_tomas("1-0-1") == {"manana": 1, "mediodia": 0, "noche": 1}


def test_posologia_con_espacios_se_parsea():
    assert parsear_tomas(" 1 - 1 - 1 ") == {"manana": 1, "mediodia": 1, "noche": 1}


def test_frecuencia_libre_no_se_inventa():
    """
    «cada 8 h» NO significa mañana/mediodía/noche. Devolver una grilla acá
    le atribuiría al profesional un horario que no indicó (Principio IV).
    """
    assert parsear_tomas("cada 8 h") is None
    assert parsear_tomas("cada 12 h") is None
    assert parsear_tomas("cada 24 h") is None
    assert parsear_tomas("según necesidad") is None


def test_frecuencia_vacia_o_nula():
    assert parsear_tomas("") is None
    assert parsear_tomas(None) is None


def test_titulo_de_modalidad_conocida():
    assert titulo_modalidad("seguimiento_distancia") == "Seguimiento a distancia"
    assert titulo_modalidad("ingreso") == "Ingreso a seguimiento"


def test_titulo_de_modalidad_desconocida_no_revienta():
    """Un valor nuevo en la BD no debe dejar la pantalla en blanco."""
    assert titulo_modalidad("modalidad_futura") == "Atención"
```

- [ ] **Step 2: Correr y verificar que fallan**

Run: `python -m pytest tests/test_formato_api.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'src.api.formato'`.

- [ ] **Step 3: Implementar**

```python
"""
Formato compartido de los endpoints de paciente.

Determinista y sin modelo, igual que `core/estratificacion.py`.
"""

import re

_POSOLOGIA = re.compile(r"^\s*(\d)\s*-\s*(\d)\s*-\s*(\d)\s*$")

_TITULO_MODALIDAD = {
    "ingreso": "Ingreso a seguimiento",
    "control": "Control integral",
    "seguimiento_distancia": "Seguimiento a distancia",
    "gestion_caso": "Gestión de caso",
    "transicion_PDE": "Transición del cuidado",
}


def parsear_tomas(frecuencia: str | None) -> dict | None:
    """
    Convierte la notación de posología (`1-0-1`) en tomas del día.

    Devuelve None para cualquier otra cosa. Esto es deliberado: «cada 8 h»
    no dice mañana, mediodía y noche — dice cada ocho horas. Traducirlo a
    una grilla le mostraría al paciente un horario que su profesional no
    indicó (Principio IV: cita o di no sé).
    """
    if not frecuencia:
        return None

    m = _POSOLOGIA.match(frecuencia)
    if not m:
        return None

    return {
        "manana": int(m.group(1)),
        "mediodia": int(m.group(2)),
        "noche": int(m.group(3)),
    }


def titulo_modalidad(modalidad: str | None) -> str:
    """Modalidad ECICEP en lenguaje corriente. Nunca devuelve vacío."""
    return _TITULO_MODALIDAD.get(modalidad or "", "Atención")
```

- [ ] **Step 4: Correr y verificar que pasan**

Run: `python -m pytest tests/test_formato_api.py -v`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/api/formato.py tests/test_formato_api.py
git commit -m "api: formato compartido; la posologia no se inventa"
```

---

### Task 15: App FastAPI con CORS

**Files:**
- Create: `src/api/app.py`

**Interfaces:**
- Consumes: `FastAPI`, `CORSMiddleware`; `create_client` de supabase.
- Produces: `app` (instancia FastAPI), `obtener_db()` (dependencia).

- [ ] **Step 1: Crear `src/api/app.py`**

```python
"""
App FastAPI de Apheleia.

CORS no es opcional: el front se sirve desde Netlify, en otro origen. Sin
`CORSMiddleware` el navegador descarta la respuesta aunque el backend haya
devuelto 200 — y el síntoma se ve en el front, no acá, así que se diagnostica
mal.

Y el backend tiene que quedar detrás de TLS. Netlify sirve por HTTPS: un
backend en HTTP plano queda bloqueado por mixed content y la app carga
perfecta sin traer un solo dato.
"""

import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from supabase import Client, create_client

load_dotenv()

app = FastAPI(title="Apheleia — API paciente", version="0.1.0")

# Orígenes permitidos, separados por coma. En desarrollo, el de Expo web.
# En producción, el dominio de Netlify. Nunca "*": la app lleva datos
# clínicos aunque hoy sean sintéticos.
_ORIGENES = [
    o.strip()
    for o in os.environ.get(
        "APHELEIA_ORIGENES_PERMITIDOS", "http://localhost:8081"
    ).split(",")
    if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ORIGENES,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Accept"],
)

_db: Client | None = None


def obtener_db() -> Client:
    """
    Cliente REST con la service_role key.

    Las tablas tienen RLS deny-all, así que este es el único camino de
    lectura mientras no exista autenticación de paciente. Aceptable con
    cohorte 100% sintética; NO aceptable con datos reales.
    """
    global _db
    if _db is None:
        _db = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])
    return _db


@app.get("/salud")
def salud() -> dict:
    """Sonda de vida. Sirve para verificar CORS y TLS sin tocar la base."""
    return {"estado": "ok"}
```

- [ ] **Step 2: Levantar y verificar**

Run: `python -m uvicorn src.api.app:app --reload --port 8000`

En otra terminal: `curl -i http://localhost:8000/salud`
Expected: `HTTP/1.1 200 OK` y `{"estado":"ok"}`.

Verificar CORS:
```bash
curl -i -H "Origin: http://localhost:8081" http://localhost:8000/salud
```
Expected: la respuesta incluye `access-control-allow-origin: http://localhost:8081`.

- [ ] **Step 3: Commit**

```bash
git add src/api/app.py
git commit -m "api: app FastAPI con CORS y sonda de salud"
```

---

### Task 16: Endpoints de lectura

**Files:**
- Create: `src/api/paciente.py`
- Modify: `src/api/app.py` (registrar el router)

**Interfaces:**
- Consumes: `obtener_db` de `src/api/app.py`; `parsear_tomas`, `titulo_modalidad` de `src/api/formato.py`.
- Produces: `router` con `/api/paciente/{pid}/perfil`, `/medicamentos`, `/controles`, `/plan`, `/avisos`.

**Formas de salida:** exactamente las de `mobile/lib/contratos.ts`. Si divergen, el front compila pero falla en runtime.

- [ ] **Step 1: Crear `src/api/paciente.py`**

```python
"""
Endpoints de la app paciente.

Devuelven exactamente la forma declarada en `mobile/lib/contratos.ts`. Si
divergen, TypeScript no lo detecta —los tipos describen lo que el backend
PROMETE, no lo que entrega— y la app falla en runtime.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

from src.api.app import obtener_db
from src.api.formato import parsear_tomas, titulo_modalidad

router = APIRouter(prefix="/api/paciente", tags=["paciente"])


@router.get("/{pid}/perfil")
def perfil(pid: str, db: Client = Depends(obtener_db)) -> dict:
    clinico = (
        db.table("paciente_clinico")
        .select("pseudonym_id, tramo_actual, carril_actual")
        .eq("pseudonym_id", pid)
        .execute()
        .data
    )
    if not clinico:
        raise HTTPException(status_code=404, detail="PACIENTE_NO_ENCONTRADO")

    p = clinico[0]

    condiciones = (
        db.table("condicion_cronica")
        .select("nombre")
        .eq("pseudonym_id", pid)
        .eq("activa", True)
        .execute()
        .data
    )

    # El carril vigente sale de la asignación abierta, no del cache de
    # paciente_clinico: el histórico es la fuente de verdad (FR-016).
    asignacion = (
        db.table("asignacion_carril")
        .select("carril, origen_agudo")
        .eq("pseudonym_id", pid)
        .is_("vigente_hasta", "null")
        .execute()
        .data
    )

    carril = asignacion[0]["carril"] if asignacion else None
    origen_agudo = asignacion[0]["origen_agudo"] if asignacion else None

    return {
        "pseudonym_id": p["pseudonym_id"],
        "grupo_riesgo": p["tramo_actual"],
        "carril": carril,
        "origen_agudo": origen_agudo,
        "condiciones": [c["nombre"] for c in condiciones],
        "resumen": "Persona en seguimiento por su equipo de salud.",
    }


@router.get("/{pid}/medicamentos")
def medicamentos(pid: str, db: Client = Depends(obtener_db)) -> list[dict]:
    filas = (
        db.table("indicacion")
        .select("indicacion_id, dosis, frecuencia, medicamento(nombre)")
        .eq("pseudonym_id", pid)
        .is_("vigente_hasta", "null")
        .execute()
        .data
    )

    return [
        {
            "id": f["indicacion_id"],
            "nombre": (f.get("medicamento") or {}).get("nombre", "Medicamento"),
            "dosis": f["dosis"],
            "frecuencia": f["frecuencia"],
            # None cuando la frecuencia no es posología de tres tomas.
            "tomas": parsear_tomas(f["frecuencia"]),
        }
        for f in filas
    ]


@router.get("/{pid}/controles")
def controles(pid: str, db: Client = Depends(obtener_db)) -> list[dict]:
    filas = (
        db.table("control")
        .select("control_id, fecha, modalidad_ecicep, resumen")
        .eq("pseudonym_id", pid)
        .order("fecha", desc=True)
        .execute()
        .data
    )

    ahora = datetime.now(timezone.utc)

    # El próximo control es el futuro más cercano. Solo uno lleva la marca:
    # es lo que la persona busca primero y dos marcas la anulan.
    futuros = [f for f in filas if _es_futuro(f["fecha"], ahora)]
    id_proximo = min(futuros, key=lambda f: f["fecha"])["control_id"] if futuros else None

    return [
        {
            "id": f["control_id"],
            "fecha": f["fecha"],
            "titulo": (
                "Próximo control"
                if f["control_id"] == id_proximo
                else titulo_modalidad(f["modalidad_ecicep"])
            ),
            "detalle": f.get("resumen") or titulo_modalidad(f["modalidad_ecicep"]),
            "proximo": f["control_id"] == id_proximo,
        }
        for f in filas
    ]


def _es_futuro(iso: str, ahora: datetime) -> bool:
    try:
        return datetime.fromisoformat(iso) > ahora
    except (ValueError, TypeError):
        return False


@router.get("/{pid}/plan")
def plan(pid: str, db: Client = Depends(obtener_db)) -> dict:
    """
    Plan del tramo y carril del paciente, desde la biblioteca validada.

    NO genera contenido: lo recupera (Principio IV). Un paciente `dual`
    recibe los planes de ambos carriles y el front los muestra separados.
    """
    p = perfil(pid, db)
    tramo = p["grupo_riesgo"]
    carril = p["carril"]

    consulta = (
        db.table("biblioteca_clinica")
        .select("titulo, contenido, fuente, version, validado_por, carril, grupo_riesgo")
        .eq("categoria", "plan_tramo")
    )

    filas = consulta.execute().data

    # Un chunk con grupo_riesgo o carril en NULL aplica a todos. En `dual`
    # entran los dos carriles.
    def aplica(f: dict) -> bool:
        if f["grupo_riesgo"] is not None and f["grupo_riesgo"] != tramo:
            return False
        if f["carril"] is None or carril is None or carril == "dual":
            return True
        return f["carril"] == carril

    return {
        "planes": [
            {
                "aplica_a": f["carril"],
                "titulo": f["titulo"],
                "contenido": f["contenido"],
                "fuente": f["fuente"],
                "version": f["version"],
                "validado": f["validado_por"] is not None,
            }
            for f in filas
            if aplica(f)
        ]
    }


@router.get("/{pid}/avisos")
def avisos(pid: str, db: Client = Depends(obtener_db)) -> list[dict]:
    """
    Vista paciente de las alertas clínicas.

    Expone la cita del criterio y si un humano la revisó. NUNCA severidad,
    destino ni el estado dinámico: eso es información del equipo de salud.
    """
    filas = (
        db.table("alerta_clinica")
        .select("alerta_id, criterio_disparo, generada_at, validada_por")
        .eq("pseudonym_id", pid)
        .order("generada_at", desc=True)
        .execute()
        .data
    )

    return [
        {
            "id": f["alerta_id"],
            "fecha": f["generada_at"],
            "motivo": f["criterio_disparo"],
            "revisado": f["validada_por"] is not None,
        }
        for f in filas
    ]
```

- [ ] **Step 2: Registrar el router**

En `src/api/app.py`, al final del archivo:

```python
from src.api.paciente import router as router_paciente  # noqa: E402

app.include_router(router_paciente)
```

El import va al final a propósito: `paciente.py` importa `obtener_db` de este módulo, y ponerlo arriba crea un ciclo.

- [ ] **Step 3: Verificar contra la cohorte real**

Run: `python -m uvicorn src.api.app:app --reload --port 8000`

Obtener un `pseudonym_id` real:
```bash
python -c "from src.agents.conversacion_minima import _cliente_supabase; db=_cliente_supabase(); print(db.table('paciente_clinico').select('pseudonym_id').limit(1).execute().data)"
```

Con ese id:
```bash
curl -s http://localhost:8000/api/paciente/<ID>/perfil
curl -s http://localhost:8000/api/paciente/<ID>/medicamentos
curl -s http://localhost:8000/api/paciente/<ID>/controles
curl -s http://localhost:8000/api/paciente/<ID>/plan
curl -s http://localhost:8000/api/paciente/<ID>/avisos
```

Expected:
- `perfil`: `grupo_riesgo` en G0–G3, `carril` no nulo, `condiciones` con al menos 2 entradas.
- `medicamentos`: lista no vacía, **todas con `"tomas": null`** — la cohorte solo tiene «cada N h». Si alguna trae grilla, `parsear_tomas` está mal.
- `controles`: ~5 entradas, exactamente una con `"proximo": true`.
- `plan`: al menos un plan con `"validado": false`.
- `avisos`: puede venir vacío si ese paciente está `compensado`. Probar con uno en `signo_alarma`.

- [ ] **Step 4: Commit**

```bash
git add src/api/paciente.py src/api/app.py
git commit -m "api: endpoints de lectura de la app paciente"
```

---

### Task 17: Endpoint de chat

**Files:**
- Modify: `src/api/paciente.py`

**Interfaces:**
- Consumes: `conversar` de `src/agents/conversacion_minima.py`; `perfil` de este mismo módulo.
- Produces: `POST /api/paciente/{pid}/chat` → `{ respuesta, fuente?, derivacion? }`.

**Bloqueo conocido:** `conversar()` falla con `credit balance is too low` (T023). El endpoint se implementa igual y devuelve 503 cuando eso ocurre, que es lo que el front sabe manejar.

- [ ] **Step 1: Agregar el endpoint**

Al final de `src/api/paciente.py`:

```python
from pydantic import BaseModel  # noqa: E402

from src.agents.conversacion_minima import conversar  # noqa: E402


class MensajeEntrante(BaseModel):
    mensaje: str


@router.post("/{pid}/chat")
def chat(pid: str, cuerpo: MensajeEntrante, db: Client = Depends(obtener_db)) -> dict:
    """
    Un turno de conversación con el agente.

    Si el modelo falla se devuelve 503 y NO se fabrica una respuesta: el front
    muestra el aviso de conexión y deja el 131 a la vista. Inventar una réplica
    acá sería exactamente lo que prohíbe el Principio IV.
    """
    p = perfil(pid, db)

    try:
        r = conversar(
            db=db,
            pseudonym_id=pid,
            grupo_riesgo=p["grupo_riesgo"],
            carril=p["carril"],
            mensaje_paciente=cuerpo.mensaje,
        )
    except Exception as e:
        # El detalle queda en el log del servidor, nunca en la respuesta.
        print(f"[apheleia] fallo del agente: {e}")
        raise HTTPException(status_code=503, detail="AGENTE_NO_DISPONIBLE") from e

    return {
        "respuesta": r["respuesta"],
        "fuente": (
            f"Biblioteca clínica · {', '.join(r['chunks_clinicos_usados'])}"
            if r.get("chunks_clinicos_usados")
            else None
        ),
    }
```

- [ ] **Step 2: Verificar el camino de falla**

Run: `curl -s -i -X POST http://localhost:8000/api/paciente/<ID>/chat -H "Content-Type: application/json" -d '{"mensaje":"hola"}'`

Expected mientras el saldo de Anthropic siga en cero: `HTTP/1.1 503` con `{"detail":"AGENTE_NO_DISPONIBLE"}`. Ese es el comportamiento correcto, no un fallo del endpoint.

Con saldo cargado: `200` y `{"respuesta": "..."}`.

- [ ] **Step 3: Commit**

```bash
git add src/api/paciente.py
git commit -m "api: endpoint de chat; 503 sin inventar respuesta"
```

---

### Task 18: Conectar front y backend

**Files:** ninguno — configuración y verificación.

- [ ] **Step 1: Probar en local**

```bash
cd mobile && EXPO_PUBLIC_API_URL=http://localhost:8000 EXPO_PUBLIC_PACIENTE_ID=<ID> npx expo start --web
```

Verificar que `/configuracion` dice «Conectada a http://localhost:8000» y que medicamentos, controles, plan y alertas traen datos de la cohorte.

En medicamentos, confirmar que **ninguno muestra grilla**: la cohorte solo tiene «cada N h». Es el comportamiento correcto.

- [ ] **Step 2: Exponer el backend por HTTPS**

Netlify sirve por HTTPS; un backend en HTTP queda bloqueado por mixed content. Levantar un túnel TLS (Cloudflare Tunnel, ngrok o equivalente) y anotar la URL `https://…`.

Agregar el dominio de Netlify a los orígenes permitidos:

```bash
export APHELEIA_ORIGENES_PERMITIDOS="https://<sitio>.netlify.app,http://localhost:8081"
```

y reiniciar uvicorn.

- [ ] **Step 3: Configurar Netlify y redesplegar**

En la UI de Netlify, variables de entorno:
- `EXPO_PUBLIC_API_URL` = la URL HTTPS del túnel
- `EXPO_PUBLIC_PACIENTE_ID` = el `pseudonym_id` de demo

Disparar un redeploy (la variable se inlinea en build).

- [ ] **Step 4: Verificar en el sitio desplegado**

1. `/configuracion` muestra «Conectada a https://…».
2. Medicamentos y controles traen datos reales.
3. Consola del navegador sin errores de CORS ni de mixed content.
4. **`<url>/?fuente=mock` vuelve a datos de ejemplo sin rebuild.** Esta es la red de seguridad de la demo — si no funciona, revisar `leerOverrideWeb` en `config.ts`.

---

# FASE 4 — Contrato

### Task 19: Actualizar contratos y avisar

**Files:**
- Modify: `specs/001-continuidad-cuidado/contracts/tools.md`
- Modify: `specs/001-continuidad-cuidado/tasks.md`
- Modify: `specs/001-continuidad-cuidado/spec.md`

**Por qué al final:** el aviso al equipo sale con la implementación ya en pie, y no antes de que se sepa que la forma funciona. Pero **antes** de integrar cualquier trabajo nuevo de Jonathan encima.

- [ ] **Step 1: Actualizar la tabla de endpoints de paciente**

En la sección «Interfaz paciente — app móvil», reemplazar las filas de medicamentos y agregar las nuevas:

```markdown
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/paciente/{id}/perfil` | Carril, tramo, condiciones, resumen |
| GET | `/api/paciente/{id}/medicamentos` | Lista vigente (solo lectura) |
| GET | `/api/paciente/{id}/controles` | Historial cronológico |
| GET | `/api/paciente/{id}/plan` | Planes del tramo y carril |
| GET | `/api/paciente/{id}/avisos` | Vista paciente de las alertas |
| POST | `/api/paciente/{id}/chat` | Conversación con el agente |
```

- [ ] **Step 2: Documentar la forma de medicamentos**

Agregar bajo la tabla:

````markdown
**`GET /api/paciente/{id}/medicamentos`**
```json
[
  {
    "id": "uuid",
    "nombre": "Metformina",
    "dosis": "850 mg",
    "frecuencia": "cada 8 h",
    "tomas": null
  }
]
```

`frecuencia` es texto y **canónico**. `tomas` es opcional: se puebla solo cuando
la indicación viene en notación de posología (`1-0-1`), y es `null` en cualquier
otro caso. Traducir «cada 8 horas» a mañana/mediodía/noche le mostraría al
paciente un horario que su profesional no indicó (Principio IV). El front dibuja
la grilla únicamente cuando `tomas` viene poblado.

**`POST` y `PATCH` de medicamentos quedan retirados.** El paciente no administra
su lista: las indicaciones las determina el profesional (Principio I). Las tareas
T015, T016 y T018 quedan obsoletas.
````

- [ ] **Step 3: Documentar `/plan` y `/avisos`**

````markdown
**`GET /api/paciente/{id}/plan`**
```json
{
  "planes": [
    {
      "aplica_a": "cronico",
      "titulo": "Plan de gestión de enfermedad — riesgo moderado",
      "contenido": "…",
      "fuente": "Biblioteca de planes validados — ECICEP",
      "version": "1.0",
      "validado": true
    }
  ]
}
```
Un paciente `dual` recibe los planes de ambos carriles y el front los muestra
separados, sin mezclarlos. `aplica_a` en `null` = aplica a los dos carriles.

**`GET /api/paciente/{id}/avisos`**
```json
[
  {
    "id": "uuid",
    "fecha": "timestamptz",
    "motivo": "Cita del criterio que lo gatilló",
    "revisado": true
  }
]
```
Vista paciente de `alerta_clinica`. `revisado` refleja validación humana. **No**
expone severidad, destino ni estado dinámico: eso es información del equipo.
````

- [ ] **Step 4: Registrar los cambios en la tabla de ruptura**

Agregar a «Cambios — ampliación de alcance»:

```markdown
| `GET /api/paciente/{id}/medicamentos` | Nuevo campo `tomas` (opcional, nullable) junto a `frecuencia`. `POST` y `PATCH` retirados. |
```

Y a la lista de **Nuevos**: `GET /api/paciente/{id}/plan`, `GET /api/paciente/{id}/avisos`.

- [ ] **Step 5: Marcar tareas obsoletas**

En `tasks.md`, reemplazar T015, T016 y T018 por:

```markdown
- [~] T015 [US2] ~~`POST /api/paciente/{id}/medicamentos`~~ — **obsoleta**: el
      paciente no administra su lista de medicamentos (Principio I, acotación
      clínica de Joaquín). Ver `contracts/tools.md`
- [~] T016 [US2] ~~`PATCH /api/paciente/{id}/medicamentos/{id}`~~ — **obsoleta**,
      misma razón que T015
- [x] T017 [P] [US2] `GET /api/paciente/{id}/controles` — historial cronológico
- [~] T018 [US2] Pantallas Expo: lista de medicamentos ✅ + ~~formulario de
      registro~~ **obsoleto**
```

- [ ] **Step 6: Corregir `spec.md`**

Buscar en US2 la frase «el paciente registra sus medicamentos» y reemplazarla por: «el paciente consulta los medicamentos que su equipo de salud le indicó». Quedaba contradiciendo la acotación clínica.

- [ ] **Step 7: Commit y avisar**

```bash
git add specs/001-continuidad-cuidado/contracts/tools.md specs/001-continuidad-cuidado/tasks.md specs/001-continuidad-cuidado/spec.md
git commit -m "contrato: tomas opcional, /plan y /avisos, sin POST/PATCH de medicamentos"
git push
```

Avisar a Jonathan por el canal del equipo, corto y concreto: qué cambió y qué tiene que hacer (`git merge master`). Regla 1 de `contracts/tools.md`: un contrato acordado no se cambia sin avisar a quien construye contra él.

---

## Notas de verificación final

Antes de dar el trabajo por cerrado:

```bash
cd mobile && npx tsc --noEmit && npx expo lint && npx expo export --platform web
python -m pytest tests/ -v
```

Los cuatro tienen que pasar. Y la verificación que no es automática: abrir el sitio desplegado, entrar a `/alertas` con el backend apagado, y confirmar que el botón del 131 sigue ahí.
