import { normalizeHebrewStreetName } from "./matcher.js";

const CSV_PATH = "../../bf185c7f-1a4e-4662-88c5-fa118a244bda_tlv.csv";

export async function loadStreetDictionary() {
  const text = await (await fetch(CSV_PATH)).text();
  const byNormalized = new Map();
  const officialByCode = new Map();

  for (const line of text.split("\n")) {
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
