import { loadJerusalemStreetDictionary } from "./dataService.js";
import { getNeighbourhoodByCode } from "./gisService.js";
import { normalizeHebrewStreetName } from "./matcher.js";
import { createMap } from "./mapService.js";

const foundValueEl = document.getElementById("foundValue");
const statusLineEl = document.getElementById("statusLine");
const answerFormEl = document.getElementById("answerForm");
const streetInputEl = document.getElementById("streetInput");
const badgeListEl = document.getElementById("badgeList");

const mapService = createMap("map");

const state = {
  loaded: false,
  foundOfficialCodes: new Set(),
  dictionary: null,
  lastHandledNormalized: "",
  neighbourhoodByCode: new Map(),
  codesByNeighbourhood: new Map(),
  completedNeighbourhoods: new Set(),
};

let typingTimer = null;

function pickRandom(items) {
  const index = Math.floor(Math.random() * items.length);
  return items[index];
}

function setStatus(message, tone = "") {
  statusLineEl.textContent = message;
  statusLineEl.classList.remove("ok", "warn");
  if (tone) {
    statusLineEl.classList.add(tone);
  }
}

function renderStats() {
  foundValueEl.textContent = String(state.foundOfficialCodes.size);
}

function appendNeighbourhoodBadge(name) {
  const badge = document.createElement("div");
  badge.className = "badge";
  badge.textContent = `🏆 ${name} — כל הרחובות נמצאו!`;
  badgeListEl.prepend(badge);
}

function checkNeighbourhoodCompletion(officialCode) {
  const neigh = state.neighbourhoodByCode.get(officialCode);
  if (!neigh || state.completedNeighbourhoods.has(neigh)) return;
  const allCodes = state.codesByNeighbourhood.get(neigh);
  if (!allCodes) return;
  const allFound = [...allCodes].every((c) => state.foundOfficialCodes.has(c));
  if (allFound) {
    state.completedNeighbourhoods.add(neigh);
    appendNeighbourhoodBadge(neigh);
  }
}

async function bootstrap() {
  try {
    const [dictionary, neighbourhoodByCode] = await Promise.all([
      loadJerusalemStreetDictionary(),
      getNeighbourhoodByCode(),
    ]);

    state.dictionary = dictionary;
    state.neighbourhoodByCode = neighbourhoodByCode;

    for (const [code] of dictionary.officialByCode) {
      const neigh = neighbourhoodByCode.get(code);
      if (!neigh) continue;
      if (!state.codesByNeighbourhood.has(neigh)) {
        state.codesByNeighbourhood.set(neigh, new Set());
      }
      state.codesByNeighbourhood.get(neigh).add(code);
    }

    state.loaded = true;
    setStatus(`המאגר נטען. ${dictionary.officialByCode.size} רחובות זמינים.`, "ok");
  } catch (error) {
    setStatus("שגיאה בטעינת מאגר הרחובות. נסו לרענן.", "warn");
    console.error(error);
  }
}

async function tryResolveTypedStreet() {
  if (!state.loaded || !state.dictionary) {
    return;
  }

  const typed = streetInputEl.value;
  const normalized = normalizeHebrewStreetName(typed);

  if (!normalized || normalized === state.lastHandledNormalized) {
    return;
  }

  const matches = state.dictionary.byNormalized.get(normalized);
  if (!matches || !matches.length) {
    return;
  }

  const match = pickRandom(matches);

  if (state.foundOfficialCodes.has(match.officialCode)) {
    state.lastHandledNormalized = normalized;
    setStatus(`כבר נמצא: ${match.officialName}`, "warn");
    streetInputEl.value = "";
    return;
  }

  state.lastHandledNormalized = normalized;
  state.foundOfficialCodes.add(match.officialCode);
  renderStats();
  checkNeighbourhoodCompletion(match.officialCode);
  setStatus(`נמצא: ${match.officialName}`, "ok");

  try {
    const shown = await mapService.revealStreet(match.officialCode, match.officialName);
    if (!shown) {
      setStatus(`נמצא: ${match.officialName} — אין גיאומטריה זמינה.`, "warn");
    }
  } catch (error) {
    console.error(error);
    setStatus(`נמצא: ${match.officialName} — שגיאה בטעינת הגיאומטריה.`, "warn");
  }

  streetInputEl.value = "";
}

answerFormEl.addEventListener("submit", (event) => {
  event.preventDefault();
});

streetInputEl.addEventListener("input", () => {
  if (typingTimer) {
    clearTimeout(typingTimer);
  }

  typingTimer = setTimeout(() => {
    void tryResolveTypedStreet();
  }, 250);
});

renderStats();
bootstrap();
