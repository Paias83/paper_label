import { useEffect, useState } from 'react'

type Props = {
  id?: string
  value: number | null
  onChange: (value: number | null) => void
  required?: boolean
  autoFocus?: boolean
}

function format(n: number) {
  return n.toFixed(2).replace('.', ',')
}

function parse(text: string): number | null {
  const trimmed = text.trim()
  if (!trimmed) return null
  const normalized = trimmed.replace(/\./g, '').replace(',', '.')
  const n = Number(normalized)
  return Number.isFinite(n) ? n : null
}

// Input de valor monetário: digitação livre em texto (aceita vírgula),
// e só formata para 2 casas decimais (completando com zero quando falta)
// ao sair do campo — nunca reformata enquanto a pessoa ainda está digitando.
export default function CurrencyInput({ id, value, onChange, required, autoFocus }: Props) {
  const [text, setText] = useState(value != null ? format(value) : '')
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) setText(value != null ? format(value) : '')
  }, [value, focused])

  return (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      autoFocus={autoFocus}
      required={required}
      value={text}
      onFocus={() => setFocused(true)}
      onChange={(e) => {
        const raw = e.target.value
        if (/^\d*,?\d*$/.test(raw)) setText(raw)
      }}
      onBlur={() => {
        setFocused(false)
        const n = parse(text)
        onChange(n)
        setText(n != null ? format(n) : '')
      }}
    />
  )
}
