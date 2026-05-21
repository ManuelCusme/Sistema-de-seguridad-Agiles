import React, { useEffect, useState, useRef } from 'react';
import * as signalR from '@microsoft/signalr';
import { AlertCircle, Radio, Clock, Lock, User, LogIn, MapPin, ShieldAlert, Filter } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Rectangle, Tooltip, Polygon } from 'react-leaflet';
import axios from 'axios';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import './App.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Zonas Reales (Ajustadas a UTA Huachi según Planificación de Sprint 2)
const zones = [
  {
    id: 'Z1',
    positions: [
      [-1.266416, -78.625301], // NW (Celeste)
      [-1.26648, -78.624212],  // TopMid
      [-1.268564, -78.624212], // Centro
      [-1.268564, -78.62584]   // LeftMid
    ],
    color: '#FF5252',
    label: 'FACULTAD DE INGENIERÍA'
  },
  {
    id: 'Z2',
    positions: [
      [-1.26648, -78.624212],  // TopMid
      [-1.266555, -78.622994], // NE (Morado)
      [-1.268564, -78.62264],  // RightMid
      [-1.268564, -78.624212]  // Centro
    ],
    color: '#FFD740',
    label: 'BIBLIOTECA GENERAL'
  },
  {
    id: 'Z3',
    positions: [
      [-1.268564, -78.62584],   // LeftMid
      [-1.268564, -78.624212],  // Centro
      [-1.27065, -78.624212],   // BottomMid
      [-1.270376, -78.626380]   // SW (Verde)
    ],
    color: '#40C4FF',
    label: 'RECTORADO / ADMINISTRACIÓN'
  },
  {
    id: 'Z4',
    positions: [
      [-1.268564, -78.624212], // Centro
      [-1.268564, -78.62264],  // RightMid
      [-1.270935, -78.622289], // SE (Rosa)
      [-1.27065, -78.624212]   // BottomMid
    ],
    color: '#69F0AE',
    label: 'COMPLEJO DEPORTIVO'
  },
];

function RecenterMap({ coords }) {
  const map = useMap();
  useEffect(() => {
    if (coords && coords.lat && coords.lng) {
      map.flyTo([coords.lat, coords.lng], 17);
    }
  }, [coords, map]);
  return null;
}

