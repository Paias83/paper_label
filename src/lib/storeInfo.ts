// Identificação da loja exigida pelo Decreto 7.962/2013 (comércio eletrônico):
// nome, CPF/CNPJ, endereço físico e eletrônico visíveis no site. Usada no
// rodapé e nas páginas de Política de Privacidade e Termos.
//
// `document` fica nulo até o MEI sair — enquanto isso a linha do CNPJ não
// aparece. Preencher com o CNPJ formatado (ex: '00.000.000/0001-00').
export const STORE_INFO = {
  name: 'Studio Paper',
  legalName: null as string | null,
  document: null as string | null,
  street: 'Rua Pion. Walcyr Bavelone, 362',
  city: 'Maringá',
  state: 'PR',
  cep: '87047-810',
  email: 'contato@studiopaper.com.br',
  site: 'www.studiopaper.com.br',
}

export const STORE_ADDRESS = `${STORE_INFO.street} — ${STORE_INFO.city}/${STORE_INFO.state} — CEP ${STORE_INFO.cep}`

// Data da versão atual da Política de Privacidade e dos Termos (mostrada nas páginas).
export const LEGAL_UPDATED_AT = '11/10/2026'
