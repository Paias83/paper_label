-- Cadastro em duas etapas: CPF no perfil + checagem de e-mail duplicado
-- sem expor auth.users via PostgREST.
-- Rode isto no SQL Editor do Supabase (ou via supabase db query --linked -f).

alter table profiles add column if not exists cpf text;
create unique index if not exists profiles_cpf_unique on profiles (cpf) where cpf is not null;
alter table profiles add column if not exists phone text;

-- Usada pela tela de login/cadastro (com a chave anon, sem sessão) pra saber
-- se um e-mail já tem cadastro completo (vira tela de login) ou precisa
-- receber o e-mail de confirmação (novo ou cadastro incompleto).
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
      where u.email = p_email and p.cpf is not null
    );
end;
$$;

grant execute on function public.email_status(text) to anon, authenticated;
