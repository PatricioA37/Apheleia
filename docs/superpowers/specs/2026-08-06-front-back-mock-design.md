# Adaptar la app móvil al contrato del backend

**Fecha**: 2026-08-06
**Feature**: 001-continuidad-cuidado
**Vértices**: Patricio (contrato + backend), Jonathan (pantallas)

## Problema

Las siete pantallas de `mobile/app/` importan `@/data/mock` directo. No existe
`mobile/lib/api.ts`, que es lo que `contracts/tools.md` declara como el punto por
donde la app consume los endpoints. Mientras eso siga así, conectar el backend
significa reescribir cada pantalla.

Al mismo tiempo, `src/api/` está vacío: no hay endpoint que conectar todavía. El
camino RAG funciona (`recuperar_contexto()`, `conversar()`), la cohorte de 200
pacientes está en Supabase, pero nada de eso está expuesto por HTTP.

Y hay cuatro huecos de contrato que el propio front dejó anotados y que nadie ha
cerrado. Se resuelven acá.

## Decisión de alcance

Capa cliente con **dos adaptadores intercambiables**, prioridad en `/mobile`.

La app arranca sin backend, contra mock, con la forma exacta del contrato. Cuando
cada endpoint aterrice, se enchufa por variable de entorno sin tocar pantallas.

Alternativas descartadas:

- **Solo capa cliente**: no prueba nada del backend y deja el contrato sin cerrar.
- **Solo backend real**: la app queda inutilizable si el server no corre. Malo para
  una demo en vivo, que es el escenario que importa.

El híbrido cuesta un adaptador extra. A cambio, si el backend se cae durante la
demo se saca una variable de entorno y la app sigue funcionando.

## Arquitectura

```
mobile/
  lib/
    contratos.ts      tipos derivados 1:1 de contracts/tools.md
    api.ts            superficie pública — lo único que importan las pantallas
    cliente-mock.ts   adaptador mock sobre data/mock.ts
    cliente-http.ts   adaptador real sobre EXPO_PUBLIC_API_URL
    config.ts         elige adaptador; expone PACIENTE_ID
  hooks/
    use-recurso.ts    { datos, cargando, error, recargar }
  data/
    mock.ts           datos crudos, reformados a la forma del contrato
```

`cliente-mock.ts` y `cliente-http.ts` declaran ambos la interfaz `ClienteApi`.
`api.ts` elige uno al cargar el módulo y reexporta sus funciones. Las pantallas
importan de `api.ts` y no saben cuál está activo.

```ts
// config.ts
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? null;
export const MODO: 'mock' | 'http' = API_URL ? 'http' : 'mock';
export const PACIENTE_ID = process.env.EXPO_PUBLIC_PACIENTE_ID ?? 'demo-0001';
```

Sin `EXPO_PUBLIC_API_URL`, modo mock. Con ella, HTTP. No hay tercera vía ni
configuración en pantalla.

`cliente-mock.ts` simula ~300 ms de latencia y expone un interruptor para forzar
fallas. Sin latencia simulada los estados de carga nunca se ejercitan y aparecen
rotos recién al conectar el backend real.

## Superficie de `api.ts`

| Función | Endpoint | Estado en contrato |
|---|---|---|
| `obtenerPerfil(id)` | `GET /api/paciente/{id}/perfil` | existe |
| `obtenerMedicamentos(id)` | `GET /api/paciente/{id}/medicamentos` | cambia forma |
| `obtenerControles(id)` | `GET /api/paciente/{id}/controles` | existe |
| `obtenerPlan(id)` | `GET /api/paciente/{id}/plan` | nuevo |
| `obtenerAvisos(id)` | `GET /api/paciente/{id}/avisos` | nuevo |
| `enviarMensaje(id, texto)` | `POST /api/paciente/{id}/chat` | existe |

Los signos de alarma **no** son endpoint. Ver «Propiedades de seguridad».

### Tipos

```ts
export type Carril = 'agudo' | 'cronico' | 'dual';
export type GrupoRiesgo = 'G0' | 'G1' | 'G2' | 'G3';

export type Perfil = {
  pseudonym_id: string;
  grupo_riesgo: GrupoRiesgo;
  carril: Carril | null;        // null = CARRIL_NO_ASIGNADO
  origen_agudo: string | null;
  condiciones: string[];
  resumen: string;
};

export type Tomas = { manana: number; mediodia: number; noche: number };

export type Medicamento = {
  id: string;
  nombre: string;
  dosis: string;
  tomas: Tomas;
  recomendacion?: string;
};

export type Control = {
  id: string;
  fecha: string;
  titulo: string;
  modalidad: string;
  proximo?: boolean;
};

export type PlanCarril = {
  aplica_a: Carril;
  objetivos: string[];
  recomendaciones: string[];
  frecuencia_seguimiento_sugerida: string;
  validado_por: string | null;   // null mientras sea contenido mock
  version: string;
  fuente: string;
};

export type Aviso = {
  id: string;
  fecha: string;
  motivo: string;      // cita del criterio, nunca interpretación
  revisado: boolean;   // refleja validación humana
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
```

`Perfil` trae `grupo_riesgo` porque el chat lo necesita para el RAG. La app **no lo
renderiza**: tramo y estado dinámico son información del equipo de salud, y
mostrárselos al paciente rozaría el lenguaje diagnóstico (ver `app/index.tsx`).

`obtenerPlan` devuelve arreglo, coherente con `consultar_plan_tramo`. Un paciente
`dual` recibe dos planes y la pantalla los muestra **separados, sin mezclarlos**.

### Destino de las constantes actuales de `data/mock.ts`

`data/mock.ts` queda como datos crudos. Todo lo que hoy convive ahí se reparte:

