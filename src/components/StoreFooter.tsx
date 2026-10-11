import { Link } from 'react-router-dom'
import { STORE_ADDRESS, STORE_INFO } from '../lib/storeInfo'

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
            Onde a delicadeza do papel artesanal encontra a precisão da tecnologia 3D, transformamos histórias em arte tátil.
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
        <div>
          <h4>Institucional</h4>
          <ul>
            <li>
              <Link to="/termos">Termos de uso e compra</Link>
            </li>
            <li>
              <Link to="/privacidade">Política de privacidade</Link>
            </li>
          </ul>
        </div>
      </div>
      {/* Identificação exigida pelo Decreto 7.962/2013 (dados em lib/storeInfo.ts). */}
      <div className="container footer-legal">
        {STORE_INFO.legalName ?? STORE_INFO.name}
        {STORE_INFO.document ? ` · CNPJ ${STORE_INFO.document}` : ''} · {STORE_ADDRESS} · {STORE_INFO.email}
      </div>
      <div className="container footer-bottom">
        <span>© {new Date().getFullYear()} Studio Paper</span>
        <span>Feito à mão, enviado com cuidado.</span>
      </div>
    </footer>
  )
}
