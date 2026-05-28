export const INCIDENT_CATALOG = [
  { label: 'ROBO', value: 'ROBO', emoji: '🦹', color: '#ff4fa3' },
  { label: 'AGRESIÓN', value: 'AGRESIÓN', emoji: '🛡️', color: '#4d82ff' },
  { label: 'SOSPECHOSO', value: 'SOSPECHOSO', emoji: '⚠️', color: '#f7c948' },
  { label: 'EMERGENCIA', value: 'EMERGENCIA', emoji: '🚨', color: '#40d6a5' },
  { label: 'MEDICO', value: 'MEDICO', emoji: '💗', color: '#8f65ff' },
  { label: 'INCENDIO', value: 'INCENDIO', emoji: '🔥', color: '#ef4444' },
];

export const INCIDENT_DEFAULT = INCIDENT_CATALOG.find((item) => item.value === 'EMERGENCIA') || INCIDENT_CATALOG[0] || {
  label: 'EMERGENCIA',
  value: 'EMERGENCIA',
  emoji: '🚨',
  color: '#40d6a5',
};

export const getIncidentByValue = (value) => {
  const normalized = String(value || '').toUpperCase();
  return INCIDENT_CATALOG.find((item) => item.value === normalized) || INCIDENT_DEFAULT;
};
