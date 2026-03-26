const HEBREW_DIACRITICS = /[\u0591-\u05C7]/g;
const MULTI_SPACE = /\s+/g;

export function normalizeHebrewStreetName(value) {
  return value
    .trim()
    .replace(HEBREW_DIACRITICS, "")
    .replace(/[\u2010-\u2015\u05BE]/g, "-")
    .replace(/["'`׳״]/g, "")
    .replace(/-/g, " ")
    .replace(MULTI_SPACE, " ")
    .toLowerCase();
}
