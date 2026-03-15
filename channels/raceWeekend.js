// ─────────────────────────────────────────────
//  CHANNEL: RACE WEEKEND  (v5)
//  • Updates every 5 min during race week
//  • Live countdown to next session
//  • LIVE NOW during active sessions
//  • Completed tick after sessions end
//  • After race weekend: shows next race countdown
// ─────────────────────────────────────────────

const { EmbedBuilder } = require('discord.js');
const { ERGAST, get, fetchChannel, flag, buildCountdown } = require('../utils/helpers');
const updateMessage = require('../utils/updateMessage');

let lastWeekendRound = '';

async function checkRaceWeekend(client, channelId) {
  if (!channelId) return;

  const ch = await fetchChannel(client, channelId);
  if (!ch) return;

  const data = await get(`${ERGAST}/current/next.json`);
  const race = data?.MRData?.RaceTable?.Races?.[0];
  if (!race) return;

  const raceDate = new Date(`${race.date}T${race.time ?? '00:00:00Z'}`);
  const now      = Date.now();
  const daysAway = (raceDate - now) / (1000 * 60 * 60 * 24);

  // After race weekend — show next race countdown
  if (daysAway < -1) {
    return postPostRaceCard(client, channelId, race, data.MRData.RaceTable.season);
  }

  // Only run during race week
  if (daysAway > 7) return;

  const ts = (d, t) => Math.floor(new Date(`${d}T${t ?? '00:00:00Z'}`).getTime() / 1000);

  const SESSION_DURATION_MS = {
    practice:   60 * 60 * 1000,
    qualifying: 60 * 60 * 1000,
    sprint:     45 * 60 * 1000,
    race:        2 * 60 * 60 * 1000,
  };

  const rawSessions = [
    race.FirstPractice  && { n: '🔧 Free Practice 1', t: ts(race.FirstPractice.date,  race.FirstPractice.time),  type: 'practice' },
    race.SecondPractice && { n: '🔧 Free Practice 2', t: ts(race.SecondPractice.date, race.SecondPractice.time), type: 'practice' },
    race.ThirdPractice  && { n: '🔧 Free Practice 3', t: ts(race.ThirdPractice.date,  race.ThirdPractice.time),  type: 'practice' },
    race.Sprint         && { n: '🏃 Sprint Race',      t: ts(race.Sprint.date,          race.Sprint.time),         type: 'sprint' },
    race.Qualifying     && { n: '⏱️ Qualifying',        t: ts(race.Qualifying.date,     race.Qualifying.time),     type: 'qualifying' },
    { n: '🏁 Grand Prix Race', t: ts(race.date, race.time), type: 'race' },
  ].filter(Boolean);

  const cFlag      = flag(race.Circuit.Location.country);
  const nextSession = rawSessions.find(s => s.t * 1000 > now);

  const scheduleLines = rawSessions.map(s => {
    const sessionMs  = s.t * 1000;
    const durationMs = SESSION_DURATION_MS[s.type] || SESSION_DURATION_MS.practice;
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

  // Countdown field for next session
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
    .setTitle(`${cFlag} ${race.raceName.toUpperCase()} ${cFlag}`)
    .setDescription(
      `📍 **${race.Circuit.circuitName}**\n` +
      `🌍 ${race.Circuit.Location.locality}, **${race.Circuit.Location.country}**\n` +
      `🔢 Round **${race.round}** of the **${data.MRData.RaceTable.season}** Season\n\n` +
      `### 📋 Weekend Schedule`
    )
    .addFields(
      { name: '── Sessions ──', value: left    || '—', inline: true },
      { name: '\u200B',          value: '\u200B',       inline: true },
      { name: '── Status ──',   value: right   || '—', inline: true },
      ...(countdownField ? [countdownField] : [])
    )
    .setTimestamp()
    .setFooter({ text: 'Updates every 5 min · F1 Bot Race Weekend' });

  await updateMessage(client, channelId, 'raceWeekend', {
    content: lastWeekendRound !== race.round
      ? `@everyone 🏁 **Race weekend is here!** The **${race.raceName}** kicks off soon!`
      : undefined,
    embeds: [embed],
  });

  lastWeekendRound = race.round;
}

// ── Post-race card: shows next race countdown ─────────────────────
async function postPostRaceCard(client, channelId, nextRace, season) {
  const raceTs = Math.floor(new Date(`${nextRace.date}T${nextRace.time ?? '00:00:00Z'}`).getTime() / 1000);
  const diffMs = raceTs * 1000 - Date.now();
  const cFlag  = flag(nextRace.Circuit.Location.country);

  const embed = new EmbedBuilder()
    .setColor(0x00D2FF)
    .setAuthor({ name: `🏎️ FORMULA 1 · ${season} SEASON` })
    .setTitle(`✅ Weekend Complete · Next: ${cFlag} ${nextRace.raceName}`)
    .setDescription(
      `📍 **${nextRace.Circuit.circuitName}**\n` +
      `🌍 ${nextRace.Circuit.Location.locality}, **${nextRace.Circuit.Location.country}**\n` +
      `🔢 Round **${nextRace.round}**\n\n` +
      `### ⏳ Next Race In\n## ${buildCountdown(diffMs)}\n` +
      `> <t:${raceTs}:F>  ·  <t:${raceTs}:R>`
    )
    .setTimestamp()
    .setFooter({ text: 'Race weekend complete · F1 Bot' });

  await updateMessage(client, channelId, 'raceWeekend', { embeds: [embed] });
}

module.exports = { checkRaceWeekend };