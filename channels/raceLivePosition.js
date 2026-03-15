// ─────────────────────────────────────────────
//  CHANNEL: RACE LIVE POSITION  (v5 — OpenF1)
//  • New message ONLY when new race session detected
//  • Updates only when positions actually change
//  • Pit indicator, fastest lap, position arrows
//  • Safety car / VSC / red flag in status bar
//  • Stops polling after race finishes
//  • Old race messages stay as archive
// ─────────────────────────────────────────────

const { EmbedBuilder } = require('discord.js');
const { fetchChannel, flag } = require('../utils/helpers');
const { loadStore, saveStore } = require('../utils/messageStore');
const axios = require('axios');

const OPENF1 = 'https://api.openf1.org/v1';

// ── State — resets each new session ──────────────────────────────
let _currentSessionKey = null;
let _lastPositionHash  = null;
let _lastPositions     = {};
let _fastestLapDriver  = null;
let _raceFinalized     = false;

async function openf1Get(path) {
  const { data } = await axios.get(`${OPENF1}${path}`, { timeout: 10000 });
  return data;
}

// ── Fetch current race session ────────────────────────────────────
async function getLiveRaceSession() {
  try {
    const year     = new Date().getFullYear();
    const sessions = await openf1Get(`/sessions?session_type=Race&year=${year}`);
    if (!sessions?.length) return null;
    return sessions.sort((a, b) => new Date(b.date_start) - new Date(a.date_start))[0];
  } catch { return null; }
}

// ── Data fetchers ─────────────────────────────────────────────────
async function getPositions(sessionKey) {
  const data = await openf1Get(`/position?session_key=${sessionKey}`);
  if (!data?.length) return [];
  const latest = {};
  for (const p of data) {
    if (!latest[p.driver_number] || new Date(p.date) > new Date(latest[p.driver_number].date))
      latest[p.driver_number] = p;
  }
  return Object.values(latest).sort((a, b) => a.position - b.position);
}

async function getIntervals(sessionKey) {
  try {
    const data = await openf1Get(`/intervals?session_key=${sessionKey}`);
    if (!data?.length) return {};
    const latest = {};
    for (const i of data) {
      if (!latest[i.driver_number] || new Date(i.date) > new Date(latest[i.driver_number].date))
        latest[i.driver_number] = i;
    }
    return latest;
  } catch { return {}; }
}

async function getDrivers(sessionKey) {
  try {
    const data = await openf1Get(`/drivers?session_key=${sessionKey}`);
    const map  = {};
    for (const d of (data ?? []))
      map[d.driver_number] = { code: d.name_acronym ?? String(d.driver_number) };
    return map;
  } catch { return {}; }
}

async function getPitStatus(sessionKey) {
  try {
    const data = await openf1Get(`/stints?session_key=${sessionKey}`);
    if (!data?.length) return new Set();
    const latest = {};
    for (const s of data) {
      if (!latest[s.driver_number] || s.stint_number > latest[s.driver_number].stint_number)
        latest[s.driver_number] = s;
    }
    const inPit = new Set();
    for (const [num, s] of Object.entries(latest)) {
      if (s.lap_end === null || s.lap_end === undefined) inPit.add(Number(num));
    }
    return inPit;
  } catch { return new Set(); }
}

async function getFastestLap(sessionKey) {
  try {
    const data = await openf1Get(`/laps?session_key=${sessionKey}&is_pit_out_lap=false`);
    if (!data?.length) return null;
    let best = null, bestMs = Infinity;
    for (const l of data) {
      if (l.lap_duration && l.lap_duration < bestMs) { bestMs = l.lap_duration; best = l.driver_number; }
    }
    return best;
  } catch { return null; }
}

async function getRaceControl(sessionKey) {
  try {
    const data = await openf1Get(`/race_control?session_key=${sessionKey}`);
    if (!data?.length) return '';
    const last = [...data].reverse().find(m => m.category === 'SafetyCar' || m.flag === 'RED');
    if (!last) return '';
    if (last.category === 'SafetyCar') {
      if (last.message?.includes('VIRTUAL'))    return '🟠 VIRTUAL SAFETY CAR';
      if (last.message?.includes('DEPLOYED'))   return '🟡 SAFETY CAR DEPLOYED';
      if (last.message?.includes('IN THIS LAP'))return '🟢 SAFETY CAR RETURNING';
    }
    if (last.flag === 'RED') return '🔴 RED FLAG';
    return '';
  } catch { return ''; }
}

async function getCurrentLap(sessionKey) {
  try {
    const data = await openf1Get(`/laps?session_key=${sessionKey}`);
    if (!data?.length) return null;
    return Math.max(...data.map(l => l.lap_number ?? 0));
  } catch { return null; }
}

// ── Helpers ───────────────────────────────────────────────────────
function arrow(driverNum, currentPos) {
  const prev = _lastPositions[driverNum];
  if (prev === undefined || prev === currentPos) return ' ';
  return prev > currentPos ? '▲' : '▼';
}

function formatGap(pos, interval, gapToLeader) {
  if (pos === 1) return 'Leader';
  if (interval === null || interval === undefined) return '—';
  if (typeof gapToLeader === 'number' && gapToLeader > 90) return `+${Math.floor(gapToLeader / 90)} LAP`;
  if (typeof interval === 'number') return `+${interval.toFixed(3)}`;
  return String(interval);
}

