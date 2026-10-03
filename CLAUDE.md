# Studio Paper (papelaria-luxo)

Loja online de papelaria de luxo com painel administrativo: catálogo, carrinho,
checkout Mercado Pago, frete, orçamentos de produtos personalizados, pedidos
manuais e gestão de produção/estoque de matéria-prima.

- **Em produção**: https://www.studiopaper.com.br (apex redireciona 308 para `www`)
- Repositório: https://github.com/Paias83/paper_label (**público** — nunca commitar
  secrets, tokens ou dados pessoais), branch `main`
- Deploy do front: Vercel, **automático a cada push na `main`**
  (`vercel.json` reescreve tudo para `index.html`; env vars `VITE_SUPABASE_*` já
  configuradas na Vercel)
- Backend: Supabase, projeto `paper_db` (ref `yzbgjhstwylnmhquxalq`)
- Domínio registrado no **Registro.br** (DNS lá, não na Vercel)
- Loja com **um único admin** (o dono) usando o painel
- Idioma: todo o projeto (UI, comentários, commits) é em **português do Brasil**

## Stack

- React 18 + Vite 5 + TypeScript, `react-router-dom` v6
- `@supabase/supabase-js` (Postgres + Auth + Storage + Edge Functions em Deno)
- `lucide-react` (ícones), `embla-carousel-react` (carrossel de destaques)
- CSS puro em `src/styles/global.css` com tokens de design em `:root`
  (sem Tailwind / CSS-in-JS)

## Comandos

```bash
npm install
npm run dev       # servidor local (Vite)
npm run build     # tsc -b && vite build
npx tsc -b        # checar tipos
```

Não há testes automatizados nem linter configurado.

## Estrutura

```
src/
  App.tsx              rotas (loja pública + /admin)
  context/             AuthContext (sessão + profile), CartContext
  lib/supabase.ts      cliente Supabase (flowType 'pkce') + tipos das tabelas
  lib/                 helpers: cpf, formNav, orderStatus, quoteStatus
  components/          header, footer, AddressForm, CurrencyInput, DeliveryMethodPicker...
  pages/store/         loja: Home, Catalog, ProductPage, Cart, Login,
                       CompleteRegistration, MyOrders, MyQuotes, QuoteThread...
  pages/admin/         painel: produtos, categorias, pedidos (+ OrderForm, OrderPrint),
                       orçamentos, fornecedores, estoque (materiais, movimentações,
                       necessidades de compra), ProductionModal
supabase/
  schema.sql           schema base (tabelas + RLS)
  add-*.sql / fix-*.sql migrações incrementais (ver abaixo)
  functions/           Edge Functions (Deno)
```

**Não existe página de checkout separada**: endereço, frete, totais e botão de pagar
ficam dentro de `src/pages/store/Cart.tsx` (`/carrinho`). O antigo `Checkout.tsx` foi
removido.

## Edge Functions (`supabase/functions/`)

| Função | O que faz | Secrets |
|---|---|---|
| `create-preference` | cria pedido `pendente` + preferência no Mercado Pago (Checkout Pro); exige `shipping`/`address` no body quando é entrega | `MP_ACCESS_TOKEN` |
| `create-quote-order` | igual à anterior, mas a partir de orçamento aprovado | `MP_ACCESS_TOKEN` |
| `mp-webhook` | notificação do MP → atualiza status e chama `fulfill_order` | `MP_ACCESS_TOKEN` |
| `calculate-shipping` | cotação no Melhor Envio (peso/medidas lidos do banco, nunca do cliente) | `MELHOR_ENVIO_TOKEN`, `STORE_ORIGIN_CEP` |
| `create-manual-order` / `update-manual-order` | pedido manual do admin (checam `role='admin'` pelo JWT) | — |
| `send-order-status-email` | admin-only; chamada por `Orders.tsx` ao mudar status | `RESEND_API_KEY` |
| `_shared/orderEmail.ts` | `sendOrderStatusEmail(admin, order)` via API HTTP do Resend | |

Todas também usam `SUPABASE_URL`, `SUPABASE_ANON_KEY` e/ou `SUPABASE_SERVICE_ROLE_KEY`.
O CLI já está linkado ao projeto. Deploy:

```bash
npx supabase functions deploy <nome> --project-ref yzbgjhstwylnmhquxalq --use-api
npx supabase functions deploy mp-webhook --project-ref yzbgjhstwylnmhquxalq --use-api --no-verify-jwt
npx supabase secrets list
```

