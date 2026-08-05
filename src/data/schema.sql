-- Apheleia — Schema MVP
-- Principio V: separación identidad / dato clínico
-- Principio VII: histórico inmutable (vigente_desde / vigente_hasta)
-- Datos sintéticos durante el Lab.

create extension if not exists "uuid-ossp";
create extension if not exists vector;

-- ============================================================
-- DOMINIO IDENTIDAD (acceso restringido)
-- ============================================================

create table paciente_identidad (
  persona_id        uuid primary key default uuid_generate_v4(),
  rut_hash          text,
  nombre_sintetico  text not null,
  fecha_nacimiento  date,
  sexo              text,
  prevision         text,
  comuna            text,
  contacto          text,
  created_at        timestamptz default now()
);

create table paciente_seudonimo (
  pseudonym_id  uuid primary key default uuid_generate_v4(),
  persona_id    uuid not null references paciente_identidad(persona_id),
  activo        boolean default true
);

create table cuidador (
  cuidador_id             uuid primary key default uuid_generate_v4(),
  pseudonym_id            uuid not null,
  nombre_sintetico        text,
  contacto                text,
  vinculo                 text,
  consentido_por_usuario  boolean not null default false
);

-- ============================================================
-- GOBERNANZA (Ley 21.719)
-- ============================================================

create table consentimiento (
  consentimiento_id  uuid primary key default uuid_generate_v4(),
  persona_id         uuid not null references paciente_identidad(persona_id),
  finalidad          text not null,
  base_licitud       text,
  estado             text not null default 'otorgado',
  otorgado_at        timestamptz default now(),
  revocado_at        timestamptz
);

create table auditoria_acceso (
  evento_id     uuid primary key default uuid_generate_v4(),
  actor_id      uuid,
  pseudonym_id  uuid,
  accion        text not null,
  recurso       text,
  timestamp     timestamptz default now()
);

-- ============================================================
-- DOMINIO CLÍNICO (seudonimizado — sin PII)
-- ============================================================

create table establecimiento (
  establecimiento_id  uuid primary key default uuid_generate_v4(),
  nombre              text not null,
  comuna              text
);

create table paciente_clinico (
  pseudonym_id         uuid primary key,
  establecimiento_id   uuid references establecimiento(establecimiento_id),
  tramo_actual         text check (tramo_actual in ('G0','G1','G2','G3')),
  fecha_ingreso_ecicep date
);

create table condicion_cronica (
  condicion_id       uuid primary key default uuid_generate_v4(),
  pseudonym_id       uuid not null references paciente_clinico(pseudonym_id),
  cie10              text,
  nombre             text not null,
  fecha_diagnostico  date,
  activa             boolean not null default true
);

-- Histórico inmutable: nunca UPDATE, siempre fila nueva
create table estratificacion (
  estrat_id        uuid primary key default uuid_generate_v4(),
  pseudonym_id     uuid not null references paciente_clinico(pseudonym_id),
  grupo_riesgo     text not null check (grupo_riesgo in ('G0','G1','G2','G3')),
  n_condiciones    int not null,
  n_medicamentos   int not null default 0,
  evaluado_por     uuid,
  vigente_desde    timestamptz not null default now(),
  vigente_hasta    timestamptz
);

create table profesional (
  profesional_id      uuid primary key default uuid_generate_v4(),
  nombre              text not null,
  rol                 text check (rol in ('medico','enfermera','TENS','quimico_farmaceutico')),
  es_dupla_gestora    boolean default false,
  establecimiento_id  uuid references establecimiento(establecimiento_id)
);

create table control (
  control_id       uuid primary key default uuid_generate_v4(),
  pseudonym_id     uuid not null references paciente_clinico(pseudonym_id),
  profesional_id   uuid references profesional(profesional_id),
  modalidad_ecicep text check (modalidad_ecicep in
                    ('ingreso','control','seguimiento_distancia','gestion_caso','transicion_PDE')),
  fecha            timestamptz not null,
  resumen          text,
  rce_referencia   text  -- puntero al RCE oficial, NO copia
);

create table medicamento (
  medicamento_id    uuid primary key default uuid_generate_v4(),
  nombre            text not null,
  principio_activo  text,
  forma             text
);

-- Histórico inmutable
create table indicacion (
  indicacion_id   uuid primary key default uuid_generate_v4(),
  pseudonym_id    uuid not null references paciente_clinico(pseudonym_id),
  medicamento_id  uuid not null references medicamento(medicamento_id),
  indicado_por    uuid references profesional(profesional_id),
  dosis           text,
  frecuencia      text,
  vigente_desde   timestamptz not null default now(),
  vigente_hasta   timestamptz
);

-- ============================================================
-- CAPA AGENTE
-- ============================================================

create table estado_dinamico (
  estado_id       uuid primary key default uuid_generate_v4(),
  pseudonym_id    uuid not null references paciente_clinico(pseudonym_id),
  valor           text not null,
  probabilidades  jsonb,
  incertidumbre   numeric,
  evaluador       text not null check (evaluador in ('determinista','modelo')),
  modelo_usado    text,
  generado_at     timestamptz not null default now()
);

