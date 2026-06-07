export const INCIDENT_CATALOG = [
  { label: 'Robo/Asalto', value: 'ROBO_ASALTO', emoji: '💰', color: '#ff4fa3' },
  { label: 'Arma blanca', value: 'ARMA_BLANCA', emoji: '🛡️', color: '#ef4444' },
  { label: 'Desmayo/Emergencia médica', value: 'DESMAYO_EMERGENCIA_MEDICA', emoji: '❤️', color: '#8f65ff' },
  { label: 'Amenaza', value: 'AMENAZA', emoji: '⚠️', color: '#f7c948' },
  { label: 'Otros', value: 'OTROS', emoji: '🚨', color: '#4d82ff' },
];

export const INCIDENT_DEFAULT = INCIDENT_CATALOG.find((item) => item.value === 'OTROS') || INCIDENT_CATALOG[0];

export const mapIncidentTypesFromApi = (items = []) => {
  if (!Array.isArray(items) || items.length === 0) {
    return INCIDENT_CATALOG;
  }

  const mapped = items
    .filter((item) => item?.activo !== false)
    .map((item) => ({
      label: item.nombre || item.label || 'Otros',
      value: String(item.codigo || item.value || item.nombre || 'OTROS').toUpperCase(),
      emoji: item.emoji || '🚨',
      color: item.color || '#4d82ff',
    }));

  return mapped.length ? mapped : INCIDENT_CATALOG;
};

export const getIncidentByValue = (value, catalog = INCIDENT_CATALOG) => {
  const normalized = String(value || '').toUpperCase();
  return (catalog || INCIDENT_CATALOG).find((item) => item.value === normalized) || INCIDENT_DEFAULT;
};
