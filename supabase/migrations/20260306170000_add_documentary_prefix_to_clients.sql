alter table public.clients
add column if not exists documentary_prefix text;

create unique index if not exists idx_clients_documentary_prefix_unique
on public.clients (documentary_prefix)
where documentary_prefix is not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'clients_documentary_prefix_format_chk'
  ) then
    alter table public.clients
    add constraint clients_documentary_prefix_format_chk
    check (
      documentary_prefix is null
      or documentary_prefix ~ '^[A-Z0-9-]{2,12}$'
    );
  end if;
end
$$;
