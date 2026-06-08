const GUAYAQUIL_OFFSET_MS = 5 * 60 * 60 * 1000;

export const parseBackendDate = (value) => {
  if (!value) return null;
  const text = String(value);
  const hasTimeZone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(text);
  const date = new Date(hasTimeZone ? text : `${text}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatDateTime = (value) => {
  const date = parseBackendDate(value);
  if (!date) return 'No disponible';
  const local = new Date(date.getTime() - GUAYAQUIL_OFFSET_MS);
  return local.toLocaleString('es-EC', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'UTC',
  });
};
