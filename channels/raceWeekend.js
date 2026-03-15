// ─────────────────────────────────────────────
//  CHANNEL: RACE WEEKEND MODE  (v4)
//  • Posts ONCE when race week begins (triggered Mon 6 AM cron)
//  • Auto-updates the same message after each session ends (+3h)
//  • Shows live/completed/upcoming status per session
//  • Includes countdown for next upcoming session
// ─────────────────────────────────────────────

const { EmbedBuilder } = require('discord.js');
const { ERGAST, get, fetchChannel, flag } = require('../utils/helpers');
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
  const daysAway = (raceDate - Date.now()) / (1000 * 60 * 60 * 24);

  // Only active during race week (Mon before to Sun of race)
  if (daysAway > 7 || daysAway < -1) return;

  const ts  = (d, t) => Math.floor(new Date(`${d}T${t ?? '00:00:00Z'}`).getTime() / 1000);
  const now = Date.now();

  const SESSION_DURATION_MS = {
    practice: 60 * 60 * 1000, qualifying: 60 * 60 * 1000,
    sprint: 45 * 60 * 1000, race: 2 * 60 * 60 * 1000,
  };

  const rawSessions = [
    race.FirstPractice  && { n: '🔧 Free Practice 1', t: ts(race.FirstPractice.date,  race.FirstPractice.time),  type: 'practice' },
    race.SecondPractice && { n: '🔧 Free Practice 2', t: ts(race.SecondPractice.date, race.SecondPractice.time), type: 'practice' },
    race.ThirdPractice  && { n: '🔧 Free Practice 3', t: ts(race.ThirdPractice.date,  race.ThirdPractice.time),  type: 'practice' },
    race.Sprint         && { n: '🏃 Sprint Race',      t: ts(race.Sprint.date,          race.Sprint.time),          type: 'sprint' },
    race.Qualifying     && { n: '⏱️ Qualifying',        t: ts(race.Qualifying.date,     race.Qualifying.time),     type: 'qualifying' },
    { n: '🏁 GRAND PRIX RACE', t: ts(race.date, race.time), type: 'race' },
  ].filter(Boolean);

  const cFlag = flag(race.Circuit.Location.country);

  const scheduleLines = rawSessions.map(s => {
    const sessionMs  = s.t * 1000;
    const durationMs = SESSION_DURATION_MS[s.type] || SESSION_DURATION_MS.practice;
    const ended      = sessionMs + durationMs < now;
    const live       = sessionMs <= now && now < sessionMs + durationMs;

    if (ended) return `${s.n}\n> ✅ **Completed** — <t:${s.t}:D>`;
    if (live)  return `${s.n}\n> 🔴 **LIVE RIGHT NOW!** <t:${s.t}:R>`;
    return `${s.n}\n> 📅 <t:${s.t}:F>  ·  ⏱️ <t:${s.t}:R>`;
  });

  const mid   = Math.ceil(scheduleLines.length / 2);
  const left  = scheduleLines.slice(0, mid).join('\n\n');
  const right = scheduleLines.slice(mid).join('\n\n');

  const embed = new EmbedBuilder()
    .setColor(0xFF1801)
    .setAuthor({ name: '🏎️ FORMULA 1 · RACE WEEKEND' })
    .setTitle(`${cFlag} ${race.raceName.toUpperCase()} ${cFlag}`)
    .setDescription(
      `📍 **${race.Circuit.circuitName}**\n` +
      `🌍 ${race.Circuit.Location.locality}, **${race.Circuit.Location.country}**\n` +
      `🔢 Round **${race.round}** of the **${data.MRData.RaceTable.season}** Season\n\n` +
      `### 📋 Full Weekend Schedule\n` +
      `*Updates automatically after each session ends*`
    )
    .addFields(
      { name: '── Sessions ──', value: left,      inline: true },
      { name: '\u200B',          value: '\u200B',  inline: true },
      { name: '── Status ──',   value: right,     inline: true }
    )
    .setTimestamp()
    .setFooter({ text: `Auto-updates after each session · F1 Bot Race Weekend` });

  await updateMessage(client, channelId, 'raceWeekend', {
    content: lastWeekendRound !== race.round
      ? `@everyone 🏁 **Race weekend is here!** The **${race.raceName}** weekend begins!`
      : undefined,
    embeds: [embed],
  });

  lastWeekendRound = race.round;
}

module.exports = { checkRaceWeekend };