| Hoy en `data/mock.ts` | Destino | Por qué |
|---|---|---|
| `describirTomas()` | `lib/contratos.ts`, junto al tipo `Tomas` | Función pura de formato, vive con su tipo |
| `SELLO_VALIDAR`, `FUENTE_PLAN` | `lib/contratos.ts` | Sellos de procedencia, aplican en los dos modos |
| `signosAlarma` | `data/signos-alarma.ts` | Contenido clínico local, nunca por red |
| `REPLICAS`, `PREGUNTA_DIARIA`, `RESPUESTAS_DIARIAS` | `cliente-mock.ts` | Son la respuesta del **agente simulado**. En modo HTTP las produce el backend y llegan en `RespuestaChat.respuestas` |
| `conversacion` (semilla) | `cliente-mock.ts` | Idem: historial simulado |
| `medicamentos`, `controles`, `planCuidado`, `avisos` | `data/mock.ts` | Datos crudos, reformados al contrato |

Que `REPLICAS` se mude a `cliente-mock.ts` es lo que hace imposible el fallback
prohibido: en modo HTTP, `chat.tsx` no tiene forma de alcanzarlo.

## Cambios a `contracts/tools.md`

Los tres primeros son de forma; el cuarto retira funcionalidad.

1. **`frecuencia` → `tomas`** en `GET /api/paciente/{id}/medicamentos`. El campo
   pasa de texto a `{ manana, mediodia, noche }`. El texto legible lo genera el
   front con `describirTomas()`, que ya existe y se muda a `lib/contratos.ts`.

   *Límite conocido y aceptado*: una posología tipo «cada 8 horas» o «según
   necesidad» no cabe en tres casillas. Cuando aparezca un caso real, se amplía el
   contrato. No se resuelve ahora.

2. **Nuevo `GET /api/paciente/{id}/plan`** → `{ planes: PlanCarril[] }`.

3. **Nuevo `GET /api/paciente/{id}/avisos`** → `Aviso[]`. Es la vista paciente de
   las alertas clínicas: fecha, motivo citado y si un humano lo revisó. Nunca
   expone severidad, criterio técnico crudo ni destino de derivación.

4. **Se retiran `POST` y `PATCH` de `/api/paciente/{id}/medicamentos`.**
   `T015`, `T016` y `T018` quedan obsoletas y se marcan como tales en `tasks.md`.

   Razón: `app/medicamentos.tsx:14-16` documenta que el paciente no administra su
   lista de medicamentos —la indicación la determina el profesional (Principio I,
   acotación clínica de Joaquín)— mientras el contrato y esas tres tareas dicen lo
   contrario. La acotación clínica manda. Dejarlo abierto arriesga que se construya
   un formulario que no debería existir.

   `spec.md` (US2, «el paciente registra sus medicamentos») queda inconsistente con
   esto y hay que corregirlo en el mismo cambio.

**Regla 1 de `contracts/tools.md`**: un contrato acordado no se cambia sin avisar a
quien construye contra él. Los cuatro cambios se comunican a Jonathan antes de
integrar.

## Propiedades de seguridad

No son detalles de UX. Cada una responde a un principio de la constitución.

**El bloque de emergencia de `alertas.tsx` se renderiza siempre.** Signos de alarma
y botón del 131 son constantes locales, no endpoint. Esa es la pantalla a la que
uno corre; hacerla depender de la red significaría que justo cuando más importa
puede aparecer vacía. Los avisos sí van por API y, si fallan, degrada solo esa
mitad de la pantalla. Los signos siguen siendo contenido clínico pendiente de
PD-05 y mantienen su sello de «Validar por médico».

**El chat nunca inventa.** Si `POST /chat` falla no se fabrica una réplica ni se cae
al mapa `REPLICAS`: se muestra que no hubo conexión, se conserva el mensaje del
paciente en pantalla y el 131 sigue accesible. Inventar una respuesta del agente
cuando el agente no respondió es exactamente lo que prohíbe el Principio IV (cita o
di no sé).

**Ningún error muestra texto técnico.** El usuario tiene 65+ y multimorbilidad. Ve
«No pude conectar con su equipo de salud. Intente de nuevo.» y un botón de
reintentar. El detalle va a consola.

**Cero PII.** `data/mock.ts` sigue siendo 100% sintético. El identificador es
`pseudonym_id`; no entra nombre, RUT ni dato de contacto en ninguna capa.

## Verificación

`mobile/` no tiene runner de tests (`package.json` trae `start`, `lint`,
`reset-project`). Montar Jest + RTL en medio del evento no se paga solo.

- **`npx tsc --noEmit`** — el gate real. Si ambos clientes declaran `ClienteApi`, el
  compilador garantiza que cumplen la misma forma y que ninguna pantalla lee un
  campo que el contrato no tiene. Ahí es donde los tipos derivados del contrato
  ganan lo que cuestan.
- **`npx expo lint`** — sin regresiones.
- **Manual**: `npx expo start` sin `EXPO_PUBLIC_API_URL` (mock), y con la variable
  apuntando a un host inexistente para ejercitar los tres caminos de error.

Anotado para después, fuera de alcance: cuando exista FastAPI, un test de contrato
que corra ambos adaptadores contra la misma batería de aserciones.

## Fuera de alcance

- Los endpoints FastAPI en `src/api/`. Este spec deja el front listo para
  consumirlos; construirlos es trabajo aparte (T012, T017, T025, T044).
- Autenticación. `PACIENTE_ID` viene de variable de entorno. Las tablas tienen RLS
  deny-all y el backend hoy lee con `service_role`.
- La interfaz clínica web (`web/`).
- Contenido clínico real: PD-03 (planes) y PD-05 (signos de alarma) siguen mock y
  declarados como tales en pantalla.
