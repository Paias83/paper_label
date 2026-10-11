import { Link } from 'react-router-dom'
import { LEGAL_UPDATED_AT, STORE_ADDRESS, STORE_INFO } from '../../lib/storeInfo'

// Política de Privacidade (LGPD — Lei 13.709/2018). Texto-modelo: revisar com
// um advogado antes de considerar definitivo. Ao mudar o conteúdo, atualizar
// LEGAL_UPDATED_AT em lib/storeInfo.ts.
export default function PrivacyPolicy() {
  const controller = STORE_INFO.legalName ?? STORE_INFO.name
  return (
    <div className="container legal-page">
      <h1>Política de Privacidade</h1>
      <p className="legal-updated">Última atualização: {LEGAL_UPDATED_AT}</p>

      <p>
        Esta política explica como a {STORE_INFO.name} coleta, usa, guarda e compartilha os seus dados pessoais
        quando você navega, se cadastra e compra em {STORE_INFO.site}, em conformidade com a Lei Geral de Proteção
        de Dados (LGPD — Lei nº 13.709/2018).
      </p>

      <h2>1. Quem é o responsável pelos seus dados</h2>
      <p>
        O controlador dos dados é <strong>{controller}</strong>
        {STORE_INFO.document ? `, inscrita sob o nº ${STORE_INFO.document}` : ''}, com endereço em {STORE_ADDRESS}.
        Para qualquer assunto sobre privacidade, fale com a gente em{' '}
        <a href={`mailto:${STORE_INFO.email}`}>{STORE_INFO.email}</a>.
      </p>

      <h2>2. Quais dados coletamos</h2>
      <ul>
        <li>
          <strong>Cadastro:</strong> nome completo, e-mail, CPF, telefone, endereço e senha (guardada de forma
          criptografada — nem nós temos acesso a ela).
        </li>
        <li>
          <strong>Pedidos:</strong> produtos comprados, valores, forma de entrega, endereço de entrega e histórico de
          status.
        </li>
        <li>
          <strong>Pagamento:</strong> processado pelo Mercado Pago. Os dados do cartão são digitados em campos seguros
          do próprio Mercado Pago e <strong>não passam nem ficam guardados na loja</strong>. Recebemos apenas a
          confirmação, a forma de pagamento e o valor.
        </li>
        <li>
          <strong>Orçamentos de personalizados:</strong> as mensagens trocadas e os arquivos/imagens que você enviar.
        </li>
        <li>
          <strong>Navegação:</strong> dados técnicos necessários para o site funcionar, como o endereço IP e o tipo de
          navegador.
        </li>
      </ul>

      <h2>3. Para que usamos e com qual base legal</h2>
      <ul>
        <li>
          <strong>Criar e manter sua conta, processar pedidos, pagamentos e entregas, e responder orçamentos</strong>{' '}
          — execução de contrato (art. 7º, V, da LGPD).
        </li>
        <li>
          <strong>Enviar e-mails sobre sua conta, pedidos e pagamentos</strong> (confirmação de cadastro, pagamento
          aprovado, envio, rastreio) — execução de contrato.
        </li>
        <li>
          <strong>Emitir documentos fiscais e de transporte</strong> (como a declaração de conteúdo) e guardar
          registros exigidos por lei — cumprimento de obrigação legal (art. 7º, II).
        </li>
        <li>
          <strong>Prevenir fraudes e proteger a loja e os clientes</strong> — legítimo interesse (art. 7º, IX) e
          exercício regular de direitos (art. 7º, VI).
        </li>
      </ul>
      <p>
        <strong>Não vendemos seus dados</strong> e não enviamos propaganda por e-mail sem o seu consentimento.
      </p>

      <h2>4. Com quem compartilhamos</h2>
      <p>Somente com os parceiros necessários para a loja funcionar, cada um para a sua finalidade:</p>
      <ul>
        <li>
          <strong>Mercado Pago</strong> — processamento do pagamento e prevenção a fraudes.
        </li>
        <li>
          <strong>Melhor Envio e transportadoras</strong> (Correios, Jadlog e outras) — cálculo do frete, etiqueta e
          entrega (nome, CPF, telefone e endereço do destinatário).
        </li>
        <li>
          <strong>Supabase</strong> — hospedagem do banco de dados e dos arquivos.
        </li>
        <li>
          <strong>Vercel</strong> — hospedagem do site.
        </li>
        <li>
          <strong>Resend</strong> e <strong>Zoho</strong> — envio e recebimento de e-mails.
        </li>
        <li>
          <strong>ViaCEP</strong> — preenchimento automático do endereço a partir do CEP.
        </li>
        <li>
          <strong>Autoridades públicas</strong>, quando houver obrigação legal ou ordem judicial.
        </li>
      </ul>

      <h2>5. Transferência internacional</h2>
      <p>
        Alguns desses serviços (como Supabase, Vercel e Resend) guardam ou processam dados em servidores fora do
        Brasil, principalmente nos Estados Unidos. Escolhemos fornecedores que adotam medidas de segurança e
        cláusulas contratuais de proteção de dados, conforme o art. 33 da LGPD.
      </p>

      <h2>6. Cookies e armazenamento no navegador</h2>
      <p>
        Usamos apenas o armazenamento <strong>essencial</strong> para o site funcionar: manter você conectado à sua
        conta e lembrar os produtos do seu carrinho. O formulário de pagamento do Mercado Pago também usa recursos
        próprios de segurança para prevenir fraudes. <strong>Não usamos cookies de publicidade nem de rastreamento</strong>
        .
      </p>

      <h2>7. Por quanto tempo guardamos</h2>
      <ul>
        <li>
          <strong>Dados de cadastro:</strong> enquanto sua conta estiver ativa, ou até você pedir a exclusão.
        </li>
        <li>
          <strong>Pedidos e pagamentos:</strong> pelo prazo exigido pela legislação fiscal e de defesa do consumidor
          (em geral, 5 anos), mesmo após a exclusão da conta.
        </li>
        <li>
          <strong>Orçamentos:</strong> enquanto forem necessários para a produção e eventual garantia do produto.
        </li>
      </ul>

      <h2>8. Seus direitos</h2>
      <p>Pela LGPD (art. 18), você pode, a qualquer momento:</p>
      <ul>
        <li>confirmar se tratamos seus dados e pedir uma cópia deles;</li>
        <li>corrigir dados incompletos, inexatos ou desatualizados;</li>
        <li>pedir a anonimização, o bloqueio ou a exclusão de dados desnecessários ou excessivos;</li>
        <li>pedir a portabilidade dos dados a outro fornecedor;</li>
        <li>pedir a exclusão da sua conta e dos dados tratados com base no seu consentimento;</li>
        <li>saber com quem compartilhamos seus dados;</li>
        <li>revogar o consentimento, quando ele for a base do tratamento.</li>
      </ul>
      <p>
        Para exercer qualquer um desses direitos, escreva para{' '}
        <a href={`mailto:${STORE_INFO.email}`}>{STORE_INFO.email}</a> a partir do e-mail cadastrado. Respondemos em
        até 15 dias. Alguns dados podem continuar guardados quando a lei exigir (por exemplo, registros de compras).
        Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD), em{' '}
        <a href="https://www.gov.br/anpd" target="_blank" rel="noreferrer">
          www.gov.br/anpd
        </a>
        .
      </p>

      <h2>9. Segurança</h2>
      <p>
        Adotamos medidas técnicas e administrativas para proteger seus dados: conexão criptografada (HTTPS), senhas
        criptografadas, acesso restrito por regras de permissão no banco de dados e pagamentos processados
        diretamente pelo Mercado Pago. Nenhum sistema é 100% invulnerável; se ocorrer um incidente de segurança que
        possa causar risco relevante, avisaremos os titulares e a ANPD, como prevê a lei.
      </p>

      <h2>10. Menores de idade</h2>
      <p>
        O cadastro e as compras são destinados a maiores de 18 anos. Menores devem comprar com a participação de um
        responsável legal.
      </p>

      <h2>11. Alterações nesta política</h2>
      <p>
        Podemos atualizar esta política para refletir mudanças na loja ou na legislação. A data da última atualização
        fica sempre no topo desta página. Veja também os nossos <Link to="/termos">Termos de Uso e Compra</Link>.
      </p>
    </div>
  )
}
