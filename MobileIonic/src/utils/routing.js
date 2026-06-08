export const CAMPUS_CENTER = {
  latitude: -1.2687,
  longitude: -78.6247,
};

export const CAMPUS_ZONES = [
  {
    id: 'Z1',
    name: 'Zona 1',
    color: '#ef4444',
    coords: [
      { latitude: -1.266416, longitude: -78.625301 },
      { latitude: -1.26648, longitude: -78.624212 },
      { latitude: -1.268564, longitude: -78.624212 },
      { latitude: -1.268564, longitude: -78.62584 },
    ],
  },
  {
    id: 'Z2',
    name: 'Zona 2',
    color: '#d97706',
    coords: [
      { latitude: -1.26648, longitude: -78.624212 },
      { latitude: -1.266555, longitude: -78.622994 },
      { latitude: -1.268564, longitude: -78.62264 },
      { latitude: -1.268564, longitude: -78.624212 },
    ],
  },
  {
    id: 'Z3',
    name: 'Zona 3',
    color: '#2563eb',
    coords: [
      { latitude: -1.268564, longitude: -78.62584 },
      { latitude: -1.268564, longitude: -78.624212 },
      { latitude: -1.27065, longitude: -78.624212 },
      { latitude: -1.270376, longitude: -78.62638 },
    ],
  },
  {
    id: 'Z4',
    name: 'Zona 4',
    color: '#16a34a',
    coords: [
      { latitude: -1.268564, longitude: -78.624212 },
      { latitude: -1.268564, longitude: -78.62264 },
      { latitude: -1.270935, longitude: -78.622289 },
      { latitude: -1.27065, longitude: -78.624212 },
    ],
  },
];

export const WALKWAY_NODES = {
  norteOeste: { latitude: -1.26662, longitude: -78.62508 },
  norteCentro: { latitude: -1.26666, longitude: -78.62425 },
  norteEste: { latitude: -1.26672, longitude: -78.6232 },
  centroOeste: { latitude: -1.26818, longitude: -78.62535 },
  centro: { latitude: -1.26848, longitude: -78.62422 },
  centroEste: { latitude: -1.2685, longitude: -78.62308 },
  surOeste: { latitude: -1.27022, longitude: -78.62582 },
  surCentro: { latitude: -1.27042, longitude: -78.6242 },
  surEste: { latitude: -1.27055, longitude: -78.62286 },
};

export const WALKWAY_EDGES = [
  ['norteOeste', 'norteCentro'],
  ['norteCentro', 'norteEste'],
  ['norteOeste', 'centroOeste'],
  ['norteCentro', 'centro'],
  ['norteEste', 'centroEste'],
  ['centroOeste', 'centro'],
  ['centro', 'centroEste'],
  ['centroOeste', 'surOeste'],
  ['centro', 'surCentro'],
  ['centroEste', 'surEste'],
  ['surOeste', 'surCentro'],
  ['surCentro', 'surEste'],
];

export const distanceBetween = (a, b) => {
  if (!a || !b) return 0;
  const lat = (a.latitude - b.latitude) * 111320;
  const lng = (a.longitude - b.longitude) * 111320 * Math.cos((a.latitude * Math.PI) / 180);
  return Math.sqrt((lat * lat) + (lng * lng));
};

const findNearestWalkwayNode = (point) => {
  if (!point) return null;
  return Object.entries(WALKWAY_NODES).reduce((nearest, [id, coord]) => {
    const distance = distanceBetween(point, coord);
    return !nearest || distance < nearest.distance ? { id, distance } : nearest;
  }, null)?.id;
};

export const getWalkwayRoute = (origin, destination) => {
  if (!origin || !destination) return [];

  const start = findNearestWalkwayNode(origin);
  const end = findNearestWalkwayNode(destination);
  if (!start || !end) return [origin, destination];

  const graph = WALKWAY_EDGES.reduce((acc, [a, b]) => {
    acc[a] = acc[a] || [];
    acc[b] = acc[b] || [];
    const weight = distanceBetween(WALKWAY_NODES[a], WALKWAY_NODES[b]);
    acc[a].push({ id: b, weight });
    acc[b].push({ id: a, weight });
    return acc;
  }, {});

  const distances = Object.keys(WALKWAY_NODES).reduce((acc, id) => ({ ...acc, [id]: Infinity }), {});
  const previous = {};
  const pending = new Set(Object.keys(WALKWAY_NODES));
  distances[start] = 0;

  while (pending.size) {
    const current = [...pending].sort((a, b) => distances[a] - distances[b])[0];
    pending.delete(current);
    if (current === end) break;

    (graph[current] || []).forEach((neighbor) => {
      const nextDistance = distances[current] + neighbor.weight;
      if (nextDistance < distances[neighbor.id]) {
        distances[neighbor.id] = nextDistance;
        previous[neighbor.id] = current;
      }
    });
  }

  const pathIds = [];
  let cursor = end;
  while (cursor) {
    pathIds.unshift(cursor);
    if (cursor === start) break;
    cursor = previous[cursor];
  }

  if (pathIds[0] !== start) return [origin, destination];
  return [origin, ...pathIds.map((nodeId) => WALKWAY_NODES[nodeId]), destination];
};
