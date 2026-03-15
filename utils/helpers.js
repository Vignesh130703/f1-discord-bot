// ─────────────────────────────────────────────
//  SHARED UTILITIES
// ─────────────────────────────────────────────
const axios = require('axios');

const ERGAST = 'https://api.jolpi.ca/ergast/f1';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function get(url) {
  const { data } = await axios.get(url, { timeout: 12000 });
  return data;
}

async function getWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const { data } = await axios.get(url, { timeout: 15000 });
      return data;
    } catch (e) {
      if (e.response?.status === 429 && i < retries - 1) {
        const wait = (i + 1) * 15000;
        console.warn(`[429] Retrying in ${wait / 1000}s`);
        await sleep(wait);
      } else throw e;
    }
  }
}

async function fetchChannel(client, id) {
  const clean = id?.toString().trim();
  if (!clean) return null;
  try { return await client.channels.fetch(clean); }
  catch (e) { console.warn(`[Channel] ${clean}: ${e.message}`); return null; }
}

// ── Is it a race weekend? (Fri / Sat / Sun) ──
function isRaceWeekend() {
  const day = new Date().getDay(); // 0=Sun 5=Fri 6=Sat
  return day === 0 || day === 5 || day === 6;
}

// ── Detect if a new race result appeared since last check ──────
// Stores last known race round; returns true when it changes.
let _lastKnownRound = null;
async function newRaceResultAvailable() {
  try {
    const data  = await get(`${ERGAST}/current/last/results.json`);
    const round = data?.MRData?.RaceTable?.Races?.[0]?.round;
    if (!round) return false;
    if (_lastKnownRound === null) { _lastKnownRound = round; return false; } // first boot
    if (round !== _lastKnownRound) { _lastKnownRound = round; return true; }
    return false;
  } catch { return false; }
}

// ── Team dot icons — auto-detect by year, fallback to name map ──
// For 2026+ we query the API for active constructors so new teams
// (Audi, Cadillac) get picked up automatically even if we don't
// hardcode them.
const KNOWN_DOTS = {
  // 2025 and earlier
  'Red Bull Racing': '🔵', 'McLaren': '🟠', 'Ferrari': '🔴',
  'Mercedes': '⚫', 'Aston Martin': '🟢', 'Alpine': '🔵',
  'Haas F1 Team': '⚪', 'Williams': '🔵',
  'Kick Sauber': '🟢', 'RB F1 Team': '🔵',
  // 2026 new entries — colors fetched dynamically; fallbacks here
  'Audi':      '⚪',  // silver/grey until official
  'Cadillac':  '🔴',  // red/white
};

// Fetch constructor list for current season and assign dots to unknowns
const _dynamicDots = {};
async function refreshTeamDots() {
  try {
    const data = await get(`${ERGAST}/current/constructors.json`);
    const list = data?.MRData?.ConstructorTable?.Constructors ?? [];
    for (const c of list) {
      if (!KNOWN_DOTS[c.name] && !_dynamicDots[c.name]) {
        // Assign a dot based on nationality as a rough proxy
        const nat = c.nationality?.toLowerCase() ?? '';
        if      (nat.includes('german'))   _dynamicDots[c.name] = '⚪'; // silver
        else if (nat.includes('american')) _dynamicDots[c.name] = '🔴';
        else if (nat.includes('british'))  _dynamicDots[c.name] = '🔵';
        else if (nat.includes('italian'))  _dynamicDots[c.name] = '🔴';
        else if (nat.includes('french'))   _dynamicDots[c.name] = '🔵';
        else                               _dynamicDots[c.name] = '⬜';
      }
    }
  } catch {}
}

function teamDot(name) {
  return KNOWN_DOTS[name] ?? _dynamicDots[name] ?? '⬜';
}

// ── Emoji helpers ────────────────────────────
function flag(country) {
  return ({
    'Bahrain': '🇧🇭', 'Saudi Arabia': '🇸🇦', 'Australia': '🇦🇺',
    'Japan': '🇯🇵', 'China': '🇨🇳', 'USA': '🇺🇸', 'United States': '🇺🇸',
    'Italy': '🇮🇹', 'Monaco': '🇲🇨', 'Canada': '🇨🇦', 'Spain': '🇪🇸',
    'Austria': '🇦🇹', 'UK': '🇬🇧', 'United Kingdom': '🇬🇧', 'British': '🇬🇧',
    'Hungary': '🇭🇺', 'Belgium': '🇧🇪', 'Netherlands': '🇳🇱', 'Dutch': '🇳🇱',
    'Singapore': '🇸🇬', 'Mexico': '🇲🇽', 'Brazil': '🇧🇷', 'UAE': '🇦🇪',
    'Abu Dhabi': '🇦🇪', 'Azerbaijan': '🇦🇿', 'Qatar': '🇶🇦',
    'German': '🇩🇪', 'French': '🇫🇷', 'Finnish': '🇫🇮', 'Spanish': '🇪🇸',
    'Australian': '🇦🇺', 'Canadian': '🇨🇦', 'Austrian': '🇦🇹', 'Italian': '🇮🇹',
    'Thai': '🇹🇭', 'American': '🇺🇸', 'Chinese': '🇨🇳', 'Japanese': '🇯🇵',
    'Danish': '🇩🇰', 'Monégasque': '🇲🇨', 'Mexican': '🇲🇽', 'Brazilian': '🇧🇷',
    'Hungarian': '🇭🇺', 'Belgian': '🇧🇪', 'New Zealander': '🇳🇿', 'Swiss': '🇨🇭',
  })[country] ?? '🏁';
}

