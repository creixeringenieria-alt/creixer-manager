-- Responsable interno asignado al caso/proyecto operativo.
-- Solo almacena usuarios internos de Creixer; la interfaz filtra por profiles.user_type = 'colaborador_creixer'.

alter table public.cases
  add column if not exists assigned_to_user_id uuid references public.profiles(id) on delete set null;

create index if not exists idx_cases_assigned_to_user_id
  on public.cases(assigned_to_user_id);

notify pgrst, 'reload schema';
