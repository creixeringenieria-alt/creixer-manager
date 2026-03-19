-- Módulos operativos: requerimientos, agenda y reporte de visita

create type public.requerimiento_tipo_servicio as enum (
  'visita_diagnostico',
  'visita_preliminar',
  'reparacion_directa'
);

create type public.requerimiento_estado as enum (
  'pendiente',
  'agendado',
  'en_visita',
  'visitado',
  'pendiente_cotizacion',
  'cotizado',
  'pendiente_aprobacion',
  'aprobado',
  'rechazado',
  'en_reparacion',
  'finalizado'
);

create type public.requerimiento_prioridad as enum (
  'baja',
  'media',
  'alta',
  'critica'
);

create type public.agenda_estado as enum (
  'programada',
  'confirmada',
  'en_camino',
  'en_sitio',
  'cerrada',
  'no_efectiva'
);

create type public.reporte_resultado_visita as enum (
  'diagnostico_realizado',
  'reparacion_realizada',
  'no_acceso',
  'reprogramar',
  'requiere_materiales',
  'pendiente_aprobacion'
);

create table public.requerimientos (
  id uuid primary key default gen_random_uuid(),
  codigo_requerimiento text not null unique,
  cliente_id uuid not null references public.clients(id) on delete restrict,
  inmueble_id uuid not null references public.properties(id) on delete restrict,
  contacto_nombre text,
  contacto_telefono text,
  descripcion text not null,
  canal_ingreso text not null default 'WhatsApp',
  tipo_servicio public.requerimiento_tipo_servicio not null,
  prioridad public.requerimiento_prioridad not null default 'media',
  estado public.requerimiento_estado not null default 'pendiente',
  fecha_reporte date not null default current_date,
  observaciones_internas text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.agenda_operativa (
  id uuid primary key default gen_random_uuid(),
  requerimiento_id uuid not null references public.requerimientos(id) on delete cascade,
  tecnico_id uuid references public.profiles(id) on delete set null,
  fecha_programada date not null,
  franja_horaria text not null,
  tipo_visita public.requerimiento_tipo_servicio not null,
  direccion text not null,
  contacto text,
  observaciones_logisticas text,
  estado_agenda public.agenda_estado not null default 'programada',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reportes_visita (
  id uuid primary key default gen_random_uuid(),
  agenda_id uuid not null unique references public.agenda_operativa(id) on delete cascade,
  hora_llegada timestamptz,
  hora_salida timestamptz,
  resultado_visita public.reporte_resultado_visita not null,
  diagnostico_tecnico text,
  actividades_recomendadas text,
  requiere_cotizacion boolean not null default false,
  se_reparo_en_sitio boolean not null default false,
  observaciones text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reporte_visita_fotos (
  id uuid primary key default gen_random_uuid(),
  reporte_visita_id uuid not null references public.reportes_visita(id) on delete cascade,
  storage_path text not null,
  descripcion text,
  created_at timestamptz not null default now()
);

create index idx_requerimientos_cliente on public.requerimientos(cliente_id);
create index idx_requerimientos_inmueble on public.requerimientos(inmueble_id);
create index idx_requerimientos_estado on public.requerimientos(estado);
create index idx_requerimientos_fecha_reporte on public.requerimientos(fecha_reporte);

create index idx_agenda_requerimiento on public.agenda_operativa(requerimiento_id);
create index idx_agenda_tecnico on public.agenda_operativa(tecnico_id);
create index idx_agenda_fecha on public.agenda_operativa(fecha_programada);
create index idx_agenda_estado on public.agenda_operativa(estado_agenda);

create index idx_reportes_agenda on public.reportes_visita(agenda_id);
create index idx_fotos_reporte on public.reporte_visita_fotos(reporte_visita_id);

create trigger set_requerimientos_updated_at
before update on public.requerimientos
for each row execute function public.set_updated_at();

create trigger set_agenda_operativa_updated_at
before update on public.agenda_operativa
for each row execute function public.set_updated_at();

create trigger set_reportes_visita_updated_at
before update on public.reportes_visita
for each row execute function public.set_updated_at();

create or replace function public.sync_estado_requerimiento_desde_agenda()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    update public.requerimientos
    set estado = 'agendado', updated_at = now()
    where id = new.requerimiento_id
      and estado in ('pendiente', 'visitado', 'pendiente_aprobacion');

    return new;
  end if;

  if new.estado_agenda in ('en_camino', 'en_sitio') then
    update public.requerimientos
    set estado = 'en_visita', updated_at = now()
    where id = new.requerimiento_id;
  elsif new.estado_agenda in ('programada', 'confirmada') then
    update public.requerimientos
    set estado = 'agendado', updated_at = now()
    where id = new.requerimiento_id
      and estado in ('pendiente', 'visitado', 'pendiente_aprobacion', 'en_visita');
  elsif new.estado_agenda = 'no_efectiva' then
    update public.requerimientos
    set estado = 'agendado', updated_at = now()
    where id = new.requerimiento_id;
  end if;

  return new;
end;
$$;

create or replace function public.sync_estado_requerimiento_desde_reporte()
returns trigger
language plpgsql
as $$
declare
  req_id uuid;
  nuevo_estado public.requerimiento_estado;
begin
  select ao.requerimiento_id into req_id
  from public.agenda_operativa ao
  where ao.id = new.agenda_id;

  update public.agenda_operativa
  set estado_agenda = 'cerrada', updated_at = now()
  where id = new.agenda_id;

  if new.resultado_visita = 'reparacion_realizada' or new.se_reparo_en_sitio then
    nuevo_estado := 'finalizado';
  elsif new.resultado_visita = 'diagnostico_realizado' and new.requiere_cotizacion then
    nuevo_estado := 'pendiente_cotizacion';
  elsif new.resultado_visita = 'diagnostico_realizado' then
    nuevo_estado := 'visitado';
  elsif new.resultado_visita = 'pendiente_aprobacion' then
    nuevo_estado := 'pendiente_aprobacion';
  elsif new.resultado_visita = 'requiere_materiales' then
    nuevo_estado := 'pendiente_aprobacion';
  elsif new.resultado_visita = 'no_acceso' or new.resultado_visita = 'reprogramar' then
    nuevo_estado := 'agendado';
  else
    nuevo_estado := 'visitado';
  end if;

  update public.requerimientos
  set estado = nuevo_estado, updated_at = now()
  where id = req_id;

  return new;
end;
$$;

create trigger trg_sync_estado_requerimiento_agenda
after insert or update of estado_agenda on public.agenda_operativa
for each row execute function public.sync_estado_requerimiento_desde_agenda();

create trigger trg_sync_estado_requerimiento_reporte
after insert or update on public.reportes_visita
for each row execute function public.sync_estado_requerimiento_desde_reporte();

alter table public.requerimientos enable row level security;
alter table public.agenda_operativa enable row level security;
alter table public.reportes_visita enable row level security;
alter table public.reporte_visita_fotos enable row level security;

create policy "admins_manage_requerimientos"
on public.requerimientos
for all
using (public.current_user_role() = 'administrador')
with check (public.current_user_role() = 'administrador');

create policy "tecnicos_read_requerimientos_asignados"
on public.requerimientos
for select
using (
  exists (
    select 1
    from public.agenda_operativa ao
    where ao.requerimiento_id = requerimientos.id
      and ao.tecnico_id = auth.uid()
  )
);

create policy "clientes_read_requerimientos_propios"
on public.requerimientos
for select
using (cliente_id = public.current_user_client_id());

create policy "admins_manage_agenda_operativa"
on public.agenda_operativa
for all
using (public.current_user_role() = 'administrador')
with check (public.current_user_role() = 'administrador');

create policy "tecnicos_read_update_agenda_asignada"
on public.agenda_operativa
for update
using (tecnico_id = auth.uid())
with check (tecnico_id = auth.uid());

create policy "tecnicos_read_agenda_asignada"
on public.agenda_operativa
for select
using (tecnico_id = auth.uid());

create policy "admins_manage_reportes_visita"
on public.reportes_visita
for all
using (public.current_user_role() = 'administrador')
with check (public.current_user_role() = 'administrador');

create policy "tecnicos_manage_reportes_visita_agenda_asignada"
on public.reportes_visita
for all
using (
  exists (
    select 1 from public.agenda_operativa ao
    where ao.id = reportes_visita.agenda_id
      and ao.tecnico_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.agenda_operativa ao
    where ao.id = reportes_visita.agenda_id
      and ao.tecnico_id = auth.uid()
  )
);

create policy "admins_manage_reporte_visita_fotos"
on public.reporte_visita_fotos
for all
using (public.current_user_role() = 'administrador')
with check (public.current_user_role() = 'administrador');

create policy "tecnicos_manage_reporte_visita_fotos"
on public.reporte_visita_fotos
for all
using (
  exists (
    select 1
    from public.reportes_visita rv
    join public.agenda_operativa ao on ao.id = rv.agenda_id
    where rv.id = reporte_visita_fotos.reporte_visita_id
      and ao.tecnico_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.reportes_visita rv
    join public.agenda_operativa ao on ao.id = rv.agenda_id
    where rv.id = reporte_visita_fotos.reporte_visita_id
      and ao.tecnico_id = auth.uid()
  )
);

insert into public.requerimientos (
  codigo_requerimiento,
  cliente_id,
  inmueble_id,
  contacto_nombre,
  contacto_telefono,
  descripcion,
  canal_ingreso,
  tipo_servicio,
  prioridad,
  estado,
  fecha_reporte,
  observaciones_internas
)
select
  'REQ-DEMO-0001',
  c.id,
  p.id,
  coalesce(c.contact_name, 'Contacto demo'),
  c.contact_phone,
  'Requerimiento de ejemplo para validar flujo operativo.',
  'WhatsApp',
  'visita_diagnostico',
  'media',
  'pendiente',
  current_date,
  'Generado automáticamente como dato semilla mínimo.'
from public.clients c
join public.properties p on p.client_id = c.id
order by c.created_at
limit 1
on conflict (codigo_requerimiento) do nothing;
