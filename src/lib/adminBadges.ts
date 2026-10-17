// Pede ao AdminLayout para recontar os badges do menu lateral. Use depois de
// uma ação que muda a contagem sem trocar de tela (ex.: resolver uma
// necessidade de compra, abrir um pedido novo).
const EVENT = 'admin-badges-refresh'

export function refreshAdminBadges() {
  window.dispatchEvent(new Event(EVENT))
}

export function onAdminBadgesRefresh(handler: () => void) {
  window.addEventListener(EVENT, handler)
  return () => window.removeEventListener(EVENT, handler)
}
