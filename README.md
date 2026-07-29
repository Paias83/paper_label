# Studio Paper — scaffold inicial

Loja de papelaria de luxo: catálogo, carrinho, cadastro de usuário, checkout
com Mercado Pago e painel administrativo para gestão de produtos e pedidos.

## Stack
- React + Vite + TypeScript
- Supabase (Postgres + Auth + Storage + Edge Functions)
- Mercado Pago (Checkout Pro)

## Como rodar

1. Crie um projeto em https://supabase.com
2. No SQL Editor do Supabase, rode o conteúdo de `supabase/schema.sql`
3. Copie `.env.example` para `.env` e preencha com a URL e a anon key
   do seu projeto (em Project Settings > API)
4. Instale as dependências e rode:
   ```bash
   npm install
   npm run dev
   ```
5. Para virar administrador, cadastre-se pela tela `/entrar` e depois,
   no SQL Editor do Supabase, rode:
   ```sql
   update profiles set role = 'admin' where id = 'admin';
   ```
   (o `user_id` aparece em Authentication > Users)

## Pagamento (Mercado Pago)

1. Crie uma aplicação em https://www.mercadopago.com.br/developers
2. Pegue o Access Token de produção
3. Configure o secret e faça o deploy da function:
   ```bash
   supabase secrets set MP_ACCESS_TOKEN=seu_token
   supabase functions deploy create-preference
   ```
4. Depois, crie uma segunda function pra receber o **webhook** do Mercado
   Pago (`notification_url`) e atualizar `orders.status` para `'pago'`
   quando o pagamento for aprovado — isso ainda não está neste scaffold.

## Estrutura

```
src/
  pages/store/    → páginas públicas da loja
  pages/admin/     → painel administrativo
  context/         → estado do carrinho
  lib/supabase.ts  → cliente Supabase + tipos
supabase/
  schema.sql               → tabelas + RLS
  functions/create-preference/ → integração Mercado Pago
```

## Próximos passos sugeridos
- Tela de "meus pedidos" pro cliente
- Webhook de confirmação de pagamento
- Filtro por categoria no catálogo
- Formulário de endereço no checkout
- Proteção de rota do `/admin` (redirecionar se não for admin)
- Página de sucesso/falha de pagamento (`/checkout/sucesso`, etc.)
