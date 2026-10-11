import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
// Fontes servidas pelo próprio site (Fontsource) em vez do Google Fonts — o
// navegador do visitante não manda o IP para o Google (LGPD).
import '@fontsource-variable/fraunces/opsz.css'
import '@fontsource/public-sans/400.css'
import '@fontsource/public-sans/500.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import './styles/global.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
