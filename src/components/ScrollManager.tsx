import { useEffect, useLayoutEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

// Posição de rolagem de cada tela visitada (por entrada do histórico).
const positions = new Map<string, number>()

// Controla a rolagem da loja:
// - ao abrir uma tela nova, começa do topo;
// - ao voltar (botão "Continuar comprando" ou voltar do navegador), devolve a posição
//   onde o cliente estava. Como os produtos chegam do banco depois, espera a página
//   crescer até a altura necessária antes de rolar (senão parava no rodapé).
// - trocar só o filtro (?categoria=) mantém a posição, para não pular para o topo.
export default function ScrollManager() {
  const location = useLocation()
  const navType = useNavigationType()
  const currentKey = useRef(location.key)
  const previousPath = useRef(location.pathname)

  useEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
    const save = () => positions.set(currentKey.current, window.scrollY)
    window.addEventListener('scroll', save, { passive: true })
    return () => window.removeEventListener('scroll', save)
  }, [])

  useLayoutEffect(() => {
    const samePath = previousPath.current === location.pathname
    currentKey.current = location.key
    previousPath.current = location.pathname

    const saved = navType === 'POP' ? positions.get(location.key) : undefined
    if (saved === undefined) {
      if (!samePath) window.scrollTo(0, 0)
      return
    }

    let frame = 0
    const start = performance.now()
    const tryRestore = () => {
      const maxY = document.documentElement.scrollHeight - window.innerHeight
      if (maxY >= saved || performance.now() - start > 3000) {
        window.scrollTo(0, Math.min(saved, maxY))
        positions.set(location.key, saved)
        return
      }
      frame = requestAnimationFrame(tryRestore)
    }
    tryRestore()
    return () => cancelAnimationFrame(frame)
  }, [location.key, location.pathname, navType])

  return null
}
