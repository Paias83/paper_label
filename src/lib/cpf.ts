export function formatCPF(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 11)
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

export function isValidCPF(raw: string): boolean {
  const cpf = raw.replace(/\D/g, '')
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false

  function checkDigit(length: number) {
    let sum = 0
    for (let i = 0; i < length; i++) sum += Number(cpf[i]) * (length + 1 - i)
    const remainder = (sum * 10) % 11
    return remainder === 10 ? 0 : remainder
  }

  return checkDigit(9) === Number(cpf[9]) && checkDigit(10) === Number(cpf[10])
}

export function formatCNPJ(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 14)
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
}

export function isValidCNPJ(raw: string): boolean {
  const cnpj = raw.replace(/\D/g, '')
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false

  function checkDigit(length: number) {
    let sum = 0
    let weight = length - 7
    for (let i = 0; i < length; i++) {
      sum += Number(cnpj[i]) * weight--
      if (weight < 2) weight = 9
    }
    const remainder = sum % 11
    return remainder < 2 ? 0 : 11 - remainder
  }

  return checkDigit(12) === Number(cnpj[12]) && checkDigit(13) === Number(cnpj[13])
}

// CPF ou CNPJ, decidido pela quantidade de dígitos (até 11 = CPF).
export function formatDocument(raw: string): string {
  return raw.replace(/\D/g, '').length > 11 ? formatCNPJ(raw) : formatCPF(raw)
}

export function isValidDocument(raw: string): boolean {
  const digits = raw.replace(/\D/g, '')
  return digits.length === 14 ? isValidCNPJ(digits) : isValidCPF(digits)
}
