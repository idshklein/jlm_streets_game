const GEOJSON_PATH = "./jlm_streets.geojson";

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
  if (geometry.type === "MultiLineString") {
    return geometry.coordinates.map((ring) => ring.map(([lng, lat]) => [lat, lng]));
  }
  if (geometry.type === "LineString") {
    return [geometry.coordinates.map(([lng, lat]) => [lat, lng])];
  }
  return [];
}

export async function fetchStreetGeometryFromJerusalemGis(officialCode) {
  const geojson = await getStreetsGeojson();
  const feature = geojson.features.find((f) => f.properties.s_code === officialCode);
  if (!feature?.geometry) return null;
  const lines = geometryToLeafletLines(feature.geometry);
  if (!lines.length) return null;
  return { type: "multiline", coordinates: lines };
}

export function isJerusalemGisConfigured() {
  return true;
}

export async function getNeighbourhoodByCode() {
  const geojson = await getStreetsGeojson();
  const map = new Map();
  for (const f of geojson.features) {
    const code = f.properties.s_code;
    const name = f.properties.SCHN_NAME;
    if (code != null && name) {
      map.set(code, name);
    }
  }
  return map;
}
