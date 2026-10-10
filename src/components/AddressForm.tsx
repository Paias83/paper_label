import { useState } from 'react'
import type { ShippingAddress } from '../lib/supabase'

export function isAddressComplete(address: ShippingAddress) {
  return Boolean(
    address.cep.replace(/\D/g, '').length === 8 &&
      address.street &&
      address.number &&
      address.neighborhood &&
      address.city &&
      address.state
  )
}

type AddressFormProps = {
  address: ShippingAddress
  onChange: (address: ShippingAddress) => void
  title?: string
}

export default function AddressForm({ address, onChange, title = 'Endereço de entrega' }: AddressFormProps) {
  const [cepLoading, setCepLoading] = useState(false)
  const [cepError, setCepError] = useState('')
  const [lookedUpCep, setLookedUpCep] = useState('')

  // Busca rua/bairro/cidade no ViaCEP. Recebe o endereço atual porque é chamada
  // logo após digitar o 8º dígito (antes do estado do pai atualizar).
  async function lookupCep(current: ShippingAddress) {
    const digits = current.cep.replace(/\D/g, '')
    if (digits.length !== 8 || digits === lookedUpCep) return
    setLookedUpCep(digits)

    setCepError('')
    setCepLoading(true)

    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
      const data = await res.json()
      if (data.erro) {
        setCepError('CEP não encontrado.')
        return
      }
      onChange({
        ...current,
        street: data.logradouro ?? '',
        neighborhood: data.bairro ?? '',
        city: data.localidade ?? '',
        state: data.uf ?? '',
      })
    } catch {
      setLookedUpCep('') // falha de rede: deixa tentar de novo
      setCepError('Não foi possível buscar o CEP.')
    } finally {
      setCepLoading(false)
    }
  }

  return (
    <div className="store-form">
      <div className="form-card">
        <h3>{title}</h3>
        <div className="form-field">
          <label className="form-field-label" htmlFor="cep">
            CEP
          </label>
          <input
            id="cep"
            type="text"
            placeholder="00000-000"
            value={address.cep}
            onChange={(e) => {
              const next = { ...address, cep: e.target.value }
              onChange(next)
              // 8 dígitos digitados ou colados/autocompletados: busca sem esperar sair do campo.
              if (next.cep.replace(/\D/g, '').length === 8) lookupCep(next)
            }}
            onBlur={() => lookupCep(address)}
            maxLength={9}
            required
          />
          {cepLoading && <p className="checkout-hint">Buscando endereço…</p>}
          {cepError && <p className="checkout-error">{cepError}</p>}
        </div>

        <div className="form-field">
          <label className="form-field-label" htmlFor="street">
            Rua
          </label>
          <input
            id="street"
            type="text"
            value={address.street}
            onChange={(e) => onChange({ ...address, street: e.target.value })}
            required
          />
        </div>

        <div className="form-row">
          <div className="form-field">
            <label className="form-field-label" htmlFor="number">
              Número
            </label>
            <input
              id="number"
              type="text"
              value={address.number}
              onChange={(e) => onChange({ ...address, number: e.target.value })}
              required
            />
          </div>
          <div className="form-field">
            <label className="form-field-label" htmlFor="complement">
              Complemento
            </label>
            <input
              id="complement"
              type="text"
              value={address.complement}
              onChange={(e) => onChange({ ...address, complement: e.target.value })}
            />
          </div>
        </div>

        <div className="form-field">
          <label className="form-field-label" htmlFor="neighborhood">
            Bairro
          </label>
          <input
            id="neighborhood"
            type="text"
            value={address.neighborhood}
            onChange={(e) => onChange({ ...address, neighborhood: e.target.value })}
            required
          />
        </div>

        <div className="form-row">
          <div className="form-field">
            <label className="form-field-label" htmlFor="city">
              Cidade
            </label>
            <input
              id="city"
              type="text"
              value={address.city}
              onChange={(e) => onChange({ ...address, city: e.target.value })}
              required
            />
          </div>
          <div className="form-field">
            <label className="form-field-label" htmlFor="state">
              UF
            </label>
            <input
              id="state"
              type="text"
              value={address.state}
              maxLength={2}
              onChange={(e) => onChange({ ...address, state: e.target.value.toUpperCase() })}
              required
            />
          </div>
        </div>
      </div>
    </div>
  )
}
