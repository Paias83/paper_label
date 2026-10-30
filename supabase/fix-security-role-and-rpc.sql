-- Correções de segurança (auditoria de 2026-10-30).
--
-- 1) A policy "usuario edita proprio perfil" deixa o cliente dar UPDATE em
--    qualquer coluna da própria linha — inclusive role. Bastava um
--    supabase.from('profiles').update({ role: 'admin' }) no console do navegador
--    para virar admin (ver todos os clientes, mexer em pedidos/produtos, comprar
--    etiqueta com o saldo do Melhor Envio). O trigger abaixo barra a troca de
--    role / created_by_admin / email quando quem pede é o próprio usuário
--    (papéis anon/authenticated do PostgREST). Service role, functions
--    security definer e o SQL Editor continuam podendo.
--
-- 2) fulfill_order() é security definer e estava executável por anon e
--    authenticated (o "revoke ... from public" não basta: o Supabase dá grant
--    direto a esses papéis). Qualquer um com o id de um pedido podia chamar a
--    RPC várias vezes e zerar o estoque / inflar as necessidades de compra.
--    Só as Edge Functions (service role) chamam essa função.
--
-- Idempotente.

create or replace function public.protect_profile_privileged_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('anon', 'authenticated') and (
       new.role is distinct from old.role
    or new.created_by_admin is distinct from old.created_by_admin
    or new.email is distinct from old.email
  ) then
    raise exception 'Alteração não permitida neste campo do perfil'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_privileged_columns on public.profiles;
create trigger protect_profile_privileged_columns
  before update on public.profiles
  for each row execute function public.protect_profile_privileged_columns();

revoke all on function public.fulfill_order(uuid) from public, anon, authenticated;
grant execute on function public.fulfill_order(uuid) to service_role;
