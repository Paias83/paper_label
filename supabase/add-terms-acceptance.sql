-- Registro do aceite dos Termos de Uso e da Política de Privacidade (LGPD).
-- Gravado em CompleteRegistration.tsx quando o cliente marca a caixa de aceite.
-- Contas anteriores a 2026-10-11 ficam com nulo. Idempotente.
--
--   npx supabase db query --linked -f supabase/add-terms-acceptance.sql

alter table public.profiles add column if not exists terms_accepted_at timestamptz;
