import React from 'react';

export default function LoginCard() {
  return (
    <div className="login-card" role="region" aria-label="Iniciar sesión institucional">
      <h4>Identifíquese usando su cuenta en:</h4>

      <button type="button" className="office-btn" onClick={() => { /* Intencionalmente inactivo (estático) */ }}>
        <span className="office-btn__logo" aria-hidden>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="0" y="0" width="9" height="9" fill="#f35325" />
            <rect x="11" y="0" width="9" height="9" fill="#81bc06" />
            <rect x="0" y="11" width="9" height="9" fill="#05a6f0" />
            <rect x="11" y="11" width="9" height="9" fill="#ffba08" />
          </svg>
        </span>
        <span className="office-btn__label">Microsoft Office 365</span>
      </button>
    </div>
  );
}
