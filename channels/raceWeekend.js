// ─────────────────────────────────────────────
//  CHANNEL: RACE WEEKEND
//  • Updates every 5 min during race week
//  • LIVE NOW during active sessions
//  • Countdown to next session
//  • After race ends (1hr grace): switches to
//    "Next Race" card with link + countdown
//  • Reactivates Monday of next race week
// ─────────────────────────────────────────────

const { EmbedBuilder } = require('discord.js');
const { ERGAST, get, fetchChannel, flag, buildCountdown } = require('../utils/helpers');
const updateMessage = require('../utils/updateMessage');

let lastPostedRound = '';

async function checkRaceWeekend(client, channelId) {
  if (!channelId) return;

  const ch = await fetchChannel(client, channelId);
  if (!ch) return;

  // Always fetch full schedule to know what race week we're in
  const schedData  = await get(`${ERGAST}/current.json`);
  const allRaces   = schedData?.MRData?.RaceTable?.Races ?? [];
  const season     = schedData?.MRData?.RaceTable?.season ?? new Date().getFullYear();
  const now        = Date.now();

  if (!allRaces.length) return;

  const RACE_DURATION_MS = 2 * 60 * 60 * 1000;   // 2 hrs
  const GRACE_MS         = 1 * 60 * 60 * 1000;   // 1 hr after race before switching card

  // Find the most recent or current race week
  // A "race week" = from Mon before to Sun of race day
  let currentRace = null;
  let isPostRace  = false;

  for (const r of allRaces) {
    const raceMs  = new Date(`${r.date}T${r.time ?? '00:00:00Z'}`).getTime();
    const raceEnd = raceMs + RACE_DURATION_MS;

    // Currently in race week (within 7 days before race)
    const weekStart = raceMs - 7 * 24 * 60 * 60 * 1000;
    if (now >= weekStart && now <= raceEnd + GRACE_MS) {
      currentRace = r;
      isPostRace  = now > raceEnd; // race finished but within grace
      break;
    }

    // Race finished more than grace ago — still show post-race card
    // until next race week starts
    if (now > raceEnd + GRACE_MS) {
      // Check if the NEXT race week hasn't started yet
      const nextRace    = allRaces[allRaces.indexOf(r) + 1];
      const nextWeekStart = nextRace
        ? new Date(`${nextRace.date}T${nextRace.time ?? '00:00:00Z'}`).getTime() - 7 * 24 * 60 * 60 * 1000
        : Infinity;

      if (now < nextWeekStart) {
        // Between races — show next-race countdown card
        if (nextRace) return postNextRaceCard(client, channelId, nextRace, season);
        return;
      }
    }
  }

  if (!currentRace) return;

  // ── Post-race card (race ended, within grace or just after) ──────
  if (isPostRace) {
    const nextRace = allRaces[allRaces.findIndex(r => r.round === currentRace.round) + 1];
    return postNextRaceCard(client, channelId, nextRace ?? currentRace, season);
  }

  // ── Live race week schedule ───────────────────────────────────────
  const ts = (d, t) => Math.floor(new Date(`${d}T${t ?? '00:00:00Z'}`).getTime() / 1000);

  const SESSION_DURATION_MS = {
    practice: 60 * 60 * 1000, qualifying: 60 * 60 * 1000,
    sprint:   45 * 60 * 1000, race: RACE_DURATION_MS,
  };

  const rawSessions = [
    currentRace.FirstPractice  && { n: '🔧 Free Practice 1', t: ts(currentRace.FirstPractice.date,  currentRace.FirstPractice.time),  type: 'practice' },
    currentRace.SecondPractice && { n: '🔧 Free Practice 2', t: ts(currentRace.SecondPractice.date, currentRace.SecondPractice.time), type: 'practice' },
    currentRace.ThirdPractice  && { n: '🔧 Free Practice 3', t: ts(currentRace.ThirdPractice.date,  currentRace.ThirdPractice.time),  type: 'practice' },
    currentRace.Sprint         && { n: '🏃 Sprint Race',      t: ts(currentRace.Sprint.date,          currentRace.Sprint.time),         type: 'sprint' },
    currentRace.Qualifying     && { n: '⏱️ Qualifying',        t: ts(currentRace.Qualifying.date,     currentRace.Qualifying.time),     type: 'qualifying' },
    { n: '🏁 Grand Prix Race', t: ts(currentRace.date, currentRace.time), type: 'race' },
  ].filter(Boolean);

  const cFlag       = flag(currentRace.Circuit.Location.country);
  const nextSession = rawSessions.find(s => s.t * 1000 > now);

  const scheduleLines = rawSessions.map(s => {
    const sessionMs  = s.t * 1000;
    const durationMs = SESSION_DURATION_MS[s.type];
    const ended      = sessionMs + durationMs < now;
    const live       = sessionMs <= now && now < sessionMs + durationMs;
    const isNext     = nextSession && s.t === nextSession.t;

    if (live)   return `${s.n}\n> 🔴 **LIVE NOW** — ends <t:${Math.floor((sessionMs + durationMs) / 1000)}:R>`;
    if (ended)  return `${s.n}\n> ✅ Completed — <t:${s.t}:D>`;
    if (isNext) return `${s.n}\n> ⏳ **NEXT** — <t:${s.t}:F>  ·  <t:${s.t}:R>`;
    return `${s.n}\n> 📅 <t:${s.t}:F>  ·  <t:${s.t}:R>`;
  });

  const mid   = Math.ceil(scheduleLines.length / 2);
  const left  = scheduleLines.slice(0, mid).join('\n\n');
  const right = scheduleLines.slice(mid).join('\n\n');

  let countdownField = null;
  if (nextSession) {
    const diffMs = nextSession.t * 1000 - now;
    countdownField = {
      name: '⏳ Next Session Starts In',
      value: `**${nextSession.n}**\n<t:${nextSession.t}:F>\n**${buildCountdown(diffMs)}**`,
      inline: false,
    };
  }

  const embed = new EmbedBuilder()
    .setColor(0xFF1801)
    .setAuthor({ name: '🏎️ FORMULA 1 · RACE WEEKEND' })
    .setTitle(`${cFlag} ${currentRace.raceName.toUpperCase()} ${cFlag}`)
    .setDescription(
      `📍 **${currentRace.Circuit.circuitName}**\n` +
      `🌍 ${currentRace.Circuit.Location.locality}, **${currentRace.Circuit.Location.country}**\n` +
      `🔢 Round **${currentRace.round}** of the **${season}** Season\n\n` +
      `### 📋 Weekend Schedule`
    )
    .addFields(
      { name: '── Sessions ──', value: left  || '—', inline: true },
      { name: '\u200B',          value: '\u200B',     inline: true },
      { name: '── Status ──',   value: right || '—', inline: true },
      ...(countdownField ? [countdownField] : [])
    )
    .setTimestamp()
    .setFooter({ text: 'Updates every 5 min · F1 Bot Race Weekend' });

  await updateMessage(client, channelId, 'raceWeekend', {
    content: lastPostedRound !== currentRace.round
      ? `@everyone 🏁 **Race weekend is here!** The **${currentRace.raceName}** kicks off soon!`
      : undefined,
    embeds: [embed],
  });

  lastPostedRound = currentRace.round;
}

