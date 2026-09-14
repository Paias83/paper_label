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
