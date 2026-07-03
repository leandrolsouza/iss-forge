import React from 'react';
import { useI18n } from '../i18n';

export default function AboutPanel() {
  const { t } = useI18n();

  const openLink = (url) => {
    if (window.electronAPI) {
      // In Electron, use shell.openExternal via a simple workaround
      window.open(url, '_blank');
    } else {
      window.open(url, '_blank');
    }
  };

  return (
    <div className="editor-panel about-panel">
      <div className="about-content">
        {/* Logo/Title */}
        <div className="about-header">
          <div className="about-logo">
            <svg width="64" height="64" viewBox="0 0 512 512">
              <defs>
                <linearGradient id="abg" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style={{ stopColor: '#1a5276' }} />
                  <stop offset="100%" style={{ stopColor: '#0d2f4a' }} />
                </linearGradient>
              </defs>
              <rect x="16" y="16" width="480" height="480" rx="64" fill="url(#abg)" />
              <circle cx="256" cy="210" r="72" fill="#fff" opacity="0.9" />
              <path
                d="M256 155 L273 173 L267 195 L245 195 L239 173 Z"
                fill="#2c3e50"
                opacity="0.8"
              />
              <path
                d="M285 181 L303 192 L301 215 L285 221 L273 208 Z"
                fill="#2c3e50"
                opacity="0.7"
              />
              <path
                d="M227 181 L209 192 L211 215 L227 221 L239 208 Z"
                fill="#2c3e50"
                opacity="0.7"
              />
              <text
                x="256"
                y="360"
                fontFamily="Arial, sans-serif"
                fontSize="48"
                fontWeight="900"
                fill="#fff"
                textAnchor="middle"
              >
                ISS
              </text>
              <text
                x="256"
                y="400"
                fontFamily="Arial, sans-serif"
                fontSize="32"
                fontWeight="700"
                fill="#2ecc71"
                textAnchor="middle"
              >
                FORGE
              </text>
            </svg>
          </div>
          <h1 className="about-title">
            ISS Forge <span className="beta-badge">BETA</span>
          </h1>
          <p className="about-version">v0.1.0-beta</p>
          <p className="about-description">
            ROM Editor for International Superstar Soccer
            <br />
            Super Nintendo Entertainment System (1995)
          </p>
          <p className="about-beta-notice">
            Esta é uma versão beta. Algumas funcionalidades ainda estão sendo refinadas.
            <br />
            This is a beta version. Some features are still being refined.
          </p>
        </div>

        {/* Author */}
        <div className="about-section">
          <h3 className="about-section-title">Autor / Author</h3>
          <div className="about-author-card">
            <div className="about-author-avatar">LS</div>
            <div className="about-author-info">
              <span className="about-author-name">Leandro L. Souza</span>
              <div className="about-author-links">
                <button
                  className="about-link"
                  onClick={() => openLink('https://www.linkedin.com/in/leandrolsouza/')}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M0 1.146C0 .513.526 0 1.175 0h13.65C15.474 0 16 .513 16 1.146v13.708c0 .633-.526 1.146-1.175 1.146H1.175C.526 16 0 15.487 0 14.854V1.146zm4.943 12.248V6.169H2.542v7.225h2.401zm-1.2-8.212c.837 0 1.358-.554 1.358-1.248-.015-.709-.52-1.248-1.342-1.248-.822 0-1.359.54-1.359 1.248 0 .694.521 1.248 1.327 1.248h.016zm4.908 8.212V9.359c0-.216.016-.432.08-.586.173-.431.568-.878 1.232-.878.869 0 1.216.662 1.216 1.634v3.865h2.401V9.25c0-2.22-1.184-3.252-2.764-3.252-1.274 0-1.845.7-2.165 1.193v.025h-.016l.016-.025V6.169h-2.4c.03.678 0 7.225 0 7.225h2.4z" />
                  </svg>
                  LinkedIn
                </button>
                <button
                  className="about-link"
                  onClick={() => openLink('https://github.com/leandrolsouza')}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
                  </svg>
                  GitHub
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Credits */}
        <div className="about-section">
          <h3 className="about-section-title">Creditos / Credits</h3>
          <div className="about-credits">
            <p>Baseado nos trabalhos de / Based on the work of:</p>
            <ul>
              <li>
                <strong>Rodrigo Mallmann Guerra</strong> — ISS Studio (Java)
              </li>
              <li>
                <strong>Esteban Fuentealba</strong> — Web ISS Studio (Vue/WASM)
              </li>
              <li>
                <strong>ProtonNoir</strong> — Konami SNES Compressor/Decompressor
              </li>
              <li>
                <strong>Equipe Puma</strong> — ROM offset maps & research
              </li>
              <li>
                <strong>Equipe Falcon Brasil</strong> — Testing & documentation
              </li>
            </ul>
          </div>
        </div>

        {/* Tech */}
        <div className="about-section">
          <h3 className="about-section-title">Tecnologia / Technology</h3>
          <div className="about-tech-badges">
            <span className="about-badge">Electron</span>
            <span className="about-badge">React</span>
            <span className="about-badge">Vite</span>
            <span className="about-badge">SNES 4bpp</span>
            <span className="about-badge">Konami LZ</span>
          </div>
        </div>

        {/* Footer */}
        <div className="about-footer">
          <p>ISS Forge is not affiliated with Konami.</p>
          <p>International Superstar Soccer is a trademark of Konami.</p>
        </div>
      </div>
    </div>
  );
}
