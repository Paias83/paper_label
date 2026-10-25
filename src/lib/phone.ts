// (44)3333-4444 para fixo (10 dígitos) e (44)99999-4444 para celular (11 dígitos).
export function formatPhone(raw: string) {
  const digits = raw.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 2) return digits.replace(/^(\d+)$/, '($1')
  const ddd = digits.slice(0, 2)
  const rest = digits.slice(2)
  const split = rest.length > 8 ? 5 : 4
  return rest.length > split ? `(${ddd})${rest.slice(0, split)}-${rest.slice(split)}` : `(${ddd})${rest}`
}
