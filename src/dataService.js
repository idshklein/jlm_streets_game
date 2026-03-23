import { normalizeHebrewStreetName } from "./matcher.js";

const CSV_PATH = "./bf185c7f-1a4e-4662-88c5-fa118a244bda.csv";

// CSV columns (no header, 9 cols):
// [0] row_id  [1] region_code  [2] city_he  [3] city_code  [4] city_name2
// [5] street_code  [6...-2] street_name  [-2] status  [-1] official_code

export async function loadJerusalemStreetDictionary() {
  const response = await fetch(CSV_PATH);
  if (!response.ok) {
    throw new Error("Failed to load streets CSV");
  }
  const text = await response.text();
  const lines = text.split("\n");

  const byNormalized = new Map();
  const officialByCode = new Map();

  for (const line of lines) {
    if (!line.trim()) continue;
    const parts = line.split(",");
    if (parts.length < 9) continue;

    const officialCode = parseInt(parts[parts.length - 1].trim(), 10);
    if (!Number.isFinite(officialCode)) continue;

    const status = parts[parts.length - 2].trim();
    const streetName = parts.slice(6, parts.length - 2).join(",").trim();
    if (!streetName) continue;

    const normalized = normalizeHebrewStreetName(streetName);
    if (!normalized) continue;

    const isOfficial = status === "official";

    const candidate = { officialCode, officialName: streetName, status };

    if (!byNormalized.has(normalized)) {
      byNormalized.set(normalized, [candidate]);
    } else {
      const existing = byNormalized.get(normalized);
      if (!existing.some((e) => e.officialCode === officialCode)) {
        existing.push(candidate);
      }
    }

    if (isOfficial || !officialByCode.has(officialCode)) {
      officialByCode.set(officialCode, streetName);
    }
  }

  // Patch officialName for all entries to point to the official variant
  for (const [normalized, entries] of byNormalized.entries()) {
    byNormalized.set(
      normalized,
      entries.map((e) => ({
        ...e,
        officialName: officialByCode.get(e.officialCode) ?? e.officialName,
      }))
    );
  }

  const suggestionNames = Array.from(new Set(officialByCode.values())).sort((a, b) =>
    a.localeCompare(b, "he")
  );

  return { byNormalized, officialByCode, suggestionNames };
}