function tyreIcon(c) {
  return ({ soft: '🔴', medium: '🟡', hard: '⚪', inter: '🟢', wet: '🔵', intermediate: '🟢' })[c?.toLowerCase()] ?? '⬜';
}

function posIcon(p) {
  return p === '1' ? '🥇' : p === '2' ? '🥈' : p === '3' ? '🥉'
    : `\`P${String(p).padStart(2, ' ')}\``;
}

function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : ''; }

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function buildCountdown(ms) {
  const totalMins = Math.floor(ms / 60000);
  const days = Math.floor(totalMins / 1440);
  const hrs  = Math.floor((totalMins % 1440) / 60);
  const mins = totalMins % 60;
  const parts = [];
  if (days > 0) parts.push(`\`${days}\`d`);
  if (hrs  > 0) parts.push(`\`${hrs}\`h`);
  if (mins > 0) parts.push(`\`${mins}\`m`);
  return parts.join('  ') || '`< 1 min`';
}

function wIcon(code) {
  if (code === 0) return '☀️';
  if (code <= 2)  return '🌤️';
  if (code === 3) return '☁️';
  if (code <= 49) return '🌫️';
  if (code <= 67) return '🌧️';
  if (code <= 77) return '🌨️';
  if (code <= 82) return '🌦️';
  if (code <= 99) return '⛈️';
  return '🌡️';
}

function wDesc(code) {
  return ({
    0: 'Clear Sky', 1: 'Mainly Clear', 2: 'Partly Cloudy', 3: 'Overcast',
    45: 'Foggy', 48: 'Icy Fog', 51: 'Light Drizzle', 53: 'Drizzle',
    55: 'Heavy Drizzle', 61: 'Slight Rain', 63: 'Rain', 65: 'Heavy Rain',
    80: 'Showers', 81: 'Rain Showers', 82: 'Heavy Showers',
    95: 'Thunderstorm', 99: 'Thunderstorm w/ Hail',
  })[code] ?? 'Mixed Conditions';
}

