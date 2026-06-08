export const INCIDENT_CATALOG = [
  { label: 'Robo/Asalto', value: 'ROBO_ASALTO', icon: 'cash-outline', color: '#d9467a' },
  { label: 'Arma blanca', value: 'ARMA_BLANCA', icon: 'shield-outline', color: '#ef4444' },
  { label: 'Emergencia medica', value: 'DESMAYO_EMERGENCIA_MEDICA', icon: 'heart-outline', color: '#7c3aed' },
  { label: 'Amenaza', value: 'AMENAZA', icon: 'warning-outline', color: '#d97706' },
  { label: 'Otros', value: 'OTROS', icon: 'alert-circle-outline', color: '#2563eb' },
];

export const INCIDENT_DEFAULT = INCIDENT_CATALOG.find((item) => item.value === 'OTROS') || INCIDENT_CATALOG[0];

export const normalizeIncidentValue = (value) =>
  String(value || '')
    .trim()
    .replace(/[\s/\\-]+/g, '_')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

export const mapIncidentTypesFromApi = (items = []) => {
  if (!Array.isArray(items) || items.length === 0) {
    return INCIDENT_CATALOG;
  }

  const mapped = items
    .filter((item) => item?.activo !== false)
    .map((item) => {
      const name = item.nombre || item.label || 'Otros';
      return {
        label: name,
        value: normalizeIncidentValue(item.codigo || item.value || name),
        icon: item.icon || 'alert-circle-outline',
        color: item.color || '#2563eb',
      };
    });

  return mapped.length ? mapped : INCIDENT_CATALOG;
};

export const getIncidentByValue = (value, catalog = INCIDENT_CATALOG) =>
  (catalog || INCIDENT_CATALOG).find((item) => item.value === normalizeIncidentValue(value)) || INCIDENT_DEFAULT;
