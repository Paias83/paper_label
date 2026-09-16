-- Corrige "infinite recursion detected in policy for relation profiles"
-- (erro 42P17) causado pela policy "admin ve todos os perfis" consultando
-- a própria tabela profiles dentro do USING dela. Fix padrão: function
-- security definer, que roda ignorando RLS, quebrando a recursão.

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists(select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

drop policy if exists "admin ve todos os perfis" on profiles;
create policy "admin ve todos os perfis" on profiles
  for select using (is_admin());
