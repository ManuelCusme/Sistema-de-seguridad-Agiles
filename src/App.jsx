import { useState, useEffect } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import * as signalR from "@microsoft/signalr"
import { ToastContainer, toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

const STYLES = {
  loginContainer: {
    display: 'flex', justifyContent: 'center', alignItems: 'center',
    height: '100vh', backgroundColor: '#f0f2f5', fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
  },
  loginCard: {
    padding: '40px', backgroundColor: 'white', borderRadius: '12px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.1)', width: '360px', textAlign: 'center'
  },
  inputField: {
    width: '100%', padding: '12px', marginBottom: '15px', borderRadius: '6px',
    border: '1px solid #ced4da', fontSize: '15px', boxSizing: 'border-box', outline: 'none'
  },
  btnPrimary: {
    width: '100%', padding: '12px', backgroundColor: '#b71c1c', color: 'white',
    border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', fontSize: '16px'
  },
  navBar: {
    backgroundColor: '#1a1a1a', color: 'white', padding: '12px 40px',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px'
  },
  dashboardBody: {
    maxWidth: '900px', margin: '0 auto', padding: '0 20px', fontFamily: 'Arial, sans-serif'
  },
  statusIndicator: {
    display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%',
    backgroundColor: '#4caf50', marginRight: '8px'
  },
  alertBox: {
    backgroundColor: 'white', borderLeft: '6px solid #b71c1c', borderRadius: '8px',
    padding: '25px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', marginTop: '20px'
  }
}


//Pantalla del Login
function Login({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const navigate = useNavigate()

  const handleSubmit = (e) => {
    e.preventDefault()
    if (username === 'admin' && password === '123') {
      localStorage.setItem('token', 'fake-jwt-token')
      onLogin()
      navigate('/dashboard')
    } else {
      alert("Credenciales incorrectas (Prueba con admin / 123)")
    }
  }

  return (
    <div style={STYLES.loginContainer}>
      <div style={STYLES.loginCard}>
        <div style={{ marginBottom: '15px', display: 'flex', justifyContent: 'center' }}>
          <svg width="60" height="60" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 1L3 5V11C3 16.55 6.84 21.74 12 23C17.16 21.74 21 16.55 21 11V5L12 1Z" fill="#1a1a1a" stroke="#1a1a1a" strokeWidth="1"/>
            <path d="M12 3L5 6.11V11C5 15.19 7.99 19.34 12 20.68C16.01 19.34 19 15.19 19 11V6.11L12 3Z" fill="white"/>
            <path d="M12 5L12 18C10 17.5 7 15 7 11V7L12 5Z" fill="#b71c1c"/>
          </svg>
        </div>

        <h2 style={{margin: '0 0 5px 0', color: '#1a1a1a'}}>Seguridad UTA</h2>
        <p style={{color: '#6c757d', marginBottom: '25px', fontSize: '14px'}}>Acceso al Panel de Control</p>
        
        <form onSubmit={handleSubmit}>
          <input type="text" placeholder="Usuario" style={STYLES.inputField} onChange={(e) => setUsername(e.target.value)} required />
          <input type="password" placeholder="Contraseña" style={STYLES.inputField} onChange={(e) => setPassword(e.target.value)} required />
          <button type="submit" style={STYLES.btnPrimary}>Entrar al Sistema</button>
        </form>
      </div>
    </div>
  )
}

// --- COMPONENTE: PANEL DE CONTROL ---
function Dashboard() {
  const [alerta, setAlerta] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    const connection = new signalR.HubConnectionBuilder()
      .withUrl("http://localhost:5000/hubs/alerts")
      .withAutomaticReconnect()
      .build()

    connection.start()
      .then(() => {
        console.log("Conectado al Hub de SignalR")
        connection.on("BroadcastAlert", (usuario, zona, tipo) => {
          toast.error(`🚨 ¡EMERGENCIA! ${tipo} en ${zona}`, { position: "top-right" });
          setAlerta({ usuario, zona, tipo })
        })
      })
      .catch(err => console.warn("Esperando servidor..."))

    return () => connection.stop()
  }, [])

  return (
    <div style={{backgroundColor: '#f8f9fa', minHeight: '100vh'}}>
      <header style={STYLES.navBar}>
        <div style={{fontWeight: 'bold', fontSize: '18px'}}>SISTEMA DE GESTIÓN DE INCIDENTES</div>
        <button 
          onClick={() => navigate('/')} 
          style={{background: 'transparent', color: 'white', border: '1px solid white', padding: '5px 12px', borderRadius: '4px', cursor: 'pointer'}}
        >Cerrar Sesión</button>
      </header>

      <div style={STYLES.dashboardBody}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}>
          <h1 style={{color: '#333', fontSize: '24px'}}>Panel de Control de Alertas</h1>
          <div style={{fontSize: '13px', color: '#666'}}>
            <span style={STYLES.statusIndicator}></span> Servidor SignalR Activo
          </div>
        </div>

        <ToastContainer />

        <div style={{marginTop: '20px'}}>
          {!alerta ? (
            <div style={{textAlign: 'center', padding: '60px', backgroundColor: '#fff', borderRadius: '8px', border: '1px dashed #ccc'}}>
              <p style={{color: '#999', fontSize: '16px'}}>📡 Escaneando señales en tiempo real...</p>
              <button 
                onClick={() => {
                  toast.error("🚨 ¡EMERGENCIA! Botón de Pánico en FISEI", { position: "top-right" });
                  setAlerta({ usuario: "Juan Pérez", zona: "Facultad FISEI", tipo: "Botón de Pánico" });
                }}
                style={{
                  marginTop: '20px', padding: '10px 20px', backgroundColor: '#dc3545', 
                  color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold'
                }}
              >
                Simular Alerta Entrante
              </button>
            </div>
          ) : (
            <div style={STYLES.alertBox}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
                <h2 style={{margin: 0, color: '#b71c1c', fontSize: '20px'}}>⚠️ ALERTA EN PANTALLA</h2>
                <button 
                   onClick={() => setAlerta(null)}
                   style={{background: '#eee', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer'}}
                >Limpiar</button>
              </div>
              
              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px'}}>
                <div>
                  <label style={{display: 'block', fontSize: '12px', color: '#888', fontWeight: 'bold'}}>REPORTE DE:</label>
                  <span style={{fontSize: '16px'}}>{alerta.usuario}</span>
                </div>
                <div>
                  <label style={{display: 'block', fontSize: '12px', color: '#888', fontWeight: 'bold'}}>UBICACIÓN:</label>
                  <span style={{fontSize: '16px'}}>{alerta.zona}</span>
                </div>
                <div style={{gridColumn: 'span 2'}}>
                  <label style={{display: 'block', fontSize: '12px', color: '#888', fontWeight: 'bold'}}>TIPO DE INCIDENTE:</label>
                  <span style={{fontSize: '18px', color: '#b71c1c', fontWeight: 'bold'}}>{alerta.tipo}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Login onLogin={() => {}} />} />
      <Route path="/dashboard" element={<Dashboard />} />
    </Routes>
  )
}