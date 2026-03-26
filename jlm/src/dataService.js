import { normalizeHebrewStreetName } from "./matcher.js";

// Resolve path relative to this module file, not the document URL
const CSV_URL = new URL("../../bf185c7f-1a4e-4662-88c5-fa118a244bda.csv", import.meta.url);

export async function loadStreetDictionary() {
  const text = await (await fetch(CSV_URL)).text();
  const byNormalized = new Map();
  const officialByCode = new Map();

  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    const parts = line.split(",");
    // JLM CSV layout: row_id, region, city_he, city_code, city_name2,
    //   street_code, street_name, status, official_code (quoted), q (street code)
    // We need [-2] for official_code (strip quotes) and [-3] for status.
    if (parts.length < 10) continue;

    const officialCode = parseInt(parts[parts.length - 2].replace(/"/g, "").trim(), 10);
    if (!Number.isFinite(officialCode)) continue;

    const status = parts[parts.length - 3].trim();
    const streetName = parts.slice(6, parts.length - 3).join(",").trim();
    if (!streetName) continue;

    const normalized = normalizeHebrewStreetName(streetName);
    if (!normalized) continue;

    const isOfficial = status === "official";
    const candidate = { officialCode, officialName: streetName, status };

    if (!byNormalized.has(normalized)) byNormalized.set(normalized, [candidate]);
    else {
      const ex = byNormalized.get(normalized);
      if (!ex.some(e => e.officialCode === officialCode)) ex.push(candidate);
    }

    if (isOfficial || !officialByCode.has(officialCode))
      officialByCode.set(officialCode, streetName);
  }

  for (const [norm, entries] of byNormalized)
    byNormalized.set(norm, entries.map(e => ({
      ...e, officialName: officialByCode.get(e.officialCode) ?? e.officialName
    })));

  const suggestionNames = Array.from(new Set(officialByCode.values()))
    .sort((a, b) => a.localeCompare(b, "he"));

  return { byNormalized, officialByCode, suggestionNames };
}
