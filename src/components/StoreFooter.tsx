import { Link } from 'react-router-dom'

export default function StoreFooter() {
  return (
    <footer className="site-footer">
      <div className="deckle-divider" />
      <div className="container footer-grid">
        <div>
          <p className="logo" style={{ display: 'block', marginBottom: 8 }}>
            Studio Paper
          </p>
          <p style={{ maxWidth: 320, color: 'var(--charcoal)', fontSize: '0.9rem' }}>
            Cadernos encadernados à mão, papelaria de convite e acessórios de escrita,
            selecionados para quem trata o papel como objeto — não como consumível.
          </p>
        </div>
        <div>
          <h4>Loja</h4>
          <ul>
            <li>
              <Link to="/catalogo">Catálogo</Link>
            </li>
            <li>
              <Link to="/carrinho">Carrinho</Link>
            </li>
            <li>
              <Link to="/entrar">Minha conta</Link>
            </li>
          </ul>
        </div>
        <div>
          <h4>Atendimento</h4>
          <ul>
            <li>
              <a href="mailto:contato@studiopaper.com.br">contato@studiopaper.com.br</a>
            </li>
            <li style={{ color: 'var(--charcoal)' }}>Seg. a sex., 9h às 18h</li>
          </ul>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>© {new Date().getFullYear()} Studio Paper</span>
        <span>Feito à mão, enviado com cuidado.</span>
      </div>
    </footer>
  )
}