function getCircuitData(id) {
  const base = 'https://www.formula1.com/content/dam/fom-website/2018-redesign-assets/Circuit%20maps%2016x9/';
  const c = {
    bahrain:       { laps: 57, length: '5.412 km', total: '308.238 km', record: 'P. de la Rosa — 1:31.447 (2005)',   tyres: ['soft','medium','hard'], image: `${base}Bahrain_Circuit.png.transform/9col/image.png` },
    jeddah:        { laps: 50, length: '6.174 km', total: '308.700 km', record: 'L. Hamilton — 1:28.150 (2021)',     tyres: ['soft','medium','hard'], image: `${base}Saudi_Arabia_Circuit.png.transform/9col/image.png` },
    albert_park:   { laps: 58, length: '5.278 km', total: '306.124 km', record: 'M. Schumacher — 1:24.125 (2004)',  tyres: ['soft','medium','hard'], image: `${base}Australia_Circuit.png.transform/9col/image.png` },
    suzuka:        { laps: 53, length: '5.807 km', total: '307.471 km', record: 'K. Räikkönen — 1:31.540 (2005)',   tyres: ['soft','medium','hard'], image: `${base}Japan_Circuit.png.transform/9col/image.png` },
    shanghai:      { laps: 56, length: '5.451 km', total: '305.066 km', record: 'M. Schumacher — 1:32.238 (2004)',  tyres: ['soft','medium','hard'], image: `${base}China_Circuit.png.transform/9col/image.png` },
    miami:         { laps: 57, length: '5.412 km', total: '308.326 km', record: 'M. Verstappen — 1:29.708 (2023)',  tyres: ['soft','medium','hard'], image: `${base}Miami_Circuit.png.transform/9col/image.png` },
    imola:         { laps: 63, length: '4.909 km', total: '309.049 km', record: 'M. Verstappen — 1:15.484 (2022)',  tyres: ['soft','medium','hard'], image: `${base}Emilia_Romagna_Circuit.png.transform/9col/image.png` },
    monaco:        { laps: 78, length: '3.337 km', total: '260.286 km', record: 'L. Hamilton — 1:12.909 (2021)',    tyres: ['soft','medium','hard'], image: `${base}Monaco_Circuit.png.transform/9col/image.png` },
    villeneuve:    { laps: 70, length: '4.361 km', total: '305.270 km', record: 'R. Barrichello — 1:13.622 (2004)', tyres: ['soft','medium','hard'], image: `${base}Canada_Circuit.png.transform/9col/image.png` },
    catalunya:     { laps: 66, length: '4.657 km', total: '307.236 km', record: 'M. Verstappen — 1:16.330 (2023)',  tyres: ['soft','medium','hard'], image: `${base}Spain_Circuit.png.transform/9col/image.png` },
    red_bull_ring: { laps: 71, length: '4.318 km', total: '306.452 km', record: 'C. Leclerc — 1:05.619 (2020)',     tyres: ['soft','medium','hard'], image: `${base}Austria_Circuit.png.transform/9col/image.png` },
    silverstone:   { laps: 52, length: '5.891 km', total: '306.198 km', record: 'M. Verstappen — 1:27.097 (2020)',  tyres: ['soft','medium','hard'], image: `${base}Great_Britain_Circuit.png.transform/9col/image.png` },
    hungaroring:   { laps: 70, length: '4.381 km', total: '306.630 km', record: 'L. Hamilton — 1:16.627 (2020)',    tyres: ['soft','medium','hard'], image: `${base}Hungary_Circuit.png.transform/9col/image.png` },
    spa:           { laps: 44, length: '7.004 km', total: '308.052 km', record: 'V. Bottas — 1:46.286 (2018)',      tyres: ['soft','medium','hard'], image: `${base}Belgium_Circuit.png.transform/9col/image.png` },
    zandvoort:     { laps: 72, length: '4.259 km', total: '306.648 km', record: 'M. Verstappen — 1:11.097 (2021)',  tyres: ['soft','medium','hard'], image: `${base}Netherlands_Circuit.png.transform/9col/image.png` },
    monza:         { laps: 53, length: '5.793 km', total: '306.720 km', record: 'R. Barrichello — 1:21.046 (2004)', tyres: ['soft','medium','hard'], image: `${base}Italy_Circuit.png.transform/9col/image.png` },
    baku:          { laps: 51, length: '6.003 km', total: '306.049 km', record: 'C. Leclerc — 1:43.009 (2019)',     tyres: ['soft','medium','hard'], image: `${base}Azerbaijan_Circuit.png.transform/9col/image.png` },
    marina_bay:    { laps: 62, length: '4.940 km', total: '306.143 km', record: 'L. Hamilton — 1:35.867 (2023)',    tyres: ['soft','medium','hard'], image: `${base}Singapore_Circuit.png.transform/9col/image.png` },
    americas:      { laps: 56, length: '5.513 km', total: '308.405 km', record: 'C. Leclerc — 1:36.169 (2019)',     tyres: ['soft','medium','hard'], image: `${base}USA_Circuit.png.transform/9col/image.png` },
    rodriguez:     { laps: 71, length: '4.304 km', total: '305.354 km', record: 'V. Bottas — 1:17.774 (2021)',      tyres: ['soft','medium','hard'], image: `${base}Mexico_Circuit.png.transform/9col/image.png` },
    interlagos:    { laps: 71, length: '4.309 km', total: '305.879 km', record: 'V. Bottas — 1:10.540 (2018)',      tyres: ['soft','medium','hard'], image: `${base}Brazil_Circuit.png.transform/9col/image.png` },
    las_vegas:     { laps: 50, length: '6.201 km', total: '309.958 km', record: 'O. Piastri — 1:35.490 (2023)',     tyres: ['soft','medium','hard'], image: `${base}Las_Vegas_Circuit.png.transform/9col/image.png` },
    losail:        { laps: 57, length: '5.380 km', total: '306.660 km', record: 'M. Verstappen — 1:24.319 (2023)',  tyres: ['soft','medium','hard'], image: `${base}Qatar_Circuit.png.transform/9col/image.png` },
    yas_marina:    { laps: 58, length: '5.281 km', total: '306.183 km', record: 'M. Verstappen — 1:26.103 (2021)',  tyres: ['soft','medium','hard'], image: `${base}Abu_Dhabi_Circuit.png.transform/9col/image.png` },
  };
  return c[id] ?? null;
}

module.exports = {
  ERGAST, sleep, get, getWithRetry, fetchChannel,
  isRaceWeekend, newRaceResultAvailable, refreshTeamDots, teamDot,
  flag, tyreIcon, posIcon, capitalize, chunkArray,
  buildCountdown, wIcon, wDesc, getCircuitData,
};