// ── Next race countdown card ──────────────────────────────────────
async function postNextRaceCard(client, channelId, nextRace, season) {
  const raceTs = Math.floor(new Date(`${nextRace.date}T${nextRace.time ?? '00:00:00Z'}`).getTime() / 1000);
  const diffMs = raceTs * 1000 - Date.now();
  const cFlag  = flag(nextRace.Circuit.Location.country);

  // Channel link to next-race channel
  const nextRaceCh = process.env.CHANNEL_NEXT_RACE
    ? `\n\n📺 Full info: <#${process.env.CHANNEL_NEXT_RACE}>`
    : '';

  const embed = new EmbedBuilder()
    .setColor(0x00D2FF)
    .setAuthor({ name: `🏎️ FORMULA 1 · ${season} SEASON` })
    .setTitle(`✅ Weekend Complete · Next: ${cFlag} ${nextRace.raceName}`)
    .setDescription(
      `📍 **${nextRace.Circuit.circuitName}**\n` +
      `🌍 ${nextRace.Circuit.Location.locality}, **${nextRace.Circuit.Location.country}**\n` +
      `🔢 Round **${nextRace.round}**\n\n` +
      `### ⏳ Next Race Starts In\n## ${buildCountdown(diffMs)}\n` +
      `> <t:${raceTs}:F>  ·  <t:${raceTs}:R>` +
      nextRaceCh
    )
    .setTimestamp()
    .setFooter({ text: 'Updates when next race week begins · F1 Bot' });

  await updateMessage(client, channelId, 'raceWeekend', { embeds: [embed] });
}

module.exports = { checkRaceWeekend };