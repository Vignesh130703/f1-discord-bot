// ════════════════════════════════════════════════════════════════
//  F1 DISCORD BOT  —  index.js  (v5)
// ════════════════════════════════════════════════════════════════

require('dotenv').config();
const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const cron = require('node-cron');
const http = require('http');

const { postRaceResults, postQualifyingResult, postSprintResult } = require('./channels/raceResults');
const { postDriverStandings }      = require('./channels/driverStandings');
const { postConstructorStandings } = require('./channels/constructorStandings');
const { postTimetable }            = require('./channels/timetable');
const { postNextRace }             = require('./channels/nextRace');
const { checkSessionAlerts }       = require('./channels/alerts');
const { checkRaceWeekend }         = require('./channels/raceWeekend');
const { postBotStatus }            = require('./channels/botStatus');
const { initLogger, logAction, logStartup, logChannelDown } = require('./channels/logger');
const { registerInteractions }     = require('./channels/slashCommands');
const { updateRaceLivePosition }   = require('./channels/raceLivePosition');

const {
  isRaceWeekend,
  newRaceResultAvailable,
  refreshTeamDots,
  get,
  ERGAST,
} = require('./utils/helpers');

// ── Client ────────────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

// ── Channel IDs ───────────────────────────────────────────────────
const CHANNELS = {
  DRIVER_STANDINGS:      process.env.CHANNEL_DRIVER_STANDINGS,
  CONSTRUCTOR_STANDINGS: process.env.CHANNEL_CONSTRUCTOR_STANDINGS,
  TIMETABLE:             process.env.CHANNEL_TIMETABLE,
  NEXT_RACE:             process.env.CHANNEL_NEXT_RACE,
  ALERTS:                process.env.CHANNEL_ALERTS,
  RACE_WEEKEND:          process.env.CHANNEL_RACE_WEEKEND,
  HIGHLIGHTS:            process.env.CHANNEL_HIGHLIGHTS,
  BOT_STATUS:            process.env.CHANNEL_BOT_STATUS,
  RACE_RESULTS:          process.env.CHANNEL_RACE_RESULTS,
  LOG:                   process.env.CHANNEL_LOG,
  RACE_LIVE_POSITION:    process.env.CHANNEL_RACE_LIVE_POSITION,
};

// ── Health tracker ────────────────────────────────────────────────
const botStatus = { startTime: Date.now(), lastRun: {}, errors: {} };

// ── Safe runner — logs ONLY when something real happens ───────────
const LOG_ACTIONS = new Set([
  'Race Results', 'Qualifying Result', 'Sprint Result',
  'Driver Standings', 'Constructor Standings',
  'Timetable', 'Next Race', 'Race Weekend',
  'Alerts', 'Bot Status',
]);

async function safeRun(fn, name, ...args) {
  const start = Date.now();
  try {
    await fn(...args);
    botStatus.lastRun[name] = Date.now();
    delete botStatus.errors[name];
    if (LOG_ACTIONS.has(name)) {
      await logAction(`✅ **${name}** updated`, `${Date.now() - start}ms`);
    }
  } catch (e) {
    console.error(`[${name}] ${e.message}`);
    botStatus.errors[name] = e.message;
    await logAction(`❌ **${name}** failed`, e.message.slice(0, 200), true);
  }
}

// ── Channel health — tags all log-channel members, ONE message ────
async function checkChannelHealth() {
  const dead = [];
  for (const [key, id] of Object.entries(CHANNELS)) {
    if (!id) continue;
    try {
      const ch = await client.channels.fetch(id.trim());
      if (!ch) dead.push({ key, id });
    } catch {
      dead.push({ key, id });
    }
  }
  for (const { key, id } of dead) {
    await logChannelDown(client, key, id, CHANNELS.LOG);
  }
}

// ── Session schedule cache ────────────────────────────────────────
const SESSION_DURATION_MS = {
  FP1: 60 * 60 * 1000, FP2: 60 * 60 * 1000, FP3: 60 * 60 * 1000,
  QUALIFYING: 60 * 60 * 1000, SPRINT: 45 * 60 * 1000, RACE: 2 * 60 * 60 * 1000,
};

let _cachedSessions = null;
let _cachedRound    = null;

async function getSessionSchedule() {
  try {
    const data = await get(`${ERGAST}/current/next.json`);
    const race = data?.MRData?.RaceTable?.Races?.[0];
    if (!race) return [];
    if (_cachedRound === race.round && _cachedSessions) return _cachedSessions;
    const ts = (d, t) => new Date(`${d}T${t ?? '00:00:00Z'}`).getTime();
    _cachedSessions = [
      race.FirstPractice  && { key: 'FP1',        startMs: ts(race.FirstPractice.date,  race.FirstPractice.time),  durationMs: SESSION_DURATION_MS.FP1 },
      race.SecondPractice && { key: 'FP2',        startMs: ts(race.SecondPractice.date, race.SecondPractice.time), durationMs: SESSION_DURATION_MS.FP2 },
      race.ThirdPractice  && { key: 'FP3',        startMs: ts(race.ThirdPractice.date,  race.ThirdPractice.time),  durationMs: SESSION_DURATION_MS.FP3 },
      race.Qualifying     && { key: 'QUALIFYING', startMs: ts(race.Qualifying.date,     race.Qualifying.time),     durationMs: SESSION_DURATION_MS.QUALIFYING },
      race.Sprint         && { key: 'SPRINT',     startMs: ts(race.Sprint.date,          race.Sprint.time),         durationMs: SESSION_DURATION_MS.SPRINT },
      { key: 'RACE', startMs: ts(race.date, race.time), durationMs: SESSION_DURATION_MS.RACE },
    ].filter(Boolean);
    _cachedRound = race.round;
    return _cachedSessions;
  } catch { return []; }
}

// ── Post-session triggered updates (3h after each session ends) ───
const _firedSessionUpdates = new Set();

async function runPostSessionUpdates() {
  const sessions = await getSessionSchedule();
  if (!sessions.length) return;
  const now      = Date.now();
  const THREE_HR = 3 * 60 * 60 * 1000;

  for (const s of sessions) {
    const endMs  = s.startMs + s.durationMs;
    const fireAt = endMs + THREE_HR;
    const key    = `${_cachedRound}-${s.key}`;

    if (_firedSessionUpdates.has(key)) continue;
    if (now < fireAt) continue;
    if (now > fireAt + 60 * 60 * 1000) { _firedSessionUpdates.add(key); continue; }

    _firedSessionUpdates.add(key);
    console.log(`[Post-Session] +3h update after ${s.key}`);

    if (s.key === 'RACE') {
      await refreshTeamDots();
      await safeRun(postDriverStandings,      'Driver Standings',      client, CHANNELS.DRIVER_STANDINGS);
      await safeRun(postConstructorStandings, 'Constructor Standings', client, CHANNELS.CONSTRUCTOR_STANDINGS);
      await safeRun(postTimetable,            'Timetable',             client, CHANNELS.TIMETABLE);
      await safeRun(postNextRace,             'Next Race',             client, CHANNELS.NEXT_RACE);
    } else {
      await safeRun(checkRaceWeekend, 'Race Weekend', client, CHANNELS.RACE_WEEKEND);
      await safeRun(postNextRace,     'Next Race',    client, CHANNELS.NEXT_RACE);
    }
  }
}

// ── HTTP Server ───────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
let body = '';

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url.startsWith('/youtube-webhook')) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const challenge = url.searchParams.get('hub.challenge');
    if (challenge) { res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end(challenge); return; }
  }
  if (req.method === 'POST' && req.url === '/youtube-webhook') {
    body = '';
    req.on('data', c => { body += c.toString(); });
    req.on('end', async () => {
      try {
        const match = body.match(/<yt:videoId>(.*?)<\/yt:videoId>/);
        if (match) await postSingleHighlight(client, CHANNELS.HIGHLIGHTS, match[1], process.env.YOUTUBE_API_KEY);
      } catch (err) { console.error('YouTube webhook error:', err); }
      res.writeHead(200); res.end();
    });
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('F1 Discord Bot is running 🏎️');
});

server.listen(PORT, '0.0.0.0', () => console.log(`🌐 Health server on port ${PORT}`));

