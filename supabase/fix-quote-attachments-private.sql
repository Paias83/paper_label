-- Anexos de orçamento privados (LGPD). Antes o bucket "quote-attachments" era
-- público: qualquer pessoa com o link abria o arquivo do cliente.
--
-- Novo formato: cada arquivo fica na pasta do cliente do orçamento
-- (`<user_id>/<arquivo>`), o bucket é privado e as telas usam link temporário
-- (src/lib/quoteAttachments.ts). Cliente vê/envia só na própria pasta; admin, em todas.
--
-- ORDEM PARA APLICAR (feita em 2026-10-11):
--   1. publicar o front que entende caminho e link antigo (AttachmentImage);
--   2. mover os arquivos antigos da raiz para a pasta do cliente, ex.:
--        npx supabase storage mv --experimental --linked \
--          "ss:///quote-attachments/<arquivo>" "ss:///quote-attachments/<user_id>/<arquivo>"
--   3. rodar este script:
--        npx supabase db query --linked -f supabase/fix-quote-attachments-private.sql

-- Mensagens: troca o link público pelo caminho na pasta do cliente.
-- (Os nomes antigos só tinham espaço codificado como %20.)
update public.quote_messages m
set images = (
  select array_agg(
    case
      when img like 'http%'
        then qr.user_id::text || '/' || replace(regexp_replace(img, '^.*/quote-attachments/', ''), '%20', ' ')
      else img
    end
    order by ord
  )
  from unnest(m.images) with ordinality as t(img, ord)
)
from public.quote_requests qr
where qr.id = m.quote_request_id
  and exists (select 1 from unnest(m.images) img where img like 'http%');

-- Bucket privado.
update storage.buckets set public = false where id = 'quote-attachments';

-- Regras de acesso: pasta do próprio cliente ou admin (public.is_admin(), security definer).
drop policy if exists "participante envia anexo de orcamento" on storage.objects;
drop policy if exists "cliente envia anexo na propria pasta" on storage.objects;
drop policy if exists "cliente ve anexo da propria pasta" on storage.objects;

create policy "cliente envia anexo na propria pasta" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'quote-attachments'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

create policy "cliente ve anexo da propria pasta" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'quote-attachments'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );
