-- Creixer Manager - Initial schema
-- Date: 2026-03-06

create extension if not exists "pgcrypto";

create type public.app_role as enum ('administrador', 'tecnico', 'cliente');
create type public.request_priority as enum ('baja', 'media', 'alta', 'critica');
create type public.request_status as enum ('nuevo', 'asignado', 'en_diagnostico', 'cotizado', 'aprobado', 'en_ejecucion', 'cerrado', 'cancelado');
create type public.quote_status as enum ('borrador', 'enviada', 'aprobada', 'rechazada');
create type public.work_order_status as enum ('pendiente', 'programada', 'en_progreso', 'pausada', 'completada', 'cancelada');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tax_id text,
  contact_name text,
  contact_email text,
  contact_phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'cliente',
  full_name text,
  client_id uuid references public.clients(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null,
  code text,
  address text,
  city text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.maintenance_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  property_id uuid not null references public.properties(id) on delete restrict,
  created_by uuid not null references public.profiles(id) on delete restrict,
  assigned_technician_id uuid references public.profiles(id) on delete set null,
  title text not null,
  description text not null,
  priority public.request_priority not null default 'media',
  status public.request_status not null default 'nuevo',
  requested_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.technical_diagnostics (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.maintenance_requests(id) on delete cascade,
  technician_id uuid not null references public.profiles(id) on delete restrict,
  findings text not null,
  recommendations text,
  estimated_hours numeric(10,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.maintenance_requests(id) on delete cascade,
  diagnostic_id uuid references public.technical_diagnostics(id) on delete set null,
  status public.quote_status not null default 'borrador',
  currency text not null default 'COP',
  subtotal numeric(12,2) not null default 0,
  tax numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  valid_until date,
  notes text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  description text not null,
  quantity numeric(10,2) not null default 1,
  unit_price numeric(12,2) not null default 0,
  line_total numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.work_orders (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.maintenance_requests(id) on delete cascade,
  quote_id uuid references public.quotes(id) on delete set null,
  assigned_technician_id uuid references public.profiles(id) on delete set null,
  status public.work_order_status not null default 'pendiente',
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  notes text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.photo_evidences (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.maintenance_requests(id) on delete cascade,
  diagnostic_id uuid references public.technical_diagnostics(id) on delete set null,
  work_order_id uuid references public.work_orders(id) on delete set null,
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  storage_path text not null,
  description text,
  taken_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_profiles_client_id on public.profiles(client_id);
create index idx_properties_client_id on public.properties(client_id);
create index idx_requests_client_id on public.maintenance_requests(client_id);
create index idx_requests_property_id on public.maintenance_requests(property_id);
create index idx_requests_assigned_technician on public.maintenance_requests(assigned_technician_id);
create index idx_requests_status on public.maintenance_requests(status);
create index idx_diagnostics_request_id on public.technical_diagnostics(request_id);
create index idx_quotes_request_id on public.quotes(request_id);
create index idx_quote_items_quote_id on public.quote_items(quote_id);
create index idx_work_orders_request_id on public.work_orders(request_id);
create index idx_work_orders_assigned_technician on public.work_orders(assigned_technician_id);
create index idx_evidences_request_id on public.photo_evidences(request_id);
create index idx_evidences_work_order_id on public.photo_evidences(work_order_id);

create trigger set_clients_updated_at
before update on public.clients
for each row execute function public.set_updated_at();

create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger set_properties_updated_at
before update on public.properties
for each row execute function public.set_updated_at();

create trigger set_requests_updated_at
before update on public.maintenance_requests
for each row execute function public.set_updated_at();

create trigger set_diagnostics_updated_at
before update on public.technical_diagnostics
for each row execute function public.set_updated_at();

create trigger set_quotes_updated_at
before update on public.quotes
for each row execute function public.set_updated_at();

create trigger set_quote_items_updated_at
before update on public.quote_items
for each row execute function public.set_updated_at();

create trigger set_work_orders_updated_at
before update on public.work_orders
for each row execute function public.set_updated_at();

create or replace function public.current_user_role()
returns public.app_role
language sql
stable
as $$
  select p.role from public.profiles p where p.id = auth.uid();
$$;

create or replace function public.current_user_client_id()
returns uuid
language sql
stable
as $$
  select p.client_id from public.profiles p where p.id = auth.uid();
$$;

alter table public.clients enable row level security;
alter table public.profiles enable row level security;
alter table public.properties enable row level security;
alter table public.maintenance_requests enable row level security;
alter table public.technical_diagnostics enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;
alter table public.work_orders enable row level security;
alter table public.photo_evidences enable row level security;

create policy "admins_manage_clients"
on public.clients
for all
using (public.current_user_role() = 'administrador')
with check (public.current_user_role() = 'administrador');

create policy "admins_manage_profiles"
on public.profiles
for all
using (public.current_user_role() = 'administrador')
with check (public.current_user_role() = 'administrador');

create policy "users_read_own_profile"
on public.profiles
for select
using (id = auth.uid());

create policy "users_update_own_profile"
on public.profiles
for update
using (id = auth.uid())
with check (id = auth.uid());

create policy "admins_manage_properties"
on public.properties
for all
using (public.current_user_role() = 'administrador')
with check (public.current_user_role() = 'administrador');

create policy "clients_read_their_properties"
on public.properties
for select
using (client_id = public.current_user_client_id());

create policy "technicians_read_assigned_properties"
on public.properties
for select
using (
  exists (
    select 1
    from public.maintenance_requests mr
    where mr.property_id = properties.id
      and mr.assigned_technician_id = auth.uid()
  )
);

create policy "admins_manage_requests"
on public.maintenance_requests
for all
using (public.current_user_role() = 'administrador')
with check (public.current_user_role() = 'administrador');

create policy "clients_create_read_requests"
on public.maintenance_requests
for select
using (client_id = public.current_user_client_id());

create policy "clients_insert_requests"
on public.maintenance_requests
for insert
with check (
  public.current_user_role() = 'cliente'
  and client_id = public.current_user_client_id()
  and created_by = auth.uid()
);

create policy "technicians_read_update_assigned_requests"
on public.maintenance_requests
for update
using (assigned_technician_id = auth.uid())
with check (assigned_technician_id = auth.uid());

create policy "technicians_read_assigned_requests"
on public.maintenance_requests
for select
using (assigned_technician_id = auth.uid());

create policy "admins_manage_diagnostics"
on public.technical_diagnostics
for all
using (public.current_user_role() = 'administrador')
with check (public.current_user_role() = 'administrador');

create policy "technicians_manage_own_diagnostics"
on public.technical_diagnostics
for all
using (technician_id = auth.uid())
with check (technician_id = auth.uid());

create policy "clients_read_diagnostics_for_their_requests"
on public.technical_diagnostics
for select
using (
  exists (
    select 1 from public.maintenance_requests mr
    where mr.id = technical_diagnostics.request_id
      and mr.client_id = public.current_user_client_id()
  )
);

create policy "admins_manage_quotes"
on public.quotes
for all
using (public.current_user_role() = 'administrador')
with check (public.current_user_role() = 'administrador');

create policy "clients_read_quotes_for_their_requests"
on public.quotes
for select
using (
  exists (
    select 1 from public.maintenance_requests mr
    where mr.id = quotes.request_id
      and mr.client_id = public.current_user_client_id()
  )
);

create policy "admins_manage_quote_items"
on public.quote_items
for all
using (public.current_user_role() = 'administrador')
with check (public.current_user_role() = 'administrador');

create policy "clients_read_quote_items"
on public.quote_items
for select
using (
  exists (
    select 1
    from public.quotes q
    join public.maintenance_requests mr on mr.id = q.request_id
    where q.id = quote_items.quote_id
      and mr.client_id = public.current_user_client_id()
  )
);

create policy "admins_manage_work_orders"
on public.work_orders
for all
using (public.current_user_role() = 'administrador')
with check (public.current_user_role() = 'administrador');

create policy "technicians_read_update_assigned_work_orders"
on public.work_orders
for update
using (assigned_technician_id = auth.uid())
with check (assigned_technician_id = auth.uid());

create policy "technicians_read_assigned_work_orders"
on public.work_orders
for select
using (assigned_technician_id = auth.uid());

create policy "clients_read_work_orders"
on public.work_orders
for select
using (
  exists (
    select 1
    from public.maintenance_requests mr
    where mr.id = work_orders.request_id
      and mr.client_id = public.current_user_client_id()
  )
);

create policy "admins_manage_photo_evidences"
on public.photo_evidences
for all
using (public.current_user_role() = 'administrador')
with check (public.current_user_role() = 'administrador');

create policy "technicians_manage_own_evidences"
on public.photo_evidences
for all
using (uploaded_by = auth.uid())
with check (uploaded_by = auth.uid());

create policy "clients_read_evidences"
on public.photo_evidences
for select
using (
  exists (
    select 1
    from public.maintenance_requests mr
    where mr.id = photo_evidences.request_id
      and mr.client_id = public.current_user_client_id()
  )
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name)
  values (
    new.id,
    coalesce((new.raw_user_meta_data ->> 'role')::public.app_role, 'cliente'),
    new.raw_user_meta_data ->> 'full_name'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

insert into storage.buckets (id, name, public)
values ('evidences', 'evidences', false)
on conflict (id) do nothing;

create policy "authenticated_can_upload_evidences"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'evidences'
  and owner = auth.uid()
);

create policy "authenticated_can_read_evidences"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'evidences'
);

create policy "owners_can_update_evidences"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'evidences'
  and owner = auth.uid()
)
with check (
  bucket_id = 'evidences'
  and owner = auth.uid()
);

create policy "owners_can_delete_evidences"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'evidences'
  and owner = auth.uid()
);