`mp-webhook` precisa de `--no-verify-jwt` (o Mercado Pago chama sem JWT). A
`notification_url` é montada dinamicamente em `create-preference`, então não há nada
a configurar no painel do MP. Em problemas de pagamento/pedido, olhar primeiro os
logs das Edge Functions no dashboard do Supabase.

## Banco de dados / migrações

- Não há pasta `supabase/migrations`: cada mudança de schema vira um arquivo
  `supabase/add-<feature>.sql` ou `fix-<problema>.sql` (idempotente quando possível).
  `supabase db push` **não enxerga** esses arquivos (diz "up to date" mesmo sem rodar).
  Para aplicar em produção:
  ```bash
  npx supabase db query --linked -f supabase/<arquivo>.sql
  npx supabase db query --linked "select column_name, data_type from information_schema.columns where table_name = '<tabela>';"
  ```
  (ou colar no SQL Editor: https://supabase.com/dashboard/project/yzbgjhstwylnmhquxalq/sql/new)
- Atualize os tipos em `src/lib/supabase.ts` junto com o schema.
- Papéis: `profiles.role` = `'cliente' | 'admin'`, checado em `AdminLayout.tsx`.
  Como promover admin: `supabase/como-promover-admin.txt`.
- `profiles.email` é cópia desnormalizada de `auth.users.email` (mantida por
  `handle_new_user()`), usada na busca de clientes — o client não consegue consultar
  `auth.users`. Para "esse e-mail já tem conta?", usar a RPC `email_status(email)`.

### RLS — armadilhas já vividas

- **Nunca** escreva policy em `profiles` que consulte `profiles` no próprio `USING`:
  causa `42P17 infinite recursion` em **todo** select da tabela e quebra login, header
  e cadastro no site inteiro. Use a função `public.is_admin()` (`security definer`,
  ver `fix-profiles-admin-policy-recursion.sql`). Nas outras tabelas a subquery em
  `profiles` é segura.
- `supabase db query` roda como superuser e **ignora RLS**. Para reproduzir um bug de
  RLS, no mesmo script: `set local role authenticated; set local request.jwt.claims =
  '{"sub":"<uuid>","role":"authenticated"}';` antes da query.

## Domínio (termos usados no código)

- **Pedido** (`orders`): `source` = `loja` | `manual`; `shipping_type` = `entrega` |
  `retirada`; status: `pendente`, `pago`, `enviado`, `entregue`,
  `pronto_para_retirada`, `retirado`, `cancelado` (rótulos em `lib/orderStatus.ts`).
  Pedidos de retirada usam `pronto_para_retirada`/`retirado` no lugar de
  `enviado`/`entregue` e não têm código de rastreio.
- **Sinalização no admin**: `orders.admin_seen_at` nulo = pedido novo/alterado (badge
  vermelho em "Pedidos"); `last_status_change_by` = `'sistema'` (MP) ou `'admin'`.
  Badges são carregados ao montar a página (sem Realtime).
- **`fulfill_order` (RPC)**: dá baixa em estoque pronto, empenha matéria-prima ou gera
  `purchase_needs`. É chamada pelo `mp-webhook` e pelos pedidos manuais salvos como
  `pago`. **Sempre reusar — nunca recriar essa lógica.** Itens sem `product_id`
  (personalizados) são ignorados por ela.
- **Itens do pedido**: `fulfillment_status` = `estoque_pronto` | `empenhado` |
  `aguardando_compra` | `personalizado`.
- **Pedido manual**: vendas por telefone/presencial. Pode ou não ter cliente vinculado
  (`user_id`; sem ele não sai e-mail). Seletor lista também produtos inativos. Só é
  editável quando `source='manual'` **e** `status='pendente'`; depois de pago, só
  cancelando e recriando (editar dessincronizaria o estoque).
- **Ficha técnica**: `product_materials` liga produto → matéria-prima (`raw_materials`);
  produção (`product_productions`) baixa material via `stock_movements`.
  `MaterialQuickForm` cadastra matéria-prima de dentro do `ProductForm`.
- **Preço por margem**: `products.margin_percent` ligado → preço = `custo × (1+%/100)`
  travado; `NULL` = preço manual.
- **Categorias**: `categories.active = false` = categoria **interna** (não aparece na
  loja, mas continua disponível no ProductForm/pedido manual). Categoria
  `personalizados` troca "Adicionar ao carrinho" por "Solicitar orçamento".
- **Orçamento** (`quote_requests` + `quote_messages`, anexos no bucket público
  `quote-attachments`): conversa cliente/admin com proposta de preço e frete; aprovado
  vira pedido via `create-quote-order`.
- **Cadastro em duas etapas**: `/entrar` pede só o e-mail → `email_status()` decide
  login ou envio de confirmação → `/completar-cadastro` (nome, CPF validado em
  `lib/cpf.ts`, telefone, endereço, senha) → desloga e volta para `/entrar` com o
  e-mail preenchido (pedido explícito do dono). O sinal de cadastro completo é
  `profiles.registration_completed` (não `cpf is not null` — contas antigas não têm CPF).
- **Excluir produto**: tenta DELETE; se a FK barrar (`23503`), oferece arquivar
  (`archived=true, active=false`). Duplicidade barrada por índices únicos
  normalizados (`add-duplicate-guards.sql`, erro `23505` tratado nos forms).

## E-mails

- **Auth do Supabase** (confirmação, senha): SMTP do Resend, remetente
  `noreply@studiopaper.com.br`. Se a confirmação não chegar, conferir nesta ordem:
  (1) toggle "Confirm email" em Authentication → Providers → Email está ON;
  (2) log de e-mails do Resend mostra tentativa; (3) "bounced" = endereço errado.
- **Status de pedido**: API HTTP do Resend (`RESEND_API_KEY`), enviado a cada mudança
  de status, remetente `contato@studiopaper.com.br`.
- `contato@studiopaper.com.br` é uma caixa real no Zoho Mail (plano grátis, só webmail).
- PKCE (`flowType: 'pkce'`) é obrigatório: o pré-fetch de links do Gmail/Outlook
  consumia o token implicit e o usuário caía em `otp_expired`. Esse bug não reproduz
  com `curl`, só com caixa de e-mail real.
- DNS no Registro.br: o editor não edita registro no lugar — apagar o antigo e criar o
  novo antes de um único "Salvar alterações". Não aceita `@` como nome (usar o domínio
  completo).

## Convenções e decisões

- Público-alvo do admin é leigo: formulários usam `advanceOnEnter` (`lib/formNav.ts`)
  para Enter ir ao próximo campo em vez de salvar.
- Valores monetários em R$ com `CurrencyInput`; preços/quantidades usam `--font-mono`.
- Folha de pedido A4 (`OrderPrint.tsx`) usa CSS `@page` + `window.print()` — sem
  biblioteca de PDF.
- Design "papel/lacre": marfim + vinho (`--wine`), cantos quase retos (`--radius: 2px`).
  Evitar visual genérico bege/terracota. Carrinho e admin usam o mesmo estilo de
  cartões/inputs (`.store-form`, `.shipping-option`, `.checkout-summary`).
- Fonte do logo **July It** fica em `public/fonts/`, que está no `.gitignore`
  (licença só para uso pessoal, aguardando licença comercial; o repo é público).
  Ela **não vem no clone** — copiar manualmente para novos computadores.
- Retirada no local: endereço e horário fixos em `PICKUP_INFO`, **duplicado** em
  `components/DeliveryMethodPicker.tsx` e `supabase/functions/_shared/orderEmail.ts`
  (se mudar, alterar nos dois e redeployar as functions de e-mail). Frete grátis na retirada; o MP rejeita
  item de preço 0, então a linha "Frete" não é enviada nesse caso.
- Produtos sem peso/medidas reais usam pacote genérico (0,3 kg, 16×4×16 cm) — se um
  frete parecer errado, conferir as medidas do produto.

## Ambiente

`.env` (não versionado; mesmo conteúdo do `.env.example`):
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (chave publishable, pública).

## Pendências e próximos passos

- **Páginas de retorno do pagamento**: `create-preference` manda o Mercado Pago
  voltar para `/checkout/sucesso`, `/checkout/falha` e `/checkout/pendente`, mas
  essas rotas não existem em `App.tsx`.
- **Checkout Bricks (planejado)**: trocar o redirecionamento do Checkout Pro pelo
  formulário de pagamento embutido no `Cart.tsx` (cartão/Pix/boleto sem sair do site).
  Exige SDK do Bricks no front e criar o pagamento pela Payments API; resolveria
  também as páginas de retorno. Conferir se o `mp-webhook` continua funcionando.
- **E-mails de orçamento (planejado)**: avisos por e-mail nas etapas do orçamento
  (nova mensagem do admin, proposta enviada, cliente respondeu). Pontos de disparo:
  `QuoteThread.tsx` do admin (`handleSend`) e do cliente (`sendReply`,
  `handlePedirAjuste`). Reusar o padrão de `_shared/orderEmail.ts`.
- Filtro por categoria fica na Home (`/?categoria=slug`); `/catalogo` só redireciona.
- Instagram ativo na TopBar; TikTok removido até existir conta.
- O `README.md` está desatualizado (descreve o scaffold inicial).