function App() {
  // =========================================================================
  // ATENCIÓN MATEO: CAMBIO TEMPORAL DE DESARROLLO (Bypass de Login)
  // Al terminar tu trabajo de filtros y cierre de casos, cambia 'true' por 'false'.
  // =========================================================================
  const [isLoggedIn, setIsLoggedIn] = useState(false); 
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const [alerts, setAlerts] = useState([]);
  const [connected, setConnected] = useState(false);
  const [activeCoords, setActiveCoords] = useState({ lat: -1.2687, lng: -78.6247 });
  const audioRef = useRef(null);
  const [filterZone, setFilterZone] = useState('TODAS');
  const [filterMotivo, setFilterMotivo] = useState('TODOS');

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const serverIp = window.location.hostname;
      const res = await axios.post(`http://${serverIp}:5000/api/identity/login`, {
        usuEmail: email,
        usuPassword: password
      });

      const userData = res.data;
      const userRole = userData.usuRole;

      if (userRole === 'Admin') {
        setIsLoggedIn(true);
        setError('');
      } else {
        setError('Acceso denegado. Solo administradores.');
      }
    } catch (err) {
      setError('Credenciales incorrectas o servidor fuera de línea');
    }
  };

  useEffect(() => {
    if (!isLoggedIn) return;

    const serverIp = window.location.hostname;
    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`http://${serverIp}:5000/hubs/alerts`)
      .withAutomaticReconnect()
      .build();

    connection.on("ReceiveAlert", (incident) => {
      const newAlert = {
        id: incident.incId || Date.now(),
        user: incident.incReportadoPor,
        pos: { lat: incident.incLatitud, lng: incident.incLongitud },
        zone: incident.incGeocercaNombre || "Ubicación desconocida",
        motivo: incident.incMotivo || "Emergencia",
        facultad: incident.incFacultad || "FISEI",
        time: new Date().toLocaleTimeString(),
        isInside: incident.incGeocercaNombre && incident.incGeocercaNombre !== "Ubicación desconocida"
      };

      setAlerts(prev => [newAlert, ...prev]);
      if (newAlert.isInside) setActiveCoords(newAlert.pos);

      if (audioRef.current) {
        audioRef.current.play().catch(() => { });
      }
    });

    connection.on("IncidentClosed", (incidentId) => {
      setAlerts(prev => prev.filter(a => a.id !== incidentId));
    });

    connection.start()
      .then(() => setConnected(true))
      .catch(() => setConnected(false));

    return () => connection.stop();
  }, [isLoggedIn]);

  if (!isLoggedIn) {
    return (
      <div className="login-container">
        <form className="login-card" onSubmit={handleLogin}>
          <div className="logo-dot"></div>
          <h2>UTA ADMIN PANEL</h2>
          <p>Ingrese sus credenciales de administrador</p>
          <div className="input-group">
            <User size={18} />
            <input type="email" placeholder="Email DITIC" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="input-group">
            <Lock size={18} />
            <input type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <div className="error-msg">{error}</div>}
          <button type="submit" className="login-btn"><LogIn size={18} style={{ marginRight: 8 }} /> Acceder</button>
        </form>
      </div>
    );
  }

  const dismissAlert = (id, e) => {
    e.stopPropagation();
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  const filteredAlerts = alerts.filter(alert => {
    const matchesZone = filterZone === 'TODAS' || alert.zone.toUpperCase() === filterZone.toUpperCase();
    const matchesMotivo = filterMotivo === 'TODOS' || alert.motivo.toUpperCase() === filterMotivo.toUpperCase();
    return matchesZone && matchesMotivo;
  });

  return (
    <div className="dashboard">
      <audio ref={audioRef} src="https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3" />

      <aside className="sidebar">
        <div className="header">
          <div className="logo-dot"></div>
          <h1 style={{ fontSize: '1.2rem', margin: 0 }}>UTA SECURITY</h1>
          <button onClick={() => setIsLoggedIn(false)} className="logout-btn">Salir</button>
        </div>

        <div className="filter-container" style={{ padding: '0 15px 15px 15px', borderBottom: '1px solid #333', marginBottom: '15px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#aaa', fontWeight: 'bold', marginBottom: '12px', letterSpacing: '0.5px' }}>
            <Filter size={14} /> FILTROS TÁCTICOS
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '0.7rem', color: '#777', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Zona:</label>
              <select 
                value={filterZone} 
                onChange={(e) => setFilterZone(e.target.value)}
                style={{ 
                  width: '100%', 
                  padding: '8px', 
                  borderRadius: '4px', 
                  border: '1px solid #444', 
                  background: '#2a2a3e', 
                  color: '#ffffff',
                  fontSize: '0.85rem', 
                  cursor: 'pointer',
                  outline: 'none'
                }}
              >
                <option value="TODAS">🌍 Todas las ubicaciones</option>
                <option value="FACULTAD DE INGENIERÍA">🔴 Fac. Ingeniería</option>
                <option value="BIBLIOTECA GENERAL">🟡 Biblioteca General</option>
                <option value="RECTORADO / ADMINISTRACIÓN">🔵 Rectorado / Admin</option>
                <option value="COMPLEJO DEPORTIVO">🟢 Complejo Deportivo</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.7rem', color: '#777', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Incidente:</label>
              <select 
                value={filterMotivo} 
                onChange={(e) => setFilterMotivo(e.target.value)}
                style={{ 
                  width: '100%', 
                  padding: '8px', 
                  borderRadius: '4px', 
                  border: '1px solid #444', 
                  background: '#2a2a3e', 
                  color: '#ffffff',
                  fontSize: '0.85rem', 
                  cursor: 'pointer',
                  outline: 'none'
                }}
              >
                <option value="TODOS">⚠️ Todos los tipos</option>
                <option value="EMERGENCIA">Emergencia General</option>
                <option value="ROBO">Robo / Hurto</option>
                <option value="SOSPECHOSO">Actividad Sospechosa</option>
                <option value="AGRESIÓN">Agresión / Pelea</option>
              </select>
            </div>
          </div>
        </div>

        <div className="alert-list">
          <h2 style={{ fontSize: '0.9rem', color: '#666', marginBottom: '15px' }}>SALA DE INCIDENTES ({filteredAlerts.length})</h2>
          
          {/* --- Ahora iteramos sobre filteredAlerts en vez de alerts --- */}
          {filteredAlerts.map(alert => (
            <div key={alert.id} className="alert-card active-alert"
              onClick={() => alert.isInside && setActiveCoords(alert.pos)}>
              <div className="alert-header">
                <span className="motivo-badge">{alert.motivo.toUpperCase()}</span>
                <button className="dismiss-btn" onClick={(e) => dismissAlert(alert.id, e)}>DESCARTAR</button>
              </div>
              <div className="user-name">{alert.user}</div>
              <div className="user-info">{alert.facultad} • {alert.zone}</div>
              <div className="alert-footer">
                <MapPin size={12} /> Ver ubicación en tiempo real
              </div>
            </div>
          ))}
          {filteredAlerts.length === 0 && <p style={{ textAlign: 'center', color: '#444', marginTop: 40 }}>No hay reportes que coincidan...</p>}
        </div>
      </aside>

      <main className="main-map">
        <div className="status-bar" style={{ zIndex: 1000 }}>
          <div className={`pulse-dot ${connected ? 'online' : 'offline'}`}></div>
          {connected ? 'SISTEMA TÁCTICO EN LINEA' : 'SISTEMA DESCONECTADO (REINTENTANDO...)'}
        </div>

        <MapContainer center={activeCoords} zoom={16} zoomControl={false} style={{ height: '100%', width: '100%' }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <RecenterMap coords={activeCoords} />

          {/* Dibujo de las 4 Zonas de la Pizarra con Efecto Hover */}
          {zones.map(z => (
            <Polygon
              key={z.id}
              positions={z.positions}
              pathOptions={{ color: z.color, weight: 2, fillOpacity: 0.12 }}
            >
              <Tooltip sticky direction="top" opacity={0.9}>
                <span style={{ fontWeight: 'bold', color: '#333' }}>{z.label}</span>
              </Tooltip>
            </Polygon>
          ))}

          {/* --- Los marcadores del mapa también respetan los filtros dinámicos --- */}
          {filteredAlerts.filter(a => a.isInside).map(alert => (
            <Marker key={alert.id} position={[alert.pos.lat, alert.pos.lng]}>
              <Popup>
                <div style={{ textAlign: 'center' }}>
                  <strong style={{ color: '#D32F2F' }}>{alert.motivo}</strong><br />
                  <strong>{alert.user}</strong><br />
                  {alert.facultad}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </main>
    </div>
  );
}

export default App;