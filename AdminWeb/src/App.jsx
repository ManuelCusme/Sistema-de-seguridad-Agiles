import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as signalR from '@microsoft/signalr';
import { MapContainer, Marker, Polygon, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import { BarChart3, Bell, CircleAlert, Filter, Flame, HandCoins, HeartPulse, MapPin, Search, ShieldAlert, SlidersHorizontal, TriangleAlert } from 'lucide-react';
import axios from 'axios';
import 'leaflet/dist/leaflet.css';
import './App.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const zones = [
  {
    id: 'Z1',
    label: 'FACULTAD DE INGENIERÍA',
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
    label: 'BIBLIOTECA GENERAL',
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
    label: 'RECTORADO / ADMINISTRACIÓN',
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
    label: 'COMPLEJO DEPORTIVO',
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
    zone: 'BIBLIOTECA GENERAL',
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
    zone: 'COMPLEJO DEPORTIVO',
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
    zone: 'RECTORADO / ADMINISTRACIÓN',
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
    zone: 'FACULTAD DE INGENIERÍA',
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
  const date = value ? new Date(value) : null;

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
const MAP_OPTIONS = {
  zoomControl: true,
  scrollWheelZoom: true,
  doubleClickZoom: true,
  dragging: false,
  touchZoom: true,
  boxZoom: false,
  keyboard: false,
};

function RecenterMap({ coords }) {
  const map = useMap();

  useEffect(() => {
    if (coords?.lat && coords?.lng) {
      map.flyTo([coords.lat, coords.lng], 18, { animate: true });
    }
  }, [coords, map]);

  return null;
}

function FitToCampus({ alerts, resetKey }) {
  const map = useMap();

  useEffect(() => {
    const points = [
      ...zones.flatMap((zone) => zone.positions),
      ...alerts
        .filter((alert) => alert.pos?.lat && alert.pos?.lng)
        .map((alert) => [alert.pos.lat, alert.pos.lng]),
    ];

    if (points.length === 0) {
      return;
    }

      const bounds = L.latLngBounds(points);
      const padded = bounds.pad(0.12);
      map.fitBounds(padded, {
        paddingTopLeft: [70, 50],
        paddingBottomRight: [40, 40],
        maxZoom: 18,
        animate: true,
      });

      // In some cases the container size changes and Leaflet needs an invalidateSize
      // to correctly draw tiles — apply shortly after fitBounds.
      try {
        setTimeout(() => {
          if (map && typeof map.invalidateSize === 'function') {
            map.invalidateSize();
          }
        }, 200);
      } catch (e) {
        // ignore
      }

      // Lock map inside campus bounds so user can't pan/zoom away
      try {
        map.setMaxBounds(padded);
        if (typeof map.options !== 'undefined') map.options.maxBoundsViscosity = 1.0;
      } catch (e) {
        // ignore
      }

      // Ensure a consistent opening zoom: try to apply DEFAULT_OPEN_ZOOM
      map.once('zoomend', () => {
        try {
          const target = Math.min(DEFAULT_OPEN_ZOOM, map.getMaxZoom ? map.getMaxZoom() : 18);
          map.setView(padded.getCenter(), target, { animate: true });
        } catch (e) {
          // ignore
        }
      });
  }, [alerts, map, resetKey]);

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
  const Icon = motiveIcons[normalized] || CircleAlert;

  return (
    <span className="incident-icon" style={{ background: `${motiveColors[normalized] || '#4d82ff'}22`, color: motiveColors[normalized] || '#4d82ff' }}>
      <Icon size={15} />
    </span>
  );
}

function App() {
  const [view, setView] = useState('mapa');
  const [alerts, setAlerts] = useState(seedIncidents);
  const [mapResetKey, setMapResetKey] = useState(0);
  const [loadingIncidents, setLoadingIncidents] = useState(true);
  const [connected, setConnected] = useState(false);
  const [filterZone, setFilterZone] = useState('TODAS');
  const [filterMotivo, setFilterMotivo] = useState('TODOS');
  const [query, setQuery] = useState('');
  const [activeCoords, setActiveCoords] = useState(seedIncidents[0].pos);
  const [alertsDrawerOpen, setAlertsDrawerOpen] = useState(false);
  const [statsFilterOpen, setStatsFilterOpen] = useState(false);
  const [statsRange, setStatsRange] = useState('7D');
  const audioRef = useRef(null);

  const clearFilters = () => {
    setFilterZone('TODAS');
    setFilterMotivo('TODOS');
    setQuery('');
    setStatsRange('7D');
  };

  useEffect(() => {
    const loadIncidents = async () => {
      try {
        const serverIp = window.location.hostname;
        const response = await axios.get(`http://${serverIp}:5000/api/incidents`);
        const items = Array.isArray(response.data) ? response.data : [];

        const mapped = items.map((item) => ({
          id: item.incId,
          motivo: String(item.incMotivo || 'EMERGENCIA').toUpperCase(),
          zone: item.incZona || item.incGeocercaNombre || 'Ubicación desconocida',
          user: item.incReportadoPor || 'Usuario institucional',
          faculty: item.incFacultad || 'UTA',
          status: normalizeStatus(item.incEstado || item.incSeveridad),
          time: formatRelativeTime(item.incFechaReporte),
          timestamp: item.incFechaReporte ? new Date(item.incFechaReporte) : new Date(),
          pos: { lat: item.incLatitud, lng: item.incLongitud },
        }));

        const merged = [
          ...mapped,
          ...seedIncidents.filter((seed) => !mapped.some((item) => item.id === seed.id)),
        ];

        setAlerts(merged);

        const firstWithCoords = merged.find((incident) => incident.pos.lat && incident.pos.lng);
        if (firstWithCoords) {
          setActiveCoords(firstWithCoords.pos);
        }
      } catch {
        // Si el backend todavía no responde, se mantiene la data semilla visual.
      } finally {
        setLoadingIncidents(false);
      }
    };

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
        zone: incident.incGeocercaNombre || incident.incZona || 'Ubicación desconocida',
        user: incident.incReportadoPor || 'Usuario institucional',
        faculty: incident.incFacultad || 'UTA',
        status: 'Activo',
        time: 'ahora',
          timestamp: new Date(),
        pos: { lat: incident.incLatitud, lng: incident.incLongitud },
      };

      setAlerts((prev) => [nextIncident, ...prev]);
      if (nextIncident.pos.lat && nextIncident.pos.lng) {
        setActiveCoords(nextIncident.pos);
      }

      if (audioRef.current) {
        audioRef.current.play().catch(() => {});
      }
    });

    connection.start()
      .then(() => setConnected(true))
      .catch(() => setConnected(false));

    return () => connection.stop();
  }, []);

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

  const timelineConfig = useMemo(() => getTimelineConfig(statsRange), [statsRange]);

  const zoneBreakdown = useMemo(() => {
    const max = Math.max(1, ...zones.map((zone) => filteredAlerts.filter((item) => item.zone.toUpperCase() === zone.label.toUpperCase()).length));

    return zones.map((zone) => {
      const value = filteredAlerts.filter((item) => item.zone.toUpperCase() === zone.label.toUpperCase()).length;
      return {
        label: zone.label.replace(' / ADMINISTRACIÓN', '').replace('FACULTAD DE ', ''),
        value,
        height: Math.max(18, (value / max) * 100),
        color: zone.color,
      };
    });
  }, [filteredAlerts]);

  const statusBreakdown = useMemo(() => {
    const total = Math.max(1, filteredAlerts.length);
    const active = filteredAlerts.filter((item) => item.status === 'Activo').length;
    const assigned = filteredAlerts.filter((item) => item.status === 'Asignado').length;
    const closed = filteredAlerts.filter((item) => item.status === 'Cerrado').length;
    const activePercent = Math.round((active / total) * 100);

    return {
      total,
      active,
      assigned,
      closed,
      activePercent,
      conic: `conic-gradient(#ff4fa3 0 ${activePercent}%, #4d82ff ${activePercent}% ${activePercent + Math.round((assigned / total) * 100)}%, #40d6a5 ${activePercent + Math.round((assigned / total) * 100)}% 100%)`,
    };
  }, [filteredAlerts]);

  const timelineBreakdown = useMemo(() => {
    const buckets = Array.from({ length: timelineConfig.labels.length }, (_, index) => ({
      label: timelineConfig.labels[index],
      value: 0,
      height: 0,
      color: '#4d82ff',
    }));

    filteredAlerts.forEach((alert) => {
      const date = alert.timestamp ? new Date(alert.timestamp) : null;
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
  }, [filteredAlerts, timelineConfig]);

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
            <label className="searchbox">
              <Search size={16} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar..." />
            </label>
            <button className="ghost-btn" type="button" onClick={() => setAlertsDrawerOpen((value) => !value)}>
              <Bell size={16} />
              Alertas
            </button>
          </div>
        </header>

        {view === 'mapa' ? (
          <section className="layout layout--map">
            <div className="summary-grid">
              <StatCard title="Incidentes visibles" value={summaryStats.total} detail={`Activos: ${summaryStats.active} · Asignados: ${summaryStats.assigned}`} tone="accent" />
              <StatCard title="Respuesta media" value={stats.avgResponse} detail="Según el filtro activo" />
              <StatCard title="Casos cerrados" value={summaryStats.closed} detail="Historial filtrado" />
              <StatCard title="Zonas vigiladas" value="4" detail="Campus Huachi" tone="soft" />
            </div>

            <div className="content-grid">
              <section className="panel panel--map">
                <div className="panel__header">
                  <div>
                    <h3>Mapa del campus</h3>
                    <p>Polígonos, zonas y marcador de incidentes activos</p>
                  </div>
                  <div className="legend">
                    {zones.map((zone) => (
                      <span key={zone.id}><i style={{ background: zone.color }} /> {zone.label}</span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" className="ghost-btn ghost-btn--small" onClick={() => setMapResetKey((k) => k + 1)}>Recentrar mapa</button>
                  </div>
                </div>

                <div className="map-shell">
                  <MapContainer center={activeCoords} zoom={17} className="map" {...MAP_OPTIONS}>
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <FitToCampus alerts={filteredAlerts} resetKey={mapResetKey} />
                    <RecenterMap coords={activeCoords} />

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
                      <option value="AGRESIÓN">Agresión</option>
                    </select>
                  </label>
                </div>

                <div className="incident-list">
                  <div className="incident-list__header">
                    <h3>Incidencias recientes</h3>
                    <span>{filteredAlerts.length}</span>
                  </div>

                  {filteredAlerts.map((alert) => (
                    <article key={alert.id} className="incident-card" onClick={() => setActiveCoords(alert.pos)}>
                      <div className="incident-card__top">
                        <span className="incident-card__tag">
                          <IncidentIcon motive={alert.motivo} />
                          {alert.motivo}
                        </span>
                        <span className={`incident-card__status incident-card__status--${alert.status.toLowerCase().replace(/\s+/g, '-')}`}>{alert.status}</span>
                      </div>
                      <strong>{alert.user}</strong>
                      <p>{alert.faculty} · {alert.zone}</p>
                      <small>{alert.time}</small>
                    </article>
                  ))}

                  {loadingIncidents && <p className="empty-state">Cargando incidencias reales...</p>}
                  {!loadingIncidents && filteredAlerts.length === 0 && <p className="empty-state">No hay incidencias que coincidan con los filtros.</p>}
                </div>
              </aside>
            </div>
          </section>
        ) : (
          <section className="layout layout--stats">
            <div className="summary-grid">
              <StatCard title="Total incidentes" value={summaryStats.total} detail="Según los filtros activos" tone="accent" />
              <StatCard title="Casos activos" value={summaryStats.active} detail="Siguen abiertos" />
              <StatCard title="Casos cerrados" value={summaryStats.closed} detail="Con seguimiento completo" />
              <StatCard title="Guardias en línea" value="7" detail="Conectados al sistema" tone="soft" />
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
                    <p>Volumen de incidentes por sector según el filtro activo</p>
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
                <article key={alert.id} className="alerts-drawer__item" onClick={() => {
                  setView('mapa');
                  setActiveCoords(alert.pos);
                  setAlertsDrawerOpen(false);
                }}>
                  <IncidentIcon motive={alert.motivo} />
                  <div>
                    <strong>{alert.motivo}</strong>
                    <p>{alert.zone}</p>
                  </div>
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
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}

export default AppWrapper;
