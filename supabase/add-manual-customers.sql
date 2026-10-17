-- Clientes cadastrados pelo admin (vendas por telefone/presencial).
-- A conta é criada de verdade (auth.users + profiles) pela Edge Function
-- save-customer, já com e-mail confirmado e sem senha. O perfil fica com
-- registration_completed = false: quando o cliente entrar no site pela
-- primeira vez, o /entrar manda o link de "continuar cadastro" e ele mesmo
-- cria a senha e aceita os termos (terms_accepted_at fica por conta dele).
-- Rode isto no SQL Editor do Supabase (idempotente).

-- Só informativo: mostra na lista de clientes quem foi cadastrado pelo painel.
alter table profiles
  add column if not exists created_by_admin boolean not null default false;
