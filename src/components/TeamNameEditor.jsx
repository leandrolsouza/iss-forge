import React, { useState } from 'react';

export default function TeamNameEditor({ team, teamIndex, onTeamNameGenerate }) {
  const [inputText, setInputText] = useState('');
  const [generated, setGenerated] = useState(false);

  if (!team) {
    return <div className="editor-panel empty">Selecione um time para editar</div>;
  }

  const teamNameText = team.teamNameText || team.name.toUpperCase();

  // Initialize input with current name on first render
  if (!inputText && teamNameText) {
    setInputText(teamNameText);
  }

  const handleGenerate = () => {
    const sanitized = inputText.toUpperCase().replace(/[^A-Z0-9. ]/g, ' ').trim();
    if (!sanitized) return;

    onTeamNameGenerate(teamIndex, sanitized);
    setGenerated(true);
    setTimeout(() => setGenerated(false), 2000);
  };

  const handleInputChange = (e) => {
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9. ]/g, '');
    setInputText(value);
    setGenerated(false);
  };

  return (
    <div className="editor-panel uniform-editor">
      <div className="editor-header">
        <div className="editor-header-title">
          <span className="editor-icon">&#127383;</span>
          <h2>{team.name}</h2>
          <span className="editor-subtitle">- Nome do Time</span>
        </div>
      </div>

      <div className="uniform-editor-body">
        {/* Current Name Display */}
        <div className="uniform-part-section">
          <div className="detail-section-title">Nome Atual no Jogo</div>
          <div className="teamname-display">
            <div className="teamname-current">{teamNameText}</div>
          </div>
        </div>

        {/* Name Editor */}
        <div className="uniform-part-section">
          <div className="detail-section-title">Novo Nome</div>
          <div className="teamname-editor-row">
            <input
              type="text"
              value={inputText}
              onChange={handleInputChange}
              maxLength={12}
              placeholder="Ex: BRASIL"
              className="teamname-input"
            />
            <button
              className="kit-btn active teamname-generate-btn"
              onClick={handleGenerate}
              disabled={!inputText.trim()}
            >
              {generated ? '✓ Gerado!' : 'Gerar'}
            </button>
          </div>
          <div className="teamname-hint">
            Caracteres validos: A-Z, 0-9, ponto (.) e espaco. Max ~10 caracteres.
          </div>
        </div>

        {/* Info */}
        <div className="kit-preview-section" style={{ marginTop: 24 }}>
          <div className="detail-section-title">Como Funciona</div>
          <div className="welcome-info" style={{ marginTop: 8 }}>
            <p>
              O nome do time no ISS e exibido como tiles graficos posicionados.
              Ao clicar "Gerar", o texto digitado e convertido em dados de tiles
              que o jogo usa para renderizar o nome sob a bandeira.
            </p>
            <p style={{ marginTop: 8 }}>
              Cada caractere ocupa ~9 pixels de largura. O espaco maximo e de ~70 pixels
              (~8 caracteres confortavelmente). Nomes maiores serao comprimidos automaticamente.
            </p>
            <p style={{ marginTop: 8 }}>
              <strong>Exemplos:</strong> BRASIL, ARGENTINA, S.KOREA, U.S.A., GERMANY
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
