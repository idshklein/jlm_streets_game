const GEOJSON_PATH = "../../tlv_streets.geojson";
let geojsonCache = null;

async function getStreetsGeojson() {
  if (!geojsonCache) {
    const res = await fetch(GEOJSON_PATH);
    if (!res.ok) throw new Error("Failed to load streets GeoJSON");
    geojsonCache = await res.json();
  }
  return geojsonCache;
}

function geometryToLeafletLines(geometry) {
  if (geometry.type === "MultiLineString")
    return geometry.coordinates.map(ring => ring.map(([lng, lat]) => [lat, lng]));
  if (geometry.type === "LineString")
    return [geometry.coordinates.map(([lng, lat]) => [lat, lng])];
  return [];
}

// TLV streets: ms_lamas matches the official_code from the CSV (LAMAS / CBS code)
export async function fetchStreetGeometry(officialCode) {
  const geojson = await getStreetsGeojson();
  const feature = geojson.features.find(f => f.properties.ms_lamas === officialCode);
  if (!feature?.geometry) return null;
  const lines = geometryToLeafletLines(feature.geometry);
  return lines.length ? { type: "multiline", coordinates: lines } : null;
}

export function isGisConfigured() { return true; }

// TLV streets: ms_lamas is the code key; shem_shchuna is the neighbourhood name
export async function getNeighbourhoodByCode() {
  const geojson = await getStreetsGeojson();
  const map = new Map();
  for (const f of geojson.features) {
    const code = f.properties.ms_lamas;
    const name = f.properties.shem_shchuna;
    if (code != null && name) map.set(code, name);
  }
  return map;
}
