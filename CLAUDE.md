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
O pagamento é **embutido** (`components/EmbeddedPayment.tsx`, `@mercadopago/sdk-react`):
"Ir para o pagamento" cria o pedido via `process-payment` e abre cartão/débito/Pix/boleto
na página; o Status Screen mostra QR/boleto e a página consulta o pedido a cada 5 s até
o `mp-webhook` marcar pago. Public Key de produção fica no próprio componente (é
pública; `VITE_MP_PUBLIC_KEY` sobrescreve). Fatura do cartão: `statement_descriptor`
`STUDIOPAPER`. O carrinho pré-preenche o endereço de `profiles.addresses[0]` e cota o frete sozinho
quando há CEP completo (recalcula com CEP/quantidades). O carrinho em si fica no
`localStorage` **por conta** (`papelaria_carrinho:<user_id|visitante>`, ver
`CartContext.tsx`); o de visitante é mesclado na conta ao entrar.

## Edge Functions (`supabase/functions/`)

| Função | O que faz | Secrets |
|---|---|---|
| `process-payment` | **pagamento embutido no carrinho** (Payment Brick): `create_order` grava o pedido `pendente` e `pay` cria o pagamento na Payments API com o total **do banco** | `MP_ACCESS_TOKEN`, `MELHOR_ENVIO_TOKEN` |
| `_shared/checkoutOrder.ts` | criação do pedido da loja: **preço/nome dos produtos vêm do banco e o frete é recotado pelo `service_id`** — do body só usa ids, quantidades, serviço e endereço | |
| `create-preference` | legado/plano B: Checkout Pro (redireciona), usado só se não houver Public Key | `MP_ACCESS_TOKEN`, `MELHOR_ENVIO_TOKEN` |
| `create-quote-order` | igual à anterior, mas a partir de orçamento aprovado | `MP_ACCESS_TOKEN` |
| `mp-webhook` | notificação do MP → aprovado (valor ≥ total do pedido): `pago` + `fulfill_order`; Pix/boleto/análise/recusado: só e-mail (pedido segue `pendente`); `cancelled` (Pix/boleto vencido): cancela | `MP_ACCESS_TOKEN` |
| `calculate-shipping` | cotação no Melhor Envio (lógica em `_shared/melhorEnvio.ts`, peso/medidas lidos do banco) | `MELHOR_ENVIO_TOKEN`, `STORE_ORIGIN_CEP` |
| `shipping-label` | admin-only; etiquetas do Melhor Envio: `preview` / `buy` (carrinho → compra com saldo da carteira → gera) / `print` (etiqueta + DACE) / `cancel` | `MELHOR_ENVIO_TOKEN`, `STORE_ORIGIN_CEP` |
| `create-manual-order` / `update-manual-order` | pedido manual do admin (checam `role='admin'` pelo JWT) | — |
| `send-order-status-email` | admin-only; chamada por `Orders.tsx` ao mudar status | `RESEND_API_KEY` |
| `_shared/orderEmail.ts` | `sendOrderStatusEmail` (por status) e `sendPaymentNoticeEmail` (Pix/boleto, análise, recusa) via API HTTP do Resend; HTML com itens/total no visual da loja | |

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
- **Status de pedido / pagamento**: API HTTP do Resend (`RESEND_API_KEY`), remetente
  `contato@studiopaper.com.br`. Compra na loja não manda e-mail ao criar o pedido (cliente
  pode desistir no MP); o primeiro aviso vem do `mp-webhook`. Avisos de tentativa de
  pagamento saem uma vez por pagamento (dedup por `orders.mp_payment_id`). Cartão recusado
  **não** cancela o pedido (no Checkout Pro o cliente tenta de novo); vencimento só cancela
  se for a última tentativa (`mp_payment_id` igual). Pedido manual pendente com cliente
  ainda recebe "Recebemos seu pedido".
- `contato@studiopaper.com.br` é uma caixa real no Zoho Mail (plano grátis, só webmail).
- PKCE (`flowType: 'pkce'`) é obrigatório: o pré-fetch de links do Gmail/Outlook
  consumia o token implicit e o usuário caía em `otp_expired`. Esse bug não reproduz
  com `curl`, só com caixa de e-mail real.
