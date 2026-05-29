import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as signalR from '@microsoft/signalr';
import { MapContainer, Marker, Polygon, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import { BarChart3, Bell, CircleAlert, Filter, Flame, HandCoins, HeartPulse, MapPin, Search, ShieldAlert, SlidersHorizontal, TriangleAlert } from 'lucide-react';
import axios from 'axios';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import './App.css';
import LoginScreen from './LoginScreen';

const AUTH_STORAGE_KEY = 'uta_auth';
const AUTH_TTL_MS = 24 * 60 * 60 * 1000;
const ADMIN_USER = 'admin@uta.edu.ec';
const ADMIN_PASS = 'admin123';
const API_BASE_URL = `http://${window.location.hostname}:5000`;
const LOCAL_TIME_ZONE = 'America/Guayaquil';
const CLOSE_REASON_OPTIONS = [
  'No se encuentra en la Universidad',
  'Ubicación no confirmada',
  'Sin novedad / falsa alarma',
];

const parseBackendDate = (value) => {
  if (!value) return null;

  if (value instanceof Date) return value;

  const text = String(value);
  const hasTimeZone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(text);
  const date = new Date(hasTimeZone ? text : `${text}Z`);

  return Number.isNaN(date.getTime()) ? null : date;
};

const normalizeZoneLabel = (zone, geofence) => {
  const normalizedZone = String(zone || '').trim().toUpperCase();
  if (normalizedZone && normalizedZone !== 'NO DISPONIBLE' && normalizedZone !== 'UBICACIÓN DESCONOCIDA') {
    return zone;
  }

  const normalizedGeofence = String(geofence || '').trim().toUpperCase();

  if (normalizedGeofence.includes('INGEN')) return 'Zona 1';
  if (normalizedGeofence.includes('BIBLI')) return 'Zona 2';
  if (normalizedGeofence.includes('RECTOR') || normalizedGeofence.includes('ADMIN')) return 'Zona 3';
  if (normalizedGeofence.includes('DEPOR')) return 'Zona 4';

  return zone || geofence || 'Ubicación desconocida';
};

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const zones = [
  {
    id: 'Z1',
    label: 'Zona 1',
    color: '#f45cab',
    positions: [
      [-1.266416, -78.625301],
      [-1.26648, -78.624212],
      [-1.268564, -78.624212],
      [-1.268564, -78.62584],
    ],
  },
  {
    id: 'Z2',
    label: 'Zona 2',
    color: '#4d82ff',
    positions: [
      [-1.26648, -78.624212],
      [-1.266555, -78.622994],
      [-1.268564, -78.62264],
      [-1.268564, -78.624212],
    ],
  },
  {
    id: 'Z3',
    label: 'Zona 3',
    color: '#40d6a5',
    positions: [
      [-1.268564, -78.62584],
      [-1.268564, -78.624212],
      [-1.27065, -78.624212],
      [-1.270376, -78.62638],
    ],
  },
  {
    id: 'Z4',
    label: 'Zona 4',
    color: '#f7c948',
    positions: [
      [-1.268564, -78.624212],
      [-1.268564, -78.62264],
      [-1.270935, -78.622289],
      [-1.27065, -78.624212],
    ],
  },
];

const createRelativeDate = (hours = 0, minutes = 0) => new Date(Date.now() - ((hours * 60) + minutes) * 60 * 1000);

const seedIncidents = [
  {
    id: 'INC-123',
    motivo: 'ROBO',
    zone: 'Zona 2',
    user: 'Estudiante de Ingeniería',
    faculty: 'FISEI',
    status: 'Activo',
    time: 'hace 2 min',
    timestamp: createRelativeDate(0, 2),
    pos: { lat: -1.26749, lng: -78.624756 },
  },
  {
    id: 'INC-122',
    motivo: 'AGRESIÓN',
    zone: 'Zona 4',
    user: 'Estudiante de Administración',
    faculty: 'FCA',
    status: 'Asignado',
    time: 'hace 12 min',
    timestamp: createRelativeDate(0, 12),
    pos: { lat: -1.27001, lng: -78.62304 },
  },
  {
    id: 'INC-121',
    motivo: 'SOSPECHOSO',
    zone: 'Zona 3',
    user: 'Personal externo',
    faculty: 'Sin registro',
    status: 'Activo',
    time: 'hace 1 h',
    timestamp: createRelativeDate(1, 0),
    pos: { lat: -1.26956, lng: -78.62511 },
  },
  {
    id: 'INC-120',
    motivo: 'EMERGENCIA',
    zone: 'Zona 1',
    user: 'Estudiante de Mecánica',
    faculty: 'FISEI',
    status: 'Cerrado',
    time: 'hace 3 h',
    timestamp: createRelativeDate(3, 0),
    pos: { lat: -1.26782, lng: -78.62511 },
  },
];

const motiveIcons = {
  ROBO: HandCoins,
  AGRESIÓN: ShieldAlert,
  SOSPECHOSO: TriangleAlert,
  EMERGENCIA: CircleAlert,
  MEDICO: HeartPulse,
  INCENDIO: Flame,
};

const motiveColors = {
  ROBO: '#ff4fa3',
  AGRESIÓN: '#4d82ff',
  SOSPECHOSO: '#f7c948',
  EMERGENCIA: '#40d6a5',
  MEDICO: '#8f65ff',
  INCENDIO: '#ef4444',
};

const motiveGlyphs = {
  ROBO: '🦹',
  AGRESIÓN: '🛡️',
  SOSPECHOSO: '⚠️',
  EMERGENCIA: '🚨',
  MEDICO: '💗',
  INCENDIO: '🔥',
};

const createMarkerIcon = (motive) => {
  const normalized = String(motive || 'EMERGENCIA').toUpperCase();
  const color = motiveColors[normalized] || '#4d82ff';
  const glyph = motiveGlyphs[normalized] || '📍';

  return L.divIcon({
    className: 'incident-marker',
    html: `
      <span class="incident-marker__chip" style="background:${color}22;color:${color}">
        <span class="incident-marker__glyph">${glyph}</span>
      </span>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
};

const createGuardMarkerIcon = (guardName) => {
  const initial = String(guardName || 'G').trim().charAt(0).toUpperCase() || 'G';

  return L.divIcon({
    className: 'guard-marker',
    html: `<span class="guard-marker__chip">${initial}</span>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
};

const normalizeStatus = (status) => {
  const value = String(status || 'Activo').toUpperCase();

  if (value.includes('CERR')) {
    return 'Cerrado';
  }

  if (value.includes('ASIGN') || value.includes('ATEND')) {
    return 'Asignado';
  }

  return 'Activo';
};

const formatRelativeTime = (value) => {
  const date = parseBackendDate(value);

  if (!date || Number.isNaN(date.getTime())) {
    return 'Reciente';
  }

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(1, Math.floor(diffMs / 60000));
  const diffHours = Math.max(1, Math.floor(diffMs / 3600000));
  const diffDays = Math.max(1, Math.floor(diffMs / 86400000));

  if (diffMs < 60000) {
    return 'hace unos segundos';
  }

  if (diffMs < 3600000) {
    return `hace ${diffMinutes} min`;
  }

  if (diffMs < 86400000) {
    return `hace ${diffHours} h`;
  }

  return `hace ${diffDays} d`;
};

const formatLocalDateTime = (value) => {
  const date = parseBackendDate(value);
  if (!date || Number.isNaN(date.getTime())) return 'No disponible';

  return new Intl.DateTimeFormat('es-EC', {
    timeZone: LOCAL_TIME_ZONE,
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(date);
};

const toLocalDateKey = (value) => {
  const date = parseBackendDate(value);
  if (!date || Number.isNaN(date.getTime())) return '';

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: LOCAL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((part) => part.type === 'year')?.value || '0000';
  const month = parts.find((part) => part.type === 'month')?.value || '00';
  const day = parts.find((part) => part.type === 'day')?.value || '00';

  return `${year}-${month}-${day}`;
};

const getRangeLimitMs = (range) => {
  if (range === '24H') return 24 * 60 * 60 * 1000;
  if (range === '30D') return 30 * 24 * 60 * 60 * 1000;
  return 7 * 24 * 60 * 60 * 1000;
};

const getTimelineConfig = (range) => {
  if (range === '24H') {
    return {
      labels: Array.from({ length: 24 }, (_, hour) => `${String(hour).padStart(2, '0')}h`),
      getIndex: (date) => date.getHours(),
      totalMs: 24 * 60 * 60 * 1000,
      variant: 'hourly',
    };
  }

  if (range === '30D') {
    return {
      labels: ['1-5d', '6-10d', '11-15d', '16-20d', '21-25d', '26-30d'],
      getIndex: (date) => Math.min(5, Math.floor((Date.now() - date.getTime()) / (5 * 24 * 60 * 60 * 1000))),
      totalMs: 30 * 24 * 60 * 60 * 1000,
      variant: 'range',
    };
  }

  return {
    labels: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
    getIndex: (date) => (date.getDay() + 6) % 7,
    totalMs: 7 * 24 * 60 * 60 * 1000,
    variant: 'weekly',
  };
};

const dashboardReferenceNow = Date.now();
const DEFAULT_OPEN_ZOOM = 17;
const CAMPUS_CENTER = { lat: -1.2687, lng: -78.6247 };
const MAP_OPTIONS = {
  zoomControl: true,
  scrollWheelZoom: true,
  doubleClickZoom: true,
  dragging: false,
  touchZoom: true,
  boxZoom: false,
  keyboard: false,
};

function RecenterMap({ resetKey }) {
  const map = useMap();

  useEffect(() => {
    map.setView([CAMPUS_CENTER.lat, CAMPUS_CENTER.lng], DEFAULT_OPEN_ZOOM, { animate: true });
  }, [map, resetKey]);

  return null;
}

function FocusMap({ coords }) {
  const map = useMap();

  useEffect(() => {
    if (coords?.lat && coords?.lng) {
      map.flyTo([coords.lat, coords.lng], 18, { animate: true });
    }
  }, [coords, map]);

  return null;
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // log if needed
    // console.error(error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24 }}>
          <h2>Ha ocurrido un error en la aplicación</h2>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{String(this.state.error)}</pre>
          <p>Puedes recargar la página o revisar la consola para más detalles.</p>
        </div>
      );
    }

    return this.props.children;
  }
}

function ZoomControlPositioner() {
  const map = useMap();

  useEffect(() => {
    try {
      if (map && map.zoomControl && typeof map.zoomControl.setPosition === 'function') {
        map.zoomControl.setPosition('topright');
      } else if (map) {
        // fallback: add control explicitly
        L.control.zoom({ position: 'topright' }).addTo(map);
      }
    } catch (e) {
      // ignore
    }
  }, [map]);

  return null;
}

function StatCard({ title, value, detail, tone = 'neutral' }) {
  return (
    <article className={`stat-card stat-card--${tone}`}>
      <span className="stat-card__title">{title}</span>
      <strong className="stat-card__value">{value}</strong>
      <span className="stat-card__detail">{detail}</span>
    </article>
  );
}

function Tabs({ active, onChange }) {
  return (
    <div className="tabs" role="tablist" aria-label="Secciones del panel">
      <button className={`tab ${active === 'mapa' ? 'tab--active' : ''}`} onClick={() => onChange('mapa')}>
        <MapPin size={16} />
        Mapa
      </button>
      <button className={`tab ${active === 'historial' ? 'tab--active' : ''}`} onClick={() => onChange('historial')}>
        <TriangleAlert size={16} />
        Historial
      </button>
      <button className={`tab ${active === 'estadisticas' ? 'tab--active' : ''}`} onClick={() => onChange('estadisticas')}>
        <BarChart3 size={16} />
        Estadísticas
      </button>
    </div>
  );
}

function MetricBars({ values }) {
  return (
    <div className="metric-bars" aria-label="Resumen de incidentes por zona">
      {values.map((item) => (
        <div key={item.label} className="metric-bars__item">
          <div className="metric-bars__track">
            <div className="metric-bars__fill" style={{ height: `${item.height}%`, background: item.color }} />
          </div>
          <span className="metric-bars__value">{item.value}</span>
          <span className="metric-bars__label">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function TimelineBars({ values, variant }) {
  const max = Math.max(1, ...values.map((v) => v.value));
  const avg = values.reduce((s, v) => s + v.value, 0) / Math.max(1, values.length);
  const avgHeight = Math.max(18, Math.round((avg / max) * 100));

  return (
    <div className={`timeline timeline--${variant}`} aria-label="Tendencia por período" style={{ position: 'relative' }}>
      {values.map((item) => (
        <div key={item.label} className="timeline__bar" title={`${item.label} — ${item.value} incidentes`}>
          <span style={{ height: `${item.height}%`, background: item.color }} aria-hidden />
          <small>{item.label}</small>
          <strong>{item.value}</strong>
        </div>
      ))}

      <div className="timeline__avg" style={{ bottom: `calc(${avgHeight}% + 10px)` }} aria-hidden>
        <div className="timeline__avg-line" />
        <div className="timeline__avg-badge">Promedio: {Math.round(avg)}</div>
      </div>
    </div>
  );
}

function IncidentIcon({ motive }) {
  const normalized = String(motive || 'EMERGENCIA').toUpperCase();
  const glyph = motiveGlyphs[normalized] || '📍';
  const color = motiveColors[normalized] || '#4d82ff';

  return (
    <span className="incident-icon" style={{ background: `${color}22`, color }}>
      <span className="incident-icon__glyph">{glyph}</span>
    </span>
  );
}

const UNKNOWN_ZONE_LABEL = 'Ubicación Desconocida';

function App({ onLogout, session }) {
  const [view, setView] = useState('mapa');
  const [alerts, setAlerts] = useState(seedIncidents);
  const [mapResetKey, setMapResetKey] = useState(0);
  const [loadingIncidents, setLoadingIncidents] = useState(true);
  const [connected, setConnected] = useState(false);
  const [filterZone, setFilterZone] = useState('TODAS');
  const [filterMotivo, setFilterMotivo] = useState('TODOS');
  const [query, setQuery] = useState('');
  const [activeCoords, setActiveCoords] = useState(null);
  const [alertsDrawerOpen, setAlertsDrawerOpen] = useState(false);
  const [statsFilterOpen, setStatsFilterOpen] = useState(false);
  const [statsScope, setStatsScope] = useState('all');
  const [statsRange, setStatsRange] = useState('7D');
  const audioRef = useRef(null);
  const [historyStart, setHistoryStart] = useState('');
  const [historyEnd, setHistoryEnd] = useState('');
  const [historyQuery, setHistoryQuery] = useState('');
  const [historySelected, setHistorySelected] = useState(null);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [closeTarget, setCloseTarget] = useState(null);
  const [closeObservation, setCloseObservation] = useState('No se encuentra en la Universidad');
  const [closeModalVisible, setCloseModalVisible] = useState(false);
  const [toast, setToast] = useState(null);
  const [userLookup, setUserLookup] = useState({});
  const [guardLocations, setGuardLocations] = useState({});

  const showToast = (message, tone = 'success') => {
    setToast({ message, tone });
    window.clearTimeout(showToast._timer);
    showToast._timer = window.setTimeout(() => setToast(null), 3200);
  };

  const resolveUserName = (userId) => {
    if (!userId) return 'No disponible';
    const entry = userLookup[String(userId).toLowerCase()];
    if (!entry) return userId;
    return entry.name || entry.email || userId;
  };

  const getCurrentCloseUserId = () => {
    if (session?.userId) return session.userId;
    const searchValue = String(session?.displayName || session?.email || '').toLowerCase();
    if (searchValue) {
      const match = Object.entries(userLookup).find(([, value]) => {
        const name = String(value?.name || '').toLowerCase();
        const email = String(value?.email || '').toLowerCase();
        return name === searchValue || email === searchValue;
      });
      if (match) return match[0];
    }
    return '';
  };

  const removeAlert = (alertId) => {
    setAlerts((prev) => prev.filter((item) => item.id !== alertId));
  };

  const openCloseModal = (alert) => {
    setCloseTarget(alert);
    setCloseObservation('No se encuentra en la Universidad');
    setCloseModalVisible(true);
  };

  const handleCloseIncident = async () => {
    if (!closeTarget) return;

    const observation = String(closeObservation || '').trim() || 'No se encuentra en la Universidad';

    try {
      const payload = {
        incId: closeTarget.id,
        incObservacion: observation,
        usuId: getCurrentCloseUserId(),
      };

      const resp = await axios.post(`${API_BASE_URL}/api/incidents/close`, payload);
      if (resp?.data?.success) {
        const closedBy = getCurrentCloseUserId();
        const closedAt = new Date();

        setAlerts((prev) => prev.map((item) => {
          if (item.id !== closeTarget.id) return item;

          return {
            ...item,
            status: 'Cerrado',
            closedBy,
            closedAt,
            observation,
          };
        }));
        setCloseModalVisible(false);
        setCloseTarget(null);
        setCloseObservation('No se encuentra en la Universidad');
        showToast('La incidencia fue cerrada correctamente.');
      } else {
        showToast(resp?.data?.error || 'No se pudo cerrar la incidencia en el servidor.', 'error');
      }
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Error al comunicarse con el servidor.';
      showToast(`No se pudo cerrar la incidencia: ${msg}`, 'error');
    }
  };

  const clearFilters = () => {
    setFilterZone('TODAS');
    setFilterMotivo('TODOS');
    setQuery('');
    setStatsRange('7D');
  };

  const clearHistoryFilters = () => {
    setHistoryStart('');
    setHistoryEnd('');
    setHistoryQuery('');
  };

  const focusAlert = (alert) => {
    if (!alert?.pos?.lat || !alert?.pos?.lng) {
      return;
    }

    setView('mapa');
    setActiveCoords(alert.pos);
    setAlertsDrawerOpen(false);
  };

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const serverIp = window.location.hostname;
        const response = await axios.get(`http://${serverIp}:5000/api/identity/users`);
        const items = Array.isArray(response.data) ? response.data : [];
        const nextLookup = items.reduce((acc, item) => {
          if (item?.usuId) {
            const userKey = String(item.usuId).toLowerCase();
            const fullName = [item.usuNombre1, item.usuApellido1].filter(Boolean).join(' ').trim();
            acc[userKey] = {
              name: fullName || item.usuEmail || item.usuId,
              email: item.usuEmail || '',
            };
          }
          return acc;
        }, {});
        setUserLookup(nextLookup);
      } catch {
        // Ignore user directory failures; fallback will show the raw user id.
      }
    };

    const loadIncidents = async () => {
      try {
        const serverIp = window.location.hostname;
        const response = await axios.get(`http://${serverIp}:5000/api/incidents`);
        const items = Array.isArray(response.data) ? response.data : [];

        const mapped = items.map((item) => ({
          id: item.incId,
          motivo: String(item.incMotivo || 'EMERGENCIA').toUpperCase(),
          zone: normalizeZoneLabel(item.incZona, item.incGeocercaNombre),
          user: item.incReportadoPor || 'Usuario institucional',
          faculty: item.incFacultad || 'UTA',
          status: normalizeStatus(item.incEstado || item.incSeveridad),
          time: formatRelativeTime(item.incFechaReporte),
          timestamp: parseBackendDate(item.incFechaReporte) || new Date(),
          pos: { lat: item.incLatitud, lng: item.incLongitud },
          assignedBy: item.incAsignadoPor || null,
          assignedAt: parseBackendDate(item.incAsignadoEn),
          closedBy: item.incCerradoPor || null,
          closedAt: parseBackendDate(item.incCerradoEn),
          observation: item.incObservacion || '',
        }));

        const merged = [
          ...mapped,
          ...seedIncidents.filter((seed) => !mapped.some((item) => item.id === seed.id)),
        ];

        setAlerts(merged);
      } catch {
        // Si el backend todavía no responde, se mantiene la data semilla visual.
      } finally {
        setLoadingIncidents(false);
      }
    };

    loadUsers();
    loadIncidents();

    const serverIp = window.location.hostname;
    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`http://${serverIp}:5000/hubs/alerts`)
      .withAutomaticReconnect()
      .build();

    connection.on('ReceiveAlert', (incident) => {
      const nextIncident = {
        id: incident.incId || `INC-${Date.now()}`,
        motivo: (incident.incMotivo || 'EMERGENCIA').toUpperCase(),
        zone: normalizeZoneLabel(incident.incZona, incident.incGeocercaNombre),
        user: incident.incReportadoPor || 'Usuario institucional',
        faculty: incident.incFacultad || 'UTA',
        status: 'Activo',
        time: 'ahora',
        timestamp: new Date(),
        pos: { lat: incident.incLatitud, lng: incident.incLongitud },
        closedBy: null,
        closedAt: null,
        assignedBy: null,
        assignedAt: null,
        observation: '',
      };

      setAlerts((prev) => [nextIncident, ...prev]);

      if (audioRef.current) {
        audioRef.current.play().catch(() => {});
      }
    });

    connection.on('ReceiveIncidentUpdate', (incident) => {
      if (!incident?.incId) return;

      setAlerts((prev) => prev.map((item) => {
        if (item.id !== incident.incId) return item;

        const nextStatus = normalizeStatus(incident.incEstado || item.status);
        return {
          ...item,
          status: nextStatus,
          zone: normalizeZoneLabel(incident.incZona || item.zone, incident.incGeocercaNombre || item.zone),
          assignedBy: incident.incAsignadoPor || item.assignedBy || null,
          assignedAt: parseBackendDate(incident.incAsignadoEn) || item.assignedAt,
          closedBy: incident.incCerradoPor || item.closedBy || null,
          closedAt: parseBackendDate(incident.incCerradoEn) || item.closedAt,
          observation: incident.incObservacion || item.observation,
        };
      }));
    });

    connection.on('ReceiveGuardLocation', (location) => {
      const guardId = String(location?.guardId || location?.GuardId || '').trim();
      const latitude = Number(location?.latitude ?? location?.Latitude);
      const longitude = Number(location?.longitude ?? location?.Longitude);

      if (!guardId || Number.isNaN(latitude) || Number.isNaN(longitude)) {
        return;
      }

      const incidentId = location?.incidentId ?? location?.IncidentId ?? null;

      setGuardLocations((prev) => ({
        ...prev,
        [guardId.toLowerCase()]: {
          id: guardId,
          name: location?.guardName || location?.GuardName || guardId || 'Guardia',
          pos: { lat: latitude, lng: longitude },
          incidentId,
          incidentStatus: location?.incidentStatus || location?.IncidentStatus || null,
          incidentMotivo: location?.incidentMotivo || location?.IncidentMotivo || null,
          updatedAt: parseBackendDate(location?.updatedAt || location?.UpdatedAt) || new Date(),
        },
      }));
    });

    connection.start()
      .then(() => setConnected(true))
      .catch(() => setConnected(false));

    return () => connection.stop();
  }, []);

  const activeGuards = useMemo(() => Object.values(guardLocations), [guardLocations]);

  const rangeFilteredAlerts = useMemo(() => {
    const limitMs = getRangeLimitMs(statsRange);

    return alerts.filter((alert) => {
      const timestamp = alert.timestamp ? new Date(alert.timestamp).getTime() : null;
      if (!timestamp) return true;
      return dashboardReferenceNow - timestamp <= limitMs;
    });
  }, [alerts, statsRange]);

  const filteredAlerts = useMemo(() => {
    return rangeFilteredAlerts.filter((alert) => {
      // Exclude incidents already closed from the main dashboard lists
      if (String(alert.status || '').toLowerCase() === 'cerrado') return false;
      const matchesZone = filterZone === 'TODAS' || alert.zone.toUpperCase() === filterZone.toUpperCase();
      const matchesMotivo = filterMotivo === 'TODOS' || alert.motivo.toUpperCase() === filterMotivo.toUpperCase();
      const matchesQuery =
        !query.trim() ||
        [alert.id, alert.user, alert.zone, alert.motivo, alert.faculty, alert.status]
          .join(' ')
          .toLowerCase()
          .includes(query.toLowerCase());

      return matchesZone && matchesMotivo && matchesQuery;
    });
  }, [rangeFilteredAlerts, filterZone, filterMotivo, query]);

  const stats = useMemo(() => {
    const active = alerts.filter((item) => item.status === 'Activo').length;
    const assigned = alerts.filter((item) => item.status === 'Asignado').length;
    const closed = alerts.filter((item) => item.status === 'Cerrado').length;
    const avgResponse = '3m 22s';

    return { active, assigned, closed, avgResponse };
  }, [alerts]);

  const summaryStats = useMemo(() => ({
    total: filteredAlerts.length,
    active: filteredAlerts.filter((item) => item.status === 'Activo').length,
    assigned: filteredAlerts.filter((item) => item.status === 'Asignado').length,
    closed: filteredAlerts.filter((item) => item.status === 'Cerrado').length,
  }), [filteredAlerts]);

  const statsRangeAlerts = useMemo(() => {
    const limitMs = getRangeLimitMs(statsRange);

    return alerts.filter((alert) => {
      const timestamp = parseBackendDate(alert.timestamp);
      if (!timestamp) return true;
      return Date.now() - timestamp.getTime() <= limitMs;
    });
  }, [alerts, statsRange]);

  const statsAlerts = useMemo(() => {
    if (statsScope === 'active') {
      return statsRangeAlerts.filter((item) => item.status !== 'Cerrado');
    }

    return statsRangeAlerts;
  }, [statsRangeAlerts, statsScope]);

  const historyFiltered = useMemo(() => {
    return alerts
      .filter((alert) => {
        const alertDateKey = toLocalDateKey(alert.timestamp);
        if (historyStart && alertDateKey < historyStart) return false;
        if (historyEnd && alertDateKey > historyEnd) return false;
        if (historyQuery && historyQuery.trim()) {
          const q = historyQuery.toLowerCase();
          const hay = [alert.id, alert.user, alert.zone, alert.motivo, alert.faculty, alert.status]
            .join(' ')
            .toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [alerts, historyStart, historyEnd, historyQuery]);

  const timelineConfig = useMemo(() => getTimelineConfig(statsRange), [statsRange]);

  const zoneBreakdown = useMemo(() => {
    const zoneValues = zones.map((zone) => ({
      label: zone.label.replace(' / ADMINISTRACIÓN', '').replace('FACULTAD DE ', ''),
      value: statsAlerts.filter((item) => item.zone.toUpperCase() === zone.label.toUpperCase()).length,
      color: zone.color,
    }));

    const unknownValue = statsAlerts.filter((item) => {
      const zone = String(item.zone || '').trim().toLowerCase();
      return !zone || zone.includes('desconocida') || zone.includes('no disponible');
    }).length;

    const combined = [
      ...zoneValues,
      { label: UNKNOWN_ZONE_LABEL, value: unknownValue, color: '#9aa4b2' },
    ];

    const max = Math.max(1, ...combined.map((item) => item.value));

    return combined.map((item) => {
      return {
        ...item,
        height: Math.max(18, (item.value / max) * 100),
      };
    });
  }, [statsAlerts]);

  const statusBreakdown = useMemo(() => {
    const total = Math.max(1, statsAlerts.length);
    const active = statsAlerts.filter((item) => item.status === 'Activo').length;
    const assigned = statsAlerts.filter((item) => item.status === 'Asignado').length;
    const closed = statsAlerts.filter((item) => item.status === 'Cerrado').length;
    const activePercent = Math.round((active / total) * 100);

    return {
      total,
      active,
      assigned,
      closed,
      activePercent,
      conic: `conic-gradient(#ff4fa3 0 ${activePercent}%, #4d82ff ${activePercent}% ${activePercent + Math.round((assigned / total) * 100)}%, #40d6a5 ${activePercent + Math.round((assigned / total) * 100)}% 100%)`,
    };
  }, [statsAlerts]);

  const timelineBreakdown = useMemo(() => {
    const buckets = Array.from({ length: timelineConfig.labels.length }, (_, index) => ({
      label: timelineConfig.labels[index],
      value: 0,
      height: 0,
      color: '#4d82ff',
    }));

    statsAlerts.forEach((alert) => {
      const date = parseBackendDate(alert.timestamp);
      if (!date || Number.isNaN(date.getTime())) {
        return;
      }

      const index = timelineConfig.getIndex(date);
      if (buckets[index]) {
        buckets[index].value += 1;
      }
    });

    const max = Math.max(...buckets.map((bucket) => bucket.value));

    return buckets.map((bucket, index) => ({
      ...bucket,
      height: max === 0 ? 0 : Math.round((bucket.value / max) * 100),
      color: index % 2 === 0 ? '#4d82ff' : '#ff4fa3',
    }));
  }, [statsAlerts, timelineConfig]);

  const activeFilterSummary = useMemo(() => {
    const chips = [];

    if (query.trim()) chips.push(`Búsqueda: ${query.trim()}`);
    if (filterZone !== 'TODAS') chips.push(`Zona: ${filterZone}`);
    if (filterMotivo !== 'TODOS') chips.push(`Tipo: ${filterMotivo}`);
    if (statsRange !== '7D') chips.push(`Rango: ${statsRange}`);

    return chips;
  }, [query, filterZone, filterMotivo, statsRange]);

  return (
    <div className="app-shell">
      <audio ref={audioRef} src="https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3" />

      <aside className="sidebar">
        <div className="brand">
          <div className="brand__mark">UTA</div>
          <div>
            <h1>Uta Security</h1>
            <p>Panel administrativo</p>
          </div>
        </div>


        <Tabs active={view} onChange={setView} />

        <div className="sidebar__note">
          <ShieldAlert size={16} />
          Panel de visualización operativa del campus.
        </div>

        <div className="sidebar__summary">
          <span>En línea</span>
          <strong>{connected ? 'SignalR activo' : 'Conectando...'}</strong>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <h2>{view === 'mapa' ? 'Mapa operacional' : 'Estadísticas del campus'}</h2>
            <p>{view === 'mapa' ? 'Zonas, filtros e incidencias en tiempo real' : 'Resumen, tendencias y distribución de incidentes'}</p>
          </div>

          <div className="topbar__actions">
            {onLogout && (
              <div className="user-chip" title={`${session?.role || 'Sin rol'} · ${session?.email || ''}`}>
                <span className="user-chip__avatar">{(session?.displayName || 'A').charAt(0).toUpperCase()}</span>
                <div>
                  <strong>{session?.displayName || 'Usuario'}</strong>
                  <span>{session?.role || 'Admin'}</span>
                </div>
              </div>
            )}
            <label className="searchbox">
              <Search size={16} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar..." />
            </label>
            <button className="ghost-btn" type="button" onClick={() => setAlertsDrawerOpen((value) => !value)}>
              <Bell size={16} />
              Alertas
            </button>
            {onLogout && <button className="ghost-btn" type="button" onClick={onLogout} title="Cerrar sesión">Cerrar sesión</button>}
          </div>
        </header>

        {view === 'mapa' && (
          <section className="layout layout--map">
            <div className="summary-grid">
              <StatCard title="Incidentes visibles" value={summaryStats.total} detail={`Activos: ${summaryStats.active} · Asignados: ${summaryStats.assigned}`} tone="accent" />
              <StatCard title="Respuesta media" value={stats.avgResponse} detail="Según el filtro activo" />
              <StatCard title="Casos cerrados" value={summaryStats.closed} detail="Historial filtrado" />
              <StatCard title="Guardias en mapa" value={activeGuards.length} detail="Ubicación reportada en vivo" tone="soft" />
            </div>

            <div className="content-grid">
              <section className="panel panel--map">
                <div className="panel__header">
                  <div>
                    <h3>Mapa del campus</h3>
                    <p>Polígonos, incidencias activas y guardias en tiempo real</p>
                  </div>
                  <div className="legend">
                    {zones.map((zone) => (
                      <span key={zone.id}><i style={{ background: zone.color }} /> {zone.label}</span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" className="ghost-btn ghost-btn--small" onClick={() => {
                      setActiveCoords(null);
                      setMapResetKey((k) => k + 1);
                    }}>Recentrar mapa</button>
                  </div>
                </div>

                <div className="map-shell">
                    <MapContainer center={[CAMPUS_CENTER.lat, CAMPUS_CENTER.lng]} zoom={DEFAULT_OPEN_ZOOM} className="map" {...MAP_OPTIONS}>
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                      <RecenterMap resetKey={mapResetKey} />
                      {activeCoords && <FocusMap coords={activeCoords} />}

                    {zones.map((zone) => (
                      <Polygon key={zone.id} positions={zone.positions} pathOptions={{ color: zone.color, weight: 2, fillOpacity: 0.14 }}>
                        <Tooltip sticky direction="top" opacity={0.95}>
                          <span className="zone-tooltip">{zone.label}</span>
                        </Tooltip>
                      </Polygon>
                    ))}

                    {filteredAlerts.map((alert) => (
                      <Marker key={alert.id} position={[alert.pos.lat, alert.pos.lng]} icon={createMarkerIcon(alert.motivo)}>
                        <Popup>
                          <div className="popup-card">
                            <div className="popup-card__header">
                              <IncidentIcon motive={alert.motivo} />
                              <strong>{alert.motivo}</strong>
                            </div>
                            <p>{alert.user}</p>
                            <span>{alert.zone}</span>
                          </div>
                        </Popup>
                      </Marker>
                    ))}

                    {activeGuards.map((guard) => (
                      <Marker key={guard.id} position={[guard.pos.lat, guard.pos.lng]} icon={createGuardMarkerIcon(guard.name)}>
                        <Popup>
                          <div className="popup-card">
                            <div className="popup-card__header">
                              <span className="guard-popup-icon">G</span>
                              <strong>{guard.name}</strong>
                            </div>
                            <p>Incidencia activa: {guard.incidentId || 'Sin asignación reportada'}</p>
                            <span>{guard.incidentMotivo || guard.incidentStatus || 'Seguimiento en vivo'}</span>
                          </div>
                        </Popup>
                      </Marker>
                    ))}
                  </MapContainer>
                </div>
              </section>

              <aside className="panel panel--side">
                <div className="panel__header panel__header--stacked">
                  <div>
                    <h3>Filtros</h3>
                    <p>Refina por zona, tipo y búsqueda</p>
                  </div>
                  <div className="filter-badge">
                    <Filter size={14} /> Activos
                  </div>
                </div>

                <div className="filters">
                  <label>
                    Zona
                    <select value={filterZone} onChange={(e) => setFilterZone(e.target.value)}>
                      <option value="TODAS">Todas</option>
                      {zones.map((zone) => (
                        <option key={zone.id} value={zone.label}>{zone.label}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Tipo
                    <select value={filterMotivo} onChange={(e) => setFilterMotivo(e.target.value)}>
                      <option value="TODOS">Todos</option>
                      <option value="EMERGENCIA">Emergencia</option>
                      <option value="ROBO">Robo</option>
                      <option value="SOSPECHOSO">Sospechoso</option>
                      <option value="MEDICO">Médico</option>
                      <option value="INCENDIO">Incendio</option>
                      <option value="AGRESIÓN">Agresión</option>
                    </select>
                  </label>
                </div>

                <div className="guard-list">
                  <div className="incident-list__header">
                    <h3>Guardias en ruta</h3>
                    <span>{activeGuards.length}</span>
                  </div>
                  {activeGuards.map((guard) => (
                    <article key={guard.id} className="guard-card">
                      <span className="guard-card__avatar">{guard.name.charAt(0).toUpperCase()}</span>
                      <div>
                        <strong>{guard.name}</strong>
                        <p>{guard.incidentId ? `Atiende ${guard.incidentId}` : 'Disponible / sin incidencia activa'}</p>
                        <small>{formatRelativeTime(guard.updatedAt)}</small>
                      </div>
                    </article>
                  ))}
                  {activeGuards.length === 0 && <p className="empty-state">Aún no hay guardias reportando ubicación.</p>}
                </div>

                <div className="incident-list">
                  <div className="incident-list__header">
                    <h3>Incidencias recientes</h3>
                    <span>{filteredAlerts.length}</span>
                  </div>

                  {filteredAlerts.map((alert) => (
                    <article key={alert.id} className="incident-card" onClick={() => focusAlert(alert)}>
                      <div className="incident-card__top">
                        <span className="incident-card__tag">
                          <IncidentIcon motive={alert.motivo} />
                          {alert.motivo}
                        </span>
                        <span className={`incident-card__status incident-card__status--${alert.status.toLowerCase().replace(/\s+/g, '-')}`}>{alert.status}</span>
                      </div>
                      <strong>{alert.user}</strong>
                      <p>{alert.faculty} · {alert.zone}</p>
                      <p>Guardia asignado: {alert.assignedBy ? resolveUserName(alert.assignedBy) : 'Sin asignar'}</p>
                      <div className="incident-card__footer">
                        <small>{alert.time}</small>
                        <button type="button" className="incident-card__dismiss" onClick={(e) => {
                          e.stopPropagation();
                          openCloseModal(alert);
                        }}>
                          Quitar
                        </button>
                      </div>
                    </article>
                  ))}

                  {loadingIncidents && <p className="empty-state">Cargando incidencias reales...</p>}
                  {!loadingIncidents && filteredAlerts.length === 0 && <p className="empty-state">No hay incidencias que coincidan con los filtros.</p>}
                </div>
              </aside>
            </div>
          </section>
        )
        }

        {view === 'historial' && (
          <section className="layout layout--history">
            <div className="summary-grid">
              <StatCard title="Historial total" value={alerts.length} detail="Listado completo de alertas" />
            </div>

            <div className="content-grid">
              <section className="panel panel--wide">
                <div className="panel__header">
                  <div>
                    <h3>Historial de incidencias</h3>
                    <p>Listado completo. Usa el filtro por fecha para acotar resultados.</p>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.85rem' }}>
                      Desde
                      <input type="date" value={historyStart || ''} onChange={(e) => setHistoryStart(e.target.value)} />
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.85rem' }}>
                      Hasta
                      <input type="date" value={historyEnd || ''} onChange={(e) => setHistoryEnd(e.target.value)} />
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.85rem' }}>
                      Buscar
                      <input placeholder="Buscar..." value={historyQuery} onChange={(e) => setHistoryQuery(e.target.value)} />
                    </label>
                    <button type="button" className="ghost-btn ghost-btn--small" onClick={clearHistoryFilters}>
                      Limpiar
                    </button>
                  </div>
                </div>

                <div className="panel__body">
                  <div className="incident-list">
                    {historyFiltered.map((alert) => (
                      <article key={alert.id} className="incident-card" onClick={() => { setHistorySelected(alert); setHistoryModalVisible(true); }}>
                        <div className="incident-card__top">
                          <span className="incident-card__tag">
                            <IncidentIcon motive={alert.motivo} />
                            {alert.motivo}
                          </span>
                          <span className={`incident-card__status incident-card__status--${alert.status.toLowerCase().replace(/\s+/g, '-')}`}>{alert.status}</span>
                        </div>
                        <strong>{alert.user}</strong>
                        <p>{alert.faculty} · {alert.zone}</p>
                        <div className="incident-card__footer">
                          <small>{alert.time}</small>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              </section>
            </div>
          </section>
        )}

        {view === 'estadisticas' && (
          <section className="layout layout--stats">
            <div className="summary-grid">
              <StatCard title="Total incidentes" value={statsAlerts.length} detail={statsScope === 'active' ? 'Solo casos abiertos' : 'Incluye cerrados y asignados'} tone="accent" />
              <StatCard title="Casos activos" value={statsAlerts.filter((item) => item.status === 'Activo').length} detail="Siguen abiertos" />
              <StatCard title="Casos cerrados" value={statsAlerts.filter((item) => item.status === 'Cerrado').length} detail="Con seguimiento completo" />
              <StatCard title="Guardias en línea" value={activeGuards.length} detail="Reportando ubicación en vivo" tone="soft" />
            </div>

            <div className="stats-toolbar">
              <div className="stats-toolbar__chips">
                {['24H', '7D', '30D'].map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={`chip ${statsRange === item ? 'chip--active' : ''}`}
                    onClick={() => setStatsRange(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <div className="stats-toolbar__actions">
                <div className="stats-toolbar__chips">
                  <button type="button" className={`chip ${statsScope === 'all' ? 'chip--active' : ''}`} onClick={() => setStatsScope('all')}>
                    Todos
                  </button>
                  <button type="button" className={`chip ${statsScope === 'active' ? 'chip--active' : ''}`} onClick={() => setStatsScope('active')}>
                    Activos
                  </button>
                </div>
                <button type="button" className="ghost-btn ghost-btn--small" onClick={() => setStatsFilterOpen((value) => !value)}>
                  <SlidersHorizontal size={14} /> Filtro
                </button>
                <button type="button" className="ghost-btn ghost-btn--small" onClick={clearFilters}>
                  Limpiar
                </button>
              </div>
            </div>

            {activeFilterSummary.length > 0 && (
              <div className="active-filters">
                {activeFilterSummary.map((item) => (
                  <span key={item} className="active-filters__chip">{item}</span>
                ))}
              </div>
            )}

            {statsFilterOpen && (
              <div className="stats-filters-panel">
                <label>
                  Tipo
                  <select value={filterMotivo} onChange={(e) => setFilterMotivo(e.target.value)}>
                    <option value="TODOS">Todos</option>
                    <option value="EMERGENCIA">Emergencia</option>
                    <option value="ROBO">Robo</option>
                    <option value="SOSPECHOSO">Sospechoso</option>
                    <option value="MEDICO">Médico</option>
                    <option value="INCENDIO">Incendio</option>
                    <option value="AGRESIÓN">Agresión</option>
                  </select>
                </label>
                <label>
                  Zona
                  <select value={filterZone} onChange={(e) => setFilterZone(e.target.value)}>
                    <option value="TODAS">Todas</option>
                    {zones.map((zone) => (
                      <option key={zone.id} value={zone.label}>{zone.label}</option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            <div className="content-grid content-grid--stats">
              <section className="panel panel--wide">
                <div className="panel__header">
                  <div>
                    <h3>Distribución por zona</h3>
                    <p>Volumen de incidentes por sector según el rango y la vista seleccionada</p>
                  </div>
                  <button type="button" className="ghost-btn ghost-btn--small" onClick={() => setAlertsDrawerOpen((value) => !value)}><SlidersHorizontal size={14} /> Alertas</button>
                </div>
                <MetricBars values={zoneBreakdown} />
              </section>

              <section className="panel panel--chart">
                <div className="panel__header">
                  <div>
                    <h3>Estado de los casos</h3>
                    <p>Cómo está repartida la operación según lo que estás mirando</p>
                  </div>
                </div>

                <div className="donut-card">
                  <div className="donut" style={{ background: `radial-gradient(circle closest-side, #fff 64%, transparent 65% 100%), ${statusBreakdown.conic}` }} aria-label="Distribución de estados">
                    <span>{statusBreakdown.total}</span>
                  </div>
                  <div className="donut-legend">
                    <div><i className="dot dot--accent" /> Activos: {statusBreakdown.active}</div>
                    <div><i className="dot dot--blue" /> Asignados: {statusBreakdown.assigned}</div>
                    <div><i className="dot dot--green" /> Cerrados: {statusBreakdown.closed}</div>
                  </div>
                </div>
              </section>

              <section className="panel panel--chart">
                <div className="panel__header">
                  <div>
                    <h3>Tendencia horaria</h3>
                    <p>Incidentes agrupados por tramo del período seleccionado</p>
                  </div>
                </div>

                <TimelineBars values={timelineBreakdown} variant={timelineConfig.variant} />
              </section>
            </div>
          </section>
        )}

        {historyModalVisible && historySelected && (
          <div className="modal-overlay" onClick={() => setHistoryModalVisible(false)}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="modal-card__header">
                <h3>{historySelected.motivo}</h3>
                <small>{historySelected.user} · {historySelected.faculty}</small>
              </div>
              <div className="modal-card__body">
                <p><strong>Zona:</strong> {historySelected.zone}</p>
                <p><strong>Estado:</strong> {historySelected.status}</p>
                <p><strong>Fecha:</strong> {formatLocalDateTime(historySelected.timestamp)}</p>
                <p><strong>Cerrado por:</strong> {normalizeStatus(historySelected.status) === 'Cerrado' ? resolveUserName(historySelected.closedBy) : 'No disponible'}</p>
                <p><strong>Cerrado en:</strong> {formatLocalDateTime(historySelected.closedAt)}</p>
                <p><strong>Observación:</strong> {historySelected.observation || 'Sin observación'}</p>
                {historySelected.pos && <p><strong>Coordenadas:</strong> {historySelected.pos.lat}, {historySelected.pos.lng}</p>}
              </div>
              <div className="modal-card__footer">
                <button className="primary-btn" type="button" onClick={() => setHistoryModalVisible(false)}>Cerrar</button>
              </div>
            </div>
          </div>
        )}

        {closeModalVisible && closeTarget && (
          <div className="modal-overlay" onClick={() => setCloseModalVisible(false)}>
            <div className="modal-card modal-card--compact" onClick={(e) => e.stopPropagation()}>
              <div className="modal-card__header">
                <h3>Cerrar incidencia</h3>
                <small>{closeTarget.motivo} · {closeTarget.zone}</small>
              </div>
              <div className="modal-card__body">
                <p>Confirma el cierre y deja una observación. Si la dejas vacía se usará un texto por defecto.</p>
                <div className="close-reason-pills" aria-label="Razones rápidas de cierre">
                  {CLOSE_REASON_OPTIONS.map((reason) => (
                    <button
                      key={reason}
                      type="button"
                      className={`close-reason-pill ${closeObservation === reason ? 'close-reason-pill--active' : ''}`}
                      onClick={() => setCloseObservation(reason)}
                    >
                      {reason}
                    </button>
                  ))}
                </div>
                <label className="modal-field">
                  Observación de cierre
                  <textarea
                    rows="4"
                    value={closeObservation}
                    onChange={(e) => setCloseObservation(e.target.value)}
                    placeholder="No se encuentra en la Universidad"
                  />
                </label>
                <p className="modal-help">Se enviará también tu identificador para auditoría interna.</p>
              </div>
              <div className="modal-card__footer">
                <button className="ghost-btn" type="button" onClick={() => setCloseModalVisible(false)}>Cancelar</button>
                <button className="primary-btn" type="button" onClick={handleCloseIncident}>Cerrar incidencia</button>
              </div>
            </div>
          </div>
        )}

        {toast && (
          <div className={`toast toast--${toast.tone}`} role="status" aria-live="polite">
            {toast.message}
          </div>
        )}

        {alertsDrawerOpen && (
          <aside className="alerts-drawer">
            <div className="alerts-drawer__header">
              <div>
                <h3>Alertas recientes</h3>
                <p>{filteredAlerts.length} incidentes visibles en el rango actual</p>
              </div>
              <button type="button" className="ghost-btn ghost-btn--small" onClick={() => setAlertsDrawerOpen(false)}>Cerrar</button>
            </div>
            <div className="alerts-drawer__list">
              {filteredAlerts.slice(0, 5).map((alert) => (
                <article key={alert.id} className="alerts-drawer__item" onClick={() => focusAlert(alert)}>
                  <IncidentIcon motive={alert.motivo} />
                  <div>
                    <strong>{alert.motivo}</strong>
                    <p>{alert.zone}</p>
                  </div>
                  <button type="button" className="alerts-drawer__remove" onClick={(e) => {
                    e.stopPropagation();
                    openCloseModal(alert);
                  }}>
                    Quitar
                  </button>
                </article>
              ))}
            </div>
          </aside>
        )}
      </main>
    </div>
  );
}

function AppWrapper() {
  const [session, setSession] = useState(null);
  const [authError, setAuthError] = useState('');

  const determineRole = (userRole, userEmail = '') => {
    const email = String(userEmail).toLowerCase();
    const role = String(userRole || '').trim();
    if (role) return role;
    if (email === ADMIN_USER) return 'Admin';
    if (email.startsWith('guardia')) return 'Guardia';
    if (email.startsWith('estudiante')) return 'Estudiante';
    return 'User';
  };

  const clearSession = () => {
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch (e) {
      // ignore storage errors
    }
    setSession(null);
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem(AUTH_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed?.expiresAt || Date.now() > parsed.expiresAt) {
        clearSession();
        return;
      }

      if (parsed?.role === 'Admin') {
        setSession(parsed);
      } else {
        clearSession();
      }
    } catch (e) {
      // ignore parse errors
    }
  }, []);

  useEffect(() => {
    if (!session?.expiresAt) return undefined;

    const remainingMs = session.expiresAt - Date.now();
    if (remainingMs <= 0) {
      clearSession();
      return undefined;
    }

    const timer = setTimeout(() => {
      clearSession();
    }, remainingMs);

    return () => clearTimeout(timer);
  }, [session]);

  const handleLogin = async ({ user, pass } = {}) => {
    setAuthError('');
    if (!user || !pass) {
      setAuthError('Credenciales incompletas');
      return;
    }

    try {
      const response = await axios.post(`${API_BASE_URL}/api/identity/login`, {
        usuEmail: user,
        usuPassword: pass,
      });

      const data = response?.data || {};
      const role = determineRole(data.usuRole, data.usuEmail);

      if (role !== 'Admin') {
        setAuthError('Acceso denegado: se requiere cuenta con rol Admin');
        return;
      }

      const nextSession = {
        token: data.usuToken || '',
        userId: data.usuId || '',
        email: data.usuEmail || user,
        displayName: data.usuNombreCompleto || user,
        role,
        faculty: data.usuFacultad || '',
        expiresAt: Date.now() + AUTH_TTL_MS,
      };

      try {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextSession));
      } catch (e) {
        // ignore storage errors
      }

      setSession(nextSession);
      setAuthError('');
    } catch (error) {
      const statusCode = error?.response?.status;
      const message =
        error?.response?.data?.error ||
        (statusCode
          ? `El servidor de autenticación respondió con estado ${statusCode}.`
          : 'No se pudo conectar con el servicio de autenticación. Revisa que estén activos el Gateway y el microservicio de identidad.');
      setAuthError(message);
    }
  };

  const handleLogout = () => {
    clearSession();
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            session ? (
              <Navigate to="/panel" replace />
            ) : (
              <LoginScreen
                onLogin={handleLogin}
                demoCreds={{ user: ADMIN_USER, pass: ADMIN_PASS }}
                error={authError}
              />
            )
          }
        />
        <Route
          path="/panel"
          element={
            session ? (
              <ErrorBoundary>
                <App onLogout={handleLogout} session={session} />
              </ErrorBoundary>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route path="*" element={<Navigate to={session ? '/panel' : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default AppWrapper;
