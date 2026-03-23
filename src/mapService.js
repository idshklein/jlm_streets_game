import { fetchStreetGeometryFromJerusalemGis, isJerusalemGisConfigured } from "./gisService.js";

const JERUSALEM_CENTER = [31.778, 35.235];
const INITIAL_ZOOM = 12;
const LABEL_MIN_ZOOM = 15;

export function createMap(targetId) {
  const map = L.map(targetId, {
    zoomControl: true,
    attributionControl: true,
  }).setView(JERUSALEM_CENTER, INITIAL_ZOOM);

  L.tileLayer("https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png", {
    attribution: "&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors &copy; <a href='https://carto.com/'>CARTO</a>",
    subdomains: "abcd",
    maxZoom: 19,
  }).addTo(map);

  const resultLayer = L.layerGroup().addTo(map);
  const labelLayer = L.layerGroup().addTo(map);
  const streetLabels = [];

  function updateLabelVisibility() {
    const shouldShow = map.getZoom() >= LABEL_MIN_ZOOM;
    for (const label of streetLabels) {
      const isShown = labelLayer.hasLayer(label);
      if (shouldShow && !isShown) {
        label.addTo(labelLayer);
      }
      if (!shouldShow && isShown) {
        labelLayer.removeLayer(label);
      }
    }
  }

  map.on("zoomend", updateLabelVisibility);

  return {
    isGisConfigured() {
      return isJerusalemGisConfigured();
    },

    clearResult() {
      resultLayer.clearLayers();
      labelLayer.clearLayers();
      streetLabels.length = 0;
    },

    async revealStreet(officialCode, streetName, options = {}) {
      const shouldFit = options.fit !== false;
      const candidate = await fetchStreetGeometryFromJerusalemGis(officialCode);
      if (!candidate) {
        return false;
      }

      if (candidate.type === "multiline") {
        const lines = candidate.coordinates.map((coords) =>
          L.polyline(coords, { color: "#b66c24", weight: 5, opacity: 0.95 })
        );
        lines.forEach((l) => l.addTo(resultLayer));

        const group = L.featureGroup(lines);
        const bounds = group.getBounds();
        if (shouldFit) {
          map.fitBounds(bounds, { padding: [30, 30], maxZoom: 17 });
        }

        if (streetName) {
          // Flatten all segments into one coordinate sequence
          const allCoords = candidate.coordinates.flat();
          // Walk the polyline to find the point at 50% of total length
          let totalLen = 0;
          for (let i = 1; i < allCoords.length; i++) {
            const [lat1, lng1] = allCoords[i - 1];
            const [lat2, lng2] = allCoords[i];
            totalLen += Math.hypot(lat2 - lat1, lng2 - lng1);
          }
          let walked = 0;
          const half = totalLen / 2;
          let midLatLng = L.latLng(allCoords[0]);
          for (let i = 1; i < allCoords.length; i++) {
            const [lat1, lng1] = allCoords[i - 1];
            const [lat2, lng2] = allCoords[i];
            const segLen = Math.hypot(lat2 - lat1, lng2 - lng1);
            if (walked + segLen >= half) {
              const t = (half - walked) / segLen;
              midLatLng = L.latLng(lat1 + t * (lat2 - lat1), lng1 + t * (lng2 - lng1));
              break;
            }
            walked += segLen;
          }

          const label = L.tooltip({ permanent: true, direction: "center", className: "street-label" })
            .setLatLng(midLatLng)
            .setContent(streetName);
          streetLabels.push(label);
        }

        updateLabelVisibility();

        return true;
      }

      return false;
    },

    fitToResults() {
      const bounds = resultLayer.getBounds?.();
      if (bounds && bounds.isValid()) {
        map.fitBounds(bounds, { padding: [30, 30], maxZoom: 17 });
      }
    },
  };
}
