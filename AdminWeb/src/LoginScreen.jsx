import React, { useState } from 'react';

export default function LoginScreen({ onLogin, error }) {
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
        <h2>Inicie sesion con sus credenciales del sistema.</h2>

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
            Contrasena
            <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="******" />
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="primary-btn" disabled={loading}>{loading ? 'Validando...' : 'Iniciar sesion'}</button>
            <button type="button" className="ghost-btn" onClick={() => { setUser(''); setPass(''); }} disabled={loading}>Limpiar</button>
          </div>
        </form>

        {error && <div className="login-error" role="status">{error}</div>}

        <small className="login-note">Para iniciar sesion necesitas tener levantado el Gateway y el microservicio de identidad. Usa admin@uta.edu.ec / admin123 para el panel administrativo.</small>
      </div>
    </div>
  );
}
