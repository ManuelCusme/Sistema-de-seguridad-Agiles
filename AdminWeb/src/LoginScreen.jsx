import React, { useState } from 'react';

export default function LoginScreen({ onLogin, demoCreds, error }) {
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (payload) => {
    if (!onLogin) return;

    setLoading(true);
    try {
      await onLogin(payload);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-box">
        <div className="login-box__brand">Uta Security</div>
        <h2>Identifíquese usando su cuenta en:</h2>

        <div className="login-options">
          <button
            type="button"
            className="office-btn"
            onClick={() => submit(demoCreds || { user: 'admin@uta.edu.ec', pass: 'admin123' })}
            disabled={loading}
          >
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

        <div className="login-divider">o</div>

        <form
          className="login-form"
          onSubmit={(e) => {
            e.preventDefault();
            submit({ user: user.trim(), pass });
          }}
        >
          <label>
            Usuario
            <input value={user} onChange={(e) => setUser(e.target.value)} placeholder="usuario@uta.edu.ec" />
          </label>
          <label>
            Contraseña
            <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="●●●●●●" />
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="primary-btn" disabled={loading}>{loading ? 'Validando...' : 'Iniciar sesión'}</button>
            <button type="button" className="ghost-btn" onClick={() => { setUser(''); setPass(''); }} disabled={loading}>Limpiar</button>
          </div>
        </form>

        {error && <div className="login-error" role="status">{error}</div>}

        <small className="login-note">Para iniciar sesión necesitas tener levantado el Gateway y el microservicio de identidad. Usa admin@uta.edu.ec / admin123 para el panel administrativo.</small>
      </div>
    </div>
  );
}