- Mas o `?code=` do PKCE só funciona no navegador onde o e-mail foi digitado (aberto no
  celular/app do Gmail falhava). Por isso os modelos **Confirm signup** e **Magic Link**
  (painel do Supabase → Auth → Email Templates) usam
  `https://www.studiopaper.com.br/completar-cadastro?token_hash={{ .TokenHash }}&type=email`,
  e `CompleteRegistration.tsx` confirma com `verifyOtp`. Template mal formado (chaves
  `{{ }}` sobrando) quebra o envio.
  Cópia versionada dos modelos (português, visual da loja) e assuntos em
  `supabase/email-templates/` — editar lá e colar no painel.
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
- Fonte do logo **July It** fica versionada em `public/fonts/` (licença comercial
  adquirida em 2026-10-10; antes disso ficava fora do git por ser só uso pessoal).
- Retirada no local: endereço e horário fixos em `PICKUP_INFO`, **duplicado** em
  `components/DeliveryMethodPicker.tsx` e `supabase/functions/_shared/orderEmail.ts`
  (se mudar, alterar nos dois e redeployar as functions de e-mail). Frete grátis na retirada; o MP rejeita
  item de preço 0, então a linha "Frete" não é enviada nesse caso.
- **Etiquetas de envio** (Melhor Envio, botão no pedido pago em `Orders.tsx` →
  `ShippingLabelModal.tsx`): sem nota fiscal (`non_commercial: true`, o Melhor Envio
  emite a DC-e; o DACE vai junto do pacote). Remetente = cadastro da conta no Melhor
  Envio (`GET /me`), para não ter CPF no repo. Só 1 volume; Azul/LATAM/Buslog ficam de
  fora também do carrinho (exigem agência; filtro em `_shared/melhorEnvio.ts`). `orders.shipping_service_id` pré-seleciona o serviço;
  `label_me_id`/`label_cost`/`label_created_at` voltam a nulo ao cancelar. O token
  precisa das permissões de carrinho, compra, geração, impressão, rastreio,
  cancelamento e leitura de usuário/saldo. Status "enviado" continua manual.
- Produtos sem peso/medidas reais usam pacote genérico (0,3 kg, 16×4×16 cm) — se um
  frete parecer errado, conferir as medidas do produto.

## Ambiente

`.env` (não versionado; mesmo conteúdo do `.env.example`):
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (chave publishable, pública).

## Pendências e próximos passos

- **Pagamento de orçamento** (`create-quote-order`) ainda usa Checkout Pro
  (redireciona); dá para reaproveitar `EmbeddedPayment.tsx`. As rotas
  `/checkout/sucesso|falha|pendente` das `back_urls` continuam sem página.
- **Payments API é "legado"** no Mercado Pago (nova: Orders API, `/v1/orders`). O
  embutido usa a Payments API porque é a da doc do Brick e a que o `mp-webhook` lê;
  migrar exige reescrever o webhook.
- **E-mails de orçamento (planejado)**: avisos por e-mail nas etapas do orçamento
  (nova mensagem do admin, proposta enviada, cliente respondeu). Pontos de disparo:
  `QuoteThread.tsx` do admin (`handleSend`) e do cliente (`sendReply`,
  `handlePedirAjuste`). Reusar o padrão de `_shared/orderEmail.ts`.
- Filtro por categoria fica na Home (`/?categoria=slug`); `/catalogo` só redireciona.
- Instagram ativo na TopBar; TikTok removido até existir conta.
- O `README.md` está desatualizado (descreve o scaffold inicial).

## Notas no Obsidian

A nota deste projeto fica no cofre do Obsidian:
`C:\Users\alexandre.paias\Documents\Obsidian\Principal\10 Projetos\E-commerce Papelaria de Luxo.md`

Ao concluir uma tarefa relevante (feature nova, decisão técnica, bug resolvido, mudança de deploy/stack),
atualize essa nota antes de encerrar:
- "Decisões técnicas": adicione uma linha na tabela (data, decisão, motivo)
- "TODO": marque itens concluídos com [x] e adicione novos pendentes
- "Problemas e soluções": registre o sintoma e a correção
- "Funcionalidades" / "Stack": ajuste se algo mudou

Soluções reutilizáveis em outros projetos vão para `20 Conhecimento\` no cofre
(modelo: `90 Templates\Problema e solução.md`), com link [[E-commerce Papelaria de Luxo]].
Siga as convenções de `C:\Users\alexandre.paias\Documents\Obsidian\Principal\CLAUDE.md`.
Nunca grave senhas, tokens, chaves de API ou conteúdo de `.env` nas notas (o cofre vai para o GitHub).
