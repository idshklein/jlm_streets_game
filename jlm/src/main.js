import { loadStreetDictionary } from "./dataService.js";
import { getNeighbourhoodByCode } from "./gisService.js";
import { normalizeHebrewStreetName } from "./matcher.js";
import { createMap } from "./mapService.js";

const foundValueEl = document.getElementById("foundValue");
const statusLineEl = document.getElementById("statusLine");
const answerFormEl = document.getElementById("answerForm");
const streetInputEl = document.getElementById("streetInput");
const badgeListEl = document.getElementById("badgeList");
const cookieConsentEl = document.getElementById("cookieConsent");
const cookieConsentButtonEl = document.getElementById("cookieConsentButton");

const mapService = createMap("map");

// City-scoped cookie keys — only visible to pages under /jlm/
const COOKIE_CONSENT_KEY = "jlm_score_cookie_consent";
const COOKIE_SCORE_KEY = "jlm_score";
const COOKIE_FOUND_CODES_KEY = "jlm_found_codes";
const COOKIE_PATH = "/jlm/";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
const FOUND_CODES_COOKIE_MAX_LENGTH = 3600;

const state = {
  loaded: false,
  foundOfficialCodes: new Set(),
  savedScore: 0,
  hasFoundCookieData: false,
  pendingFoundCodes: [],
  hasCookieConsent: false,
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

function setCookie(name, value, maxAgeSeconds) {
  document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${maxAgeSeconds}; path=${COOKIE_PATH}; SameSite=Lax`;
}

function getCookie(name) {
  const target = `${name}=`;
  const cookies = document.cookie ? document.cookie.split(";") : [];
  for (const rawCookie of cookies) {
    const cookie = rawCookie.trim();
    if (cookie.startsWith(target)) {
      return decodeURIComponent(cookie.slice(target.length));
    }
  }
  return null;
}

function saveScoreIfConsented() {
  if (!state.hasCookieConsent) {
    return;
  }
  const total = state.hasFoundCookieData
    ? state.foundOfficialCodes.size
    : state.savedScore + state.foundOfficialCodes.size;
  setCookie(COOKIE_SCORE_KEY, String(total), COOKIE_MAX_AGE_SECONDS);
}

function parseFoundCodesCookie(rawValue) {
  if (!rawValue) {
    return [];
  }

  const tokens = rawValue.split(".").filter(Boolean);
  const parsed = [];
  for (const token of tokens) {
    const code = Number.parseInt(token, 36);
    if (Number.isFinite(code) && code > 0) {
      parsed.push(code);
    }
  }
  return parsed;
}

function encodeFoundCodes(codes) {
  return codes.map((code) => code.toString(36)).join(".");
}

function saveFoundCodesIfConsented() {
  if (!state.hasCookieConsent) {
    return;
  }

  const allCodes = Array.from(state.foundOfficialCodes);
  let encoded = encodeFoundCodes(allCodes);

  while (encoded.length > FOUND_CODES_COOKIE_MAX_LENGTH && allCodes.length > 1) {
    allCodes.shift();
    encoded = encodeFoundCodes(allCodes);
  }

  setCookie(COOKIE_FOUND_CODES_KEY, encoded, COOKIE_MAX_AGE_SECONDS);
  state.hasFoundCookieData = allCodes.length > 0;
}

function renderStats() {
  const total = state.hasFoundCookieData
    ? state.foundOfficialCodes.size
    : state.savedScore + state.foundOfficialCodes.size;
  foundValueEl.textContent = String(total);
}

function initializeCookieConsent() {
  const consentValue = getCookie(COOKIE_CONSENT_KEY);
  state.hasCookieConsent = consentValue === "yes";

  if (state.hasCookieConsent) {
    const storedScore = Number.parseInt(getCookie(COOKIE_SCORE_KEY) || "0", 10);
    state.savedScore = Number.isFinite(storedScore) && storedScore > 0 ? storedScore : 0;
    state.pendingFoundCodes = parseFoundCodesCookie(getCookie(COOKIE_FOUND_CODES_KEY));
    state.hasFoundCookieData = state.pendingFoundCodes.length > 0;

    if (state.hasFoundCookieData) {
      state.savedScore = 0;
    }

    cookieConsentEl.hidden = true;
    return;
  }

  cookieConsentEl.hidden = false;
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
      loadStreetDictionary(),
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

    if (state.pendingFoundCodes.length) {
      for (const code of state.pendingFoundCodes) {
        if (dictionary.officialByCode.has(code)) {
          state.foundOfficialCodes.add(code);
        }
      }
      state.hasFoundCookieData = state.foundOfficialCodes.size > 0;
      for (const code of state.foundOfficialCodes) {
        checkNeighbourhoodCompletion(code);
      }

      let restoredOnMap = 0;
      for (const code of state.foundOfficialCodes) {
        const officialName = dictionary.officialByCode.get(code);
        const shown = await mapService.revealStreet(code, officialName, { fit: false });
        if (shown) {
          restoredOnMap += 1;
        }
      }
      if (restoredOnMap > 0) {
        mapService.fitToResults();
      }

      renderStats();
    }

    state.loaded = true;
    if (state.foundOfficialCodes.size > 0) {
      setStatus(`המאגר נטען. שוחזרו ${state.foundOfficialCodes.size} רחובות ומוצגים על המפה.`, "ok");
    } else {
      setStatus(`המאגר נטען. ${dictionary.officialByCode.size} רחובות זמינים.`, "ok");
    }
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
  state.hasFoundCookieData = state.hasCookieConsent;
  renderStats();
  saveScoreIfConsented();
  saveFoundCodesIfConsented();
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

cookieConsentButtonEl.addEventListener("click", () => {
  state.hasCookieConsent = true;
  setCookie(COOKIE_CONSENT_KEY, "yes", COOKIE_MAX_AGE_SECONDS);
  saveFoundCodesIfConsented();
  saveScoreIfConsented();
  cookieConsentEl.hidden = true;
  setStatus("שמירת התקדמות בעוגייה הופעלה.", "ok");
});

streetInputEl.addEventListener("input", () => {
  if (typingTimer) {
    clearTimeout(typingTimer);
  }

  typingTimer = setTimeout(() => {
    void tryResolveTypedStreet();
  }, 250);
});

initializeCookieConsent();
renderStats();
bootstrap();