// ── Build embed ───────────────────────────────────────────────────
function buildEmbed(session, positions, intervals, drivers, inPit, fastestLap, raceControl, currentLap, isFinished) {
  const raceName = session.meeting_name ?? 'Grand Prix';
  const circuit  = session.circuit_short_name ?? '';
  const dateStr  = new Date(session.date_start).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
  const cFlag = flag(session.country_name ?? '');

  let statusLine = isFinished ? '🏁 **RACE FINISHED — FINAL RESULT**' : '🔴 **LIVE**';
  if (raceControl && !isFinished) statusLine = raceControl;
  if (currentLap && session.total_laps && !isFinished)
    statusLine += `  ·  Lap **${currentLap}** / **${session.total_laps}**`;

  const rows = positions.map(p => {
    const num  = p.driver_number;
    const pos  = p.position;
    const code = (drivers[num]?.code ?? String(num)).padEnd(3);
    const arw  = arrow(num, pos);
    const intv = intervals[num];
    const gap  = formatGap(pos, intv?.interval, intv?.gap_to_leader);
    const pit  = inPit.has(num)     ? ' 🔧PIT' : '';
    const fl   = fastestLap === num ? ' ⚡'     : '';
    return `${String(pos).padStart(2)}  ${code}  ${arw}  ${gap}${pit}${fl}`;
  });

  const top   = rows.slice(0, 10).join('\n');
  const mid   = rows.slice(10, 15).join('\n');
  const back  = rows.slice(15).join('\n');
  const block = [top, mid && `\n${mid}`, back && `\n${back}`].filter(Boolean).join('');

  const color = isFinished                  ? 0xE10600
    : raceControl.includes('RED')           ? 0xFF0000
    : raceControl.includes('VIRTUAL')       ? 0xFF6600
    : raceControl.includes('SAFETY CAR D')  ? 0xFFD700
    : 0x00FF00;

  return new EmbedBuilder()
    .setColor(color)
    .setTitle(`${cFlag}  Round ${session.meeting_key ?? '—'} — ${raceName}`)
    .addFields(
      { name: 'Race Info', value: `📍 ${circuit}\n📅 ${dateStr}`, inline: false },
      { name: statusLine,  value: `\`\`\`\n${block || 'Waiting for data...'}\n\`\`\``, inline: false }
    )
    .setTimestamp()
    .setFooter({ text: isFinished ? 'Final Result · OpenF1' : 'Live · Updates on position change · OpenF1' });
}

// ── Main update function ──────────────────────────────────────────
async function updateRaceLivePosition(client, channelId) {
  if (!channelId) return;

  const ch = await fetchChannel(client, channelId);
  if (!ch) return;

  const session = await getLiveRaceSession();
  if (!session) return;

  const sessionKey   = session.session_key;
  const now          = Date.now();
  const sessionStart = new Date(session.date_start).getTime();
  const sessionEnd   = session.date_end
    ? new Date(session.date_end).getTime()
    : sessionStart + 3 * 60 * 60 * 1000;
  const isFinished   = now > sessionEnd;

  // New session detected — reset all state
  if (sessionKey !== _currentSessionKey) {
    _currentSessionKey = sessionKey;
    _lastPositionHash  = null;
    _lastPositions     = {};
    _fastestLapDriver  = null;
    _raceFinalized     = false;
    console.log(`[LivePosition] New race session: ${sessionKey}`);
  }

  // Already finalized — stop
  if (_raceFinalized) return;

  // Fetch everything in parallel
  const [positions, intervals, drivers, inPit, fastestLap, raceControl, currentLap] = await Promise.all([
    getPositions(sessionKey),
    getIntervals(sessionKey),
    getDrivers(sessionKey),
    getPitStatus(sessionKey),
    getFastestLap(sessionKey),
    getRaceControl(sessionKey),
    getCurrentLap(sessionKey),
  ]);

  if (!positions.length) return;

  // Skip if positions haven't changed (unless race just finished)
  const posHash    = positions.map(p => `${p.driver_number}:${p.position}`).join(',');
  const forceUpdate = isFinished && !_raceFinalized;
  if (posHash === _lastPositionHash && !forceUpdate) return;
  _lastPositionHash = posHash;
  _fastestLapDriver = fastestLap;

  const embed    = buildEmbed(session, positions, intervals, drivers, inPit, _fastestLapDriver, raceControl, currentLap, isFinished);
  const store    = loadStore();
  const storeKey = `raceLive_${sessionKey}`;

  if (store[storeKey]) {
    try {
      const existing = await ch.messages.fetch(store[storeKey]);
      await existing.edit({ embeds: [embed] });
    } catch {
      const msg = await ch.send({ embeds: [embed] });
      store[storeKey] = msg.id;
      saveStore(store);
    }
  } else {
    const msg = await ch.send({ embeds: [embed] });
    store[storeKey] = msg.id;
    saveStore(store);
  }

  for (const p of positions) _lastPositions[p.driver_number] = p.position;

  if (isFinished) {
    _raceFinalized = true;
    console.log(`[LivePosition] Race ${sessionKey} finalized`);
  }
}

module.exports = { updateRaceLivePosition };