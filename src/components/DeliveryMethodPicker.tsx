export type DeliveryMethod = 'entrega' | 'retirada'

export const PICKUP_INFO = 'Rua Pion. Walcyr Bavelone, 362 — das 9h às 17h.'

type DeliveryMethodPickerProps = {
  value: DeliveryMethod
  onChange: (value: DeliveryMethod) => void
}

export default function DeliveryMethodPicker({ value, onChange }: DeliveryMethodPickerProps) {
  return (
    <div className="form-card">
      <h3>Como você quer receber?</h3>
      <div className="shipping-options">
        <label className="shipping-option">
          <input
            type="radio"
            name="delivery-method"
            checked={value === 'entrega'}
            onChange={() => onChange('entrega')}
          />
          <span className="shipping-option-info">
            <span>Receber em casa</span>
          </span>
        </label>
        <label className="shipping-option">
          <input
            type="radio"
            name="delivery-method"
            checked={value === 'retirada'}
            onChange={() => onChange('retirada')}
          />
          <span className="shipping-option-info">
            <span>Retirar na loja</span>
            <span className="shipping-option-price">Grátis</span>
          </span>
        </label>
      </div>
    </div>
  )
}
