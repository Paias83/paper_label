-- Fix 1: "cadastro completo" vira uma coluna explícita em vez de inferir
-- por cpf is not null (quebrava login de contas antigas, sem CPF, que já
-- tinham senha de verdade).
-- Fix 2: profiles.email (espelho de auth.users) + policy de admin ver
-- todos os perfis, pra dar busca de cliente cadastrado no pedido manual.
-- Rode via: supabase db query --linked -f supabase/add-registration-completed-and-customer-search.sql

alter table profiles add column if not exists registration_completed boolean not null default true;
alter table profiles add column if not exists email text;

update profiles p set email = u.email
from auth.users u
where u.id = p.id and p.email is null;

-- Contas criadas pelo fluxo novo (a partir do deploy do commit 9b0f04f,
-- 2026-09-14 20:58:11 -03) que ainda não terminaram o cadastro continuam
-- com senha descartável — precisam ficar como incompletas mesmo com o
-- "default true" acima cobrindo as contas antigas.
update profiles p set registration_completed = false
from auth.users u
where u.id = p.id
  and p.cpf is null
  and u.created_at >= '2026-09-14 23:58:11+00';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, role, email, registration_completed)
  values (new.id, new.raw_user_meta_data->>'name', 'cliente', new.email, false);
  return new;
end;
$$;

create or replace function public.email_status(p_email text)
returns table (exists_account boolean, complete boolean)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    exists(select 1 from auth.users u where u.email = p_email),
    exists(
      select 1 from auth.users u
      join public.profiles p on p.id = u.id
      where u.email = p_email and p.registration_completed = true
    );
end;
$$;

create policy "admin ve todos os perfis" on profiles
  for select using (
    exists (select 1 from profiles p2 where p2.id = auth.uid() and p2.role = 'admin')
  );
