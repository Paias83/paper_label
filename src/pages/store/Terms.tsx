import { Link } from 'react-router-dom'
import { PICKUP_INFO } from '../../components/DeliveryMethodPicker'
import { LEGAL_UPDATED_AT, STORE_ADDRESS, STORE_INFO } from '../../lib/storeInfo'

// Termos de Uso e Compra (CDC — Lei 8.078/1990 e Decreto 7.962/2013). Texto-
// modelo: revisar com um advogado, principalmente a parte de personalizados.
// Ao mudar o conteúdo, atualizar LEGAL_UPDATED_AT em lib/storeInfo.ts.
export default function Terms() {
  const seller = STORE_INFO.legalName ?? STORE_INFO.name
  return (
    <div className="container legal-page">
      <h1>Termos de Uso e Compra</h1>
      <p className="legal-updated">Última atualização: {LEGAL_UPDATED_AT}</p>

      <h2>1. Quem somos</h2>
      <p>
        {STORE_INFO.site} é a loja online da <strong>{seller}</strong>
        {STORE_INFO.document ? `, inscrita sob o nº ${STORE_INFO.document}` : ''}, com endereço em {STORE_ADDRESS}.
        Atendimento: <a href={`mailto:${STORE_INFO.email}`}>{STORE_INFO.email}</a>. Ao se cadastrar ou comprar,
        você concorda com estes termos e com a nossa <Link to="/privacidade">Política de Privacidade</Link>.
      </p>

      <h2>2. Cadastro</h2>
      <p>
        Para comprar é preciso ter uma conta, com dados verdadeiros e atualizados. Você é responsável por manter sua
        senha em sigilo. O cadastro é destinado a maiores de 18 anos.
      </p>

      <h2>3. Produtos e preços</h2>
      <p>
        Nossas peças são produzidas artesanalmente, por isso pequenas variações de cor, textura e acabamento em
        relação às fotos são naturais e não caracterizam defeito. Os preços e a disponibilidade podem mudar sem aviso;
        vale o preço exibido no momento em que o pedido é finalizado.
      </p>

      <h2>4. Pedido e pagamento</h2>
      <p>
        Os pagamentos são processados pelo Mercado Pago (cartão de crédito, débito, Pix ou boleto). O pedido é
        confirmado somente após a aprovação do pagamento, e você recebe a confirmação por e-mail. Pix e boleto não
        pagos dentro do prazo são cancelados automaticamente.
      </p>

      <h2>5. Entrega e retirada</h2>
      <ul>
        <li>
          <strong>Entrega:</strong> o frete e o prazo são calculados no carrinho conforme o CEP e o serviço
          escolhido. O prazo da transportadora começa a contar a partir da postagem; produtos feitos sob encomenda
          podem ter um prazo de produção antes do envio. O código de rastreio é enviado por e-mail.
        </li>
        <li>
          <strong>Retirada no local</strong> (sem custo): {PICKUP_INFO} Avisamos por e-mail quando o pedido estiver
          pronto para retirada.
        </li>
      </ul>
      <p>Confira o endereço antes de pagar: entregas devolvidas por endereço incorreto podem gerar novo frete.</p>

      <h2>6. Direito de arrependimento</h2>
      <p>
        Nas compras feitas pelo site, você pode desistir em até <strong>7 dias corridos a partir do recebimento</strong>{' '}
        do produto, sem precisar justificar (art. 49 do Código de Defesa do Consumidor). Basta escrever para{' '}
        <a href={`mailto:${STORE_INFO.email}`}>{STORE_INFO.email}</a> informando o número do pedido. O produto deve
        ser devolvido sem sinais de uso, na embalagem original sempre que possível. Após o recebimento da devolução,
        reembolsamos o valor integral pago, incluindo o frete, pelo mesmo meio de pagamento.
      </p>

      <h2>7. Produtos personalizados</h2>
      <p>
        Produtos personalizados são feitos sob encomenda, de forma exclusiva, a partir do orçamento aprovado por você
        (nomes, datas, artes, cores e medidas). Por isso, pedimos atenção à revisão de todos os detalhes antes de
        aprovar a proposta. Pedidos de cancelamento são analisados caso a caso, sempre respeitando os direitos
        previstos no Código de Defesa do Consumidor. Ao enviar imagens, logotipos ou textos, você declara ter o direito
        de usá-los.
      </p>

      <h2>8. Trocas, defeitos e garantia</h2>
      <p>
        Se o produto chegar com defeito ou diferente do pedido, avise-nos em até 30 dias do recebimento (prazo legal
        para produtos não duráveis; 90 dias para duráveis — art. 26 do CDC) pelo{' '}
        <a href={`mailto:${STORE_INFO.email}`}>{STORE_INFO.email}</a>, de preferência com fotos. Faremos a troca, o
        conserto ou o reembolso, sem custo de frete para você.
      </p>

      <h2>9. Propriedade intelectual</h2>
      <p>
        As fotos, textos, marca e o design deste site pertencem à {STORE_INFO.name} e não podem ser copiados sem
        autorização.
      </p>

      <h2>10. Privacidade</h2>
      <p>
        O tratamento dos seus dados pessoais segue a nossa <Link to="/privacidade">Política de Privacidade</Link>, em
        conformidade com a LGPD.
      </p>

      <h2>11. Alterações e foro</h2>
      <p>
        Podemos atualizar estes termos; a versão válida para cada compra é a vigente na data do pedido. Eventuais
        conflitos serão resolvidos no foro do domicílio do consumidor, conforme o Código de Defesa do Consumidor.
      </p>
    </div>
  )
}
