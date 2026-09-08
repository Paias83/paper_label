import type { KeyboardEvent } from 'react'

// Enter num campo de texto passa pro próximo campo, em vez de salvar o
// formulário. A pessoa leiga aperta Enter esperando "próximo", e o submit
// acidental tirava o cadastro da tela antes da revisão. O botão Salvar
// continua funcionando por clique ou por Enter quando ele está focado.
//
// Uso: <form onSubmit={handleSave} onKeyDown={advanceOnEnter}>
export function advanceOnEnter(e: KeyboardEvent<HTMLFormElement>) {
  if (e.key !== 'Enter' || e.shiftKey) return

  const target = e.target as HTMLElement
  const tag = target.tagName

  // Textarea: Enter é quebra de linha. Botão: deixa o Enter acionar.
  if (tag === 'TEXTAREA' || tag === 'BUTTON') return
  if (tag === 'INPUT' && (target as HTMLInputElement).type === 'submit') return

  e.preventDefault()

  const controls = Array.from(
    e.currentTarget.querySelectorAll<HTMLElement>('input, select, textarea, button')
  ).filter(
    (el) =>
      !el.hasAttribute('disabled') &&
      (el as HTMLInputElement).type !== 'hidden' &&
      el.tabIndex !== -1 &&
      el.offsetParent !== null
  )

  const next = controls[controls.indexOf(target) + 1]
  if (next) next.focus()
}