create table interaccion_agente (
  interaccion_id  uuid primary key default uuid_generate_v4(),
  pseudonym_id    uuid not null references paciente_clinico(pseudonym_id),
  agente          text,
  canal           text,
  direccion       text,
  contenido       text,
  modelo_usado    text,
  tokens_in       int default 0,
  tokens_out      int default 0,
  cache_hit       boolean default false,
  embedding_ref   text,
  timestamp       timestamptz default now()
);

create table alerta_clinica (
  alerta_id         uuid primary key default uuid_generate_v4(),
  pseudonym_id      uuid not null references paciente_clinico(pseudonym_id),
  estado_id         uuid references estado_dinamico(estado_id),
  criterio_disparo  text not null,   -- Principio IV: cita el criterio
  severidad         text,
  destino           text check (destino in ('profesional','cuidador','ambos')),
  derivada_a        uuid references profesional(profesional_id),
  generada_at       timestamptz default now(),
  validada_por      uuid references profesional(profesional_id),
  validada_at       timestamptz,
  resultado         text,

  -- PRINCIPIO II (no negociable): humano en el circuito.
  -- Una alerta no puede tener resultado sin validación humana registrada.
  constraint alerta_requiere_validacion_humana check (
    resultado is null
    or (validada_por is not null and validada_at is not null)
  )
);

-- ============================================================
-- CAPA RAG — familia Voyage 4 (voyage-4-large / voyage-4-lite)
-- Espacio vectorial COMPARTIDO entre modelos de la misma familia:
-- se puede embeber el corpus con -large y las queries en vivo con
-- -lite, y buscar ambas contra el mismo índice (retrieval asimétrico).
-- Dimensión elegida para el MVP: 1024 (default Matryoshka).
-- ============================================================

-- Biblioteca clínica: embebida UNA VEZ con voyage-4-large.
-- Baja frecuencia de escritura, alta frecuencia de lectura -> calidad.
create table biblioteca_clinica (
  chunk_id      uuid primary key default uuid_generate_v4(),
  categoria     text not null check (categoria in
                  ('plan_tramo','guia_ecicep','educacion_medicamento',
                   'faq','criterio_alarma','glosario')),
  grupo_riesgo  text check (grupo_riesgo in ('G0','G1','G2','G3')),  -- NULL = aplica a todos
  titulo        text not null,
  contenido     text not null,
  fuente        text not null,     -- cita exacta — Principio IV
  version       text not null,
  validado_por  uuid references profesional(profesional_id),
  vigente       boolean not null default true,
  embedding     vector(1024),      -- voyage-4-large, input_type=document
  creado_at     timestamptz default now()
);

create index idx_biblioteca_embedding on biblioteca_clinica
  using hnsw (embedding vector_cosine_ops);

create index idx_biblioteca_tramo on biblioteca_clinica(grupo_riesgo, categoria)
  where vigente;

-- Memoria del paciente: perfil + resúmenes de conversación.
-- Alta frecuencia de escritura (cada interacción puede regenerarla) -> costo bajo.
create table memoria_paciente (
  memoria_id    uuid primary key default uuid_generate_v4(),
  pseudonym_id  uuid not null references paciente_clinico(pseudonym_id),
  tipo          text not null check (tipo in
                  ('perfil_snapshot','resumen_conversacion','evento_relevante')),
  contenido     text not null,
  embedding     vector(1024),      -- voyage-4-lite, mismo espacio que biblioteca_clinica
  generado_at   timestamptz default now(),
  vigente       boolean default true
);

create index idx_memoria_embedding on memoria_paciente
  using hnsw (embedding vector_cosine_ops);

create index idx_memoria_paciente on memoria_paciente(pseudonym_id, generado_at desc)
  where vigente;

-- ============================================================
-- ÍNDICES
-- ============================================================

create index idx_condicion_paciente   on condicion_cronica(pseudonym_id) where activa;
create index idx_estrat_vigente       on estratificacion(pseudonym_id) where vigente_hasta is null;
create index idx_indicacion_vigente   on indicacion(pseudonym_id) where vigente_hasta is null;
create index idx_estado_paciente      on estado_dinamico(pseudonym_id, generado_at desc);
create index idx_alerta_pendiente     on alerta_clinica(derivada_a) where validada_por is null;

-- ============================================================
-- VISTA: bandeja de la dupla gestora
-- Orden de prioridad pendiente PD-06 (Gerardo)
-- ============================================================

create view v_bandeja_clinica as
select
  pc.pseudonym_id,
  pc.tramo_actual,
  ed.valor          as estado_dinamico,
  ed.generado_at    as ultima_evaluacion,
  exists(
    select 1 from alerta_clinica a
    where a.pseudonym_id = pc.pseudonym_id and a.validada_por is null
  )                 as alerta_pendiente
from paciente_clinico pc
left join lateral (
  select valor, generado_at
  from estado_dinamico e
  where e.pseudonym_id = pc.pseudonym_id
  order by generado_at desc
  limit 1
) ed on true;
