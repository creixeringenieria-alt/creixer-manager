-- Ejecutar solo después de crear los usuarios en Supabase Auth.
-- Reemplaza los correos por los correos reales usados en Auth.

with base as (
  select *
  from (
    values
      ('correo.maria@dominio.com', 'María Piedad Rodríguez Sánchez', 'contable', 'colaborador_creixer', 'Creixer Ingeniería S.A.S.', 'Cédula de ciudadanía', '51723682', '3227415601'),
      ('correo.marco@dominio.com', 'Marco Alejandro Gamboa Gamboa', 'almacen', 'colaborador_creixer', 'Creixer Ingeniería S.A.S.', 'Cédula de ciudadanía', '79278636', '3156217548'),
      ('correo.adriana@dominio.com', 'Adriana Camila Reyes', 'administrativo', 'colaborador_creixer', 'Creixer Ingeniería S.A.S.', 'Cédula de ciudadanía', '1010200954', '3133725350'),
      ('correo.carlos@dominio.com', 'Carlos Eduardo Parra Muñoz', 'tecnico', 'colaborador_creixer', 'Creixer Ingeniería S.A.S.', 'Permiso Temporal de Permanencia', '24573427', '3209850701'),
      ('correo.jhoan@dominio.com', 'Jhoan Sebastian Rodriguez Borda', 'gerente_operativo', 'colaborador_creixer', 'Creixer Ingeniería S.A.S.', 'Cédula de ciudadanía', '1001342792', '3223150784')
  ) as t(email, full_name, role, user_type, organization_name, document_type, document_number, phone)
),
auth_match as (
  select u.id, b.*
  from base b
  join auth.users u on lower(u.email) = lower(b.email)
)
insert into public.profiles (id, full_name, role, user_type, organization_name, document_type, document_number, phone, is_active)
select
  id,
  full_name,
  role::text,
  user_type,
  organization_name,
  document_type,
  document_number,
  phone,
  true
from auth_match
on conflict (id) do update
set
  full_name = excluded.full_name,
  role = excluded.role,
  user_type = excluded.user_type,
  organization_name = excluded.organization_name,
  document_type = excluded.document_type,
  document_number = excluded.document_number,
  phone = excluded.phone,
  is_active = excluded.is_active,
  updated_at = now();

-- Consulta de validación:
-- select id, full_name, role, document_type, document_number, phone, is_active
-- from public.profiles
-- where document_number in ('51723682','79278636','1010200954','24573427','1001342792');