// ════════════════════════════════════════════════════════════════
// READY
// ════════════════════════════════════════════════════════════════

client.once('clientReady', async () => {
  console.log(`✅ F1 Bot online as ${client.user.tag}`);

  client.user.setPresence({
    activities: [{ name: '🔴 LIVE · Formula 1', type: ActivityType.Watching }],
    status: 'online',
  });

  await refreshTeamDots();
  registerInteractions(client, CHANNELS, botStatus);
  initLogger(client, CHANNELS.LOG);
  await logStartup(client);
  await checkChannelHealth();

  // Boot-time posts
  await safeRun(postDriverStandings,      'Driver Standings',      client, CHANNELS.DRIVER_STANDINGS);
  await safeRun(postConstructorStandings, 'Constructor Standings', client, CHANNELS.CONSTRUCTOR_STANDINGS);
  await safeRun(postTimetable,            'Timetable',             client, CHANNELS.TIMETABLE);
  await safeRun(postNextRace,             'Next Race',             client, CHANNELS.NEXT_RACE);
  await safeRun(checkRaceWeekend,         'Race Weekend',          client, CHANNELS.RACE_WEEKEND);
  await safeRun(postBotStatus,            'Bot Status',            client, CHANNELS.BOT_STATUS, botStatus);

  // ════════════════════════════════════════════════════════════
  // CRON JOBS
  // ════════════════════════════════════════════════════════════

  // ① Race result detection — every 5 min, race weekends only
  cron.schedule('*/5 * * * *', async () => {
    if (!isRaceWeekend()) return;
    const hasNew = await newRaceResultAvailable();
    if (!hasNew) return;
    console.log('[Race Detected] New result found');
    await refreshTeamDots();
    await safeRun(postRaceResults,          'Race Results',          client, CHANNELS.RACE_RESULTS);
    await safeRun(postDriverStandings,      'Driver Standings',      client, CHANNELS.DRIVER_STANDINGS);
    await safeRun(postConstructorStandings, 'Constructor Standings', client, CHANNELS.CONSTRUCTOR_STANDINGS);
    await safeRun(postTimetable,            'Timetable',             client, CHANNELS.TIMETABLE);
    await safeRun(postNextRace,             'Next Race',             client, CHANNELS.NEXT_RACE);
  });

  // ② Post-session updates — fires once 3h after each session ends
  cron.schedule('* * * * *', async () => {
    await runPostSessionUpdates();
  });

  // ③ Alerts — every minute on race weekends
  cron.schedule('* * * * *', async () => {
    if (!isRaceWeekend()) return;
    await safeRun(checkSessionAlerts, 'Alerts', client, CHANNELS.ALERTS);
  });

  // ④ Race weekend card — every 5 min during race week (silent, no log)
  cron.schedule('*/5 * * * *', async () => {
    if (!isRaceWeekend()) return;
    try { await checkRaceWeekend(client, CHANNELS.RACE_WEEKEND); } catch {}
  });

  // ④b Weekly trigger — Monday 6 AM
  cron.schedule('0 6 * * 1', async () => {
    await safeRun(checkRaceWeekend, 'Race Weekend', client, CHANNELS.RACE_WEEKEND);
  });

  // ⑤ Bot status — every 30 min
  cron.schedule('*/30 * * * *', async () => {
    await safeRun(postBotStatus, 'Bot Status', client, CHANNELS.BOT_STATUS, botStatus);
  });

  // ⑥ Live race positions — every 10 sec during race weekend
  //   Only updates Discord when positions actually change
  //   Stops automatically after race finishes
  cron.schedule('*/10 * * * * *', async () => {
    if (!isRaceWeekend()) return;
    await updateRaceLivePosition(client, CHANNELS.RACE_LIVE_POSITION);
  });

  // ⑦ Channel health — every 6 hours
  cron.schedule('0 */6 * * *', async () => {
    await checkChannelHealth();
  });

  console.log('✅ All smart cron jobs scheduled.');
});

module.exports = { client, CHANNELS, botStatus, safeRun };

client.login(process.env.DISCORD_TOKEN);