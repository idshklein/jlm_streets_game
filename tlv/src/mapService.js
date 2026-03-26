import { fetchStreetGeometry, isGisConfigured } from "./gisService.js";

const CITY_CENTER = [32.08, 34.78];
const INITIAL_ZOOM = 13;
const LABEL_MIN_ZOOM = 15;

export function createMap(targetId) {
  const map = L.map(targetId).setView(CITY_CENTER, INITIAL_ZOOM);

  const ensureMapSize = () => map.invalidateSize({ pan: false, debounceMoveend: true });
  window.addEventListener("load",   () => setTimeout(ensureMapSize, 50));
  window.addEventListener("resize", () => setTimeout(ensureMapSize, 50));
  window.visualViewport?.addEventListener("resize", () => setTimeout(ensureMapSize, 50));
  window.visualViewport?.addEventListener("scroll",  () => setTimeout(ensureMapSize, 50));

  L.tileLayer("https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png", {
    attribution: "© OSM contributors © CARTO",
    subdomains: "abcd", maxZoom: 19,
  }).addTo(map);

  const resultLayer = L.layerGroup().addTo(map);
  const labelLayer  = L.layerGroup().addTo(map);
  const streetLabels = [];

  function updateLabelVisibility() {
    const show = map.getZoom() >= LABEL_MIN_ZOOM;
    for (const lbl of streetLabels) {
      if (show && !labelLayer.hasLayer(lbl))  lbl.addTo(labelLayer);
      if (!show && labelLayer.hasLayer(lbl))  labelLayer.removeLayer(lbl);
    }
  }
  map.on("zoomend", updateLabelVisibility);

  return {
    isGisConfigured() { return isGisConfigured(); },
    clearResult() {
      resultLayer.clearLayers(); labelLayer.clearLayers(); streetLabels.length = 0;
    },
    async revealStreet(officialCode, streetName, options = {}) {
      const candidate = await fetchStreetGeometry(officialCode);
      if (!candidate) return false;

      const lines = candidate.coordinates.map(coords =>
        L.polyline(coords, { color: "#b66c24", weight: 5, opacity: 0.95 })
      );
      lines.forEach(l => l.addTo(resultLayer));

      if (options.fit !== false)
        map.fitBounds(L.featureGroup(lines).getBounds(), { padding: [30, 30], maxZoom: 17 });

      if (streetName) {
        const allCoords = candidate.coordinates.flat();
        let totalLen = 0;
        for (let i = 1; i < allCoords.length; i++) {
          const [[lat1, lng1], [lat2, lng2]] = [allCoords[i - 1], allCoords[i]];
          totalLen += Math.hypot(lat2 - lat1, lng2 - lng1);
        }
        let walked = 0, midLatLng = L.latLng(allCoords[0]);
        for (let i = 1; i < allCoords.length; i++) {
          const [lat1, lng1] = allCoords[i - 1], [lat2, lng2] = allCoords[i];
          const seg = Math.hypot(lat2 - lat1, lng2 - lng1);
          if (walked + seg >= totalLen / 2) {
            const t = (totalLen / 2 - walked) / seg;
            midLatLng = L.latLng(lat1 + t * (lat2 - lat1), lng1 + t * (lng2 - lng1));
            break;
          }
          walked += seg;
        }
        const label = L.tooltip({ permanent: true, direction: "center", className: "street-label" })
          .setLatLng(midLatLng).setContent(streetName);
        streetLabels.push(label);
      }

      updateLabelVisibility();
      return true;
    },
    fitToResults() {
      const b = resultLayer.getBounds?.();
      if (b?.isValid()) map.fitBounds(b, { padding: [30, 30], maxZoom: 17 });
    },
  };
}
