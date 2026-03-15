// ─────────────────────────────────────────────
//  CHANNEL: RACE RESULTS  (v5)
//  • Each round posts as a NEW message (history stays)
//  • Previous rounds remain in the channel forever
//  • Qualifying + Sprint + Practice also supported
//  • Store key uses round number so each race = unique message
// ─────────────────────────────────────────────

const { EmbedBuilder } = require('discord.js');
const { ERGAST, get, fetchChannel, flag, posIcon, teamDot } = require('../utils/helpers');
const { loadStore, saveStore } = require('../utils/messageStore');

// ── Send or edit a per-round message ─────────────────────────────
// Uses storeKey = e.g. "raceResult_2026_5" so each round gets its own message
async function sendRoundMessage(client, channelId, storeKey, payload) {
  const ch = await fetchChannel(client, channelId);
  if (!ch) return;

  const store = loadStore();

  if (store[storeKey]) {
    try {
      const existing = await ch.messages.fetch(store[storeKey]);
      await existing.edit(payload);
      return;
    } catch {
      // message gone — fall through to send new
      delete store[storeKey];
      saveStore(store);
    }
  }

  // New message for this round
  const msg = await ch.send(payload);
  store[storeKey] = msg.id;
  saveStore(store);
}

// ── Race Result ───────────────────────────────────────────────────
async function postRaceResults(client, channelId) {
  if (!channelId) return;

  const data = await get(`${ERGAST}/current/last/results.json`);
  const race = data?.MRData?.RaceTable?.Races?.[0];
  if (!race || !race.Results?.length) return;

  const season  = data.MRData.RaceTable.season;
  const round   = race.round;
  const cFlag   = flag(race.Circuit.Location.country);

  // Top 10
  const topRows = race.Results.slice(0, 10).map(r => {
    const code = r.Driver.code ?? r.Driver.familyName.slice(0, 3).toUpperCase();
    const pts  = String(r.points).padStart(3);
    const time = r.position === '1'
      ? (r.Time?.time ?? '—')
      : (r.Time?.time ? `+${r.Time.time}` : r.status ?? '—');
    return `${String(r.position).padStart(2)}  ${code.padEnd(4)} ${teamDot(r.Constructor.name)}  ${pts}pts  ${time}`;
  });

  // Rest (11–20)
  const restRows = race.Results.slice(10).map(r => {
    const code   = r.Driver.code ?? r.Driver.familyName.slice(0, 3).toUpperCase();
    const status = r.Time?.time ? `+${r.Time.time}` : r.status ?? '—';
    return `${String(r.position).padStart(2)}  ${code.padEnd(4)} ${teamDot(r.Constructor.name)}  ${status}`;
  });

  const winner = race.Results[0];
  const flHolder = race.Results.find(r => r.FastestLap?.rank === '1');

  const embed = new EmbedBuilder()
    .setColor(0xE10600)
    .setAuthor({ name: `🏎️ FORMULA 1 · ${season} SEASON · ROUND ${round}` })
    .setTitle(`🏁 ${cFlag} ${race.raceName.toUpperCase()} — RACE RESULT`)
    .setDescription(
      `📍 **${race.Circuit.circuitName}**\n` +
      `🌍 ${race.Circuit.Location.locality}, **${race.Circuit.Location.country}**\n\n` +
      `🏆 **Winner:** ${winner.Driver.givenName} ${winner.Driver.familyName} *(${winner.Constructor.name})*\n` +
      `⚡ **Fastest Lap:** ${flHolder ? `${flHolder.Driver.givenName} ${flHolder.Driver.familyName} — ${flHolder.FastestLap.Time.time}` : '—'}`
    )
    .addFields(
      {
        name: 'Results',
        value: `\`\`\`\n${topRows.join('\n')}\n\n${restRows.join('\n')}\n\`\`\``,
        inline: false,
      }
    )
    .setTimestamp()
    .setFooter({ text: `Round ${round} · ${season} Season · Jolpica API` });

  await sendRoundMessage(client, channelId, `raceResult_${season}_${round}`, { embeds: [embed] });
}

// ── Qualifying Result ─────────────────────────────────────────────
async function postQualifyingResult(client, channelId) {
  if (!channelId) return;

  const data = await get(`${ERGAST}/current/last/qualifying.json`);
  const race = data?.MRData?.RaceTable?.Races?.[0];
  if (!race || !race.QualifyingResults?.length) return;

  const season = data.MRData.RaceTable.season;
  const round  = race.round;
  const cFlag  = flag(race.Circuit.Location.country);

  const rows = race.QualifyingResults.map(r => {
    const code = r.Driver.code ?? r.Driver.familyName.slice(0, 3).toUpperCase();
    const best = r.Q3 ?? r.Q2 ?? r.Q1 ?? '—';
    const q1   = r.Q1 ?? '—';
    const q2   = r.Q2 ?? '—';
    const q3   = r.Q3 ?? '—';
    return `${String(r.position).padStart(2)}  ${code.padEnd(4)} ${teamDot(r.Constructor.name)}  ${best.padEnd(10)}  Q1:${q1}  Q2:${q2}  Q3:${q3}`;
  });

  const pole = race.QualifyingResults[0];

  const embed = new EmbedBuilder()
    .setColor(0xFFD700)
    .setAuthor({ name: `🏎️ FORMULA 1 · ${season} SEASON · ROUND ${round}` })
    .setTitle(`⏱️ ${cFlag} ${race.raceName.toUpperCase()} — QUALIFYING`)
    .setDescription(
      `📍 **${race.Circuit.circuitName}**\n\n` +
      `🥇 **Pole:** ${pole.Driver.givenName} ${pole.Driver.familyName} — ${pole.Q3 ?? pole.Q2 ?? pole.Q1}`
    )
    .addFields({
      name: 'Results',
      value: `\`\`\`\n${rows.join('\n')}\n\`\`\``,
    })
    .setTimestamp()
    .setFooter({ text: `Round ${round} Qualifying · ${season} Season` });

  await sendRoundMessage(client, channelId, `qualifyingResult_${season}_${round}`, { embeds: [embed] });
}

// ── Sprint Result ─────────────────────────────────────────────────
async function postSprintResult(client, channelId) {
  if (!channelId) return;

  const data = await get(`${ERGAST}/current/last/sprint.json`);
  const race = data?.MRData?.RaceTable?.Races?.[0];
  if (!race || !race.SprintResults?.length) return;

  const season = data.MRData.RaceTable.season;
  const round  = race.round;
  const cFlag  = flag(race.Circuit.Location.country);

  const rows = race.SprintResults.map(r => {
    const code   = r.Driver.code ?? r.Driver.familyName.slice(0, 3).toUpperCase();
    const pts    = String(r.points).padStart(2);
    const status = r.Time?.time ? `+${r.Time.time}` : r.status ?? '—';
    return `${String(r.position).padStart(2)}  ${code.padEnd(4)} ${teamDot(r.Constructor.name)}  ${pts}pts  ${status}`;
  });

  const winner = race.SprintResults[0];

  const embed = new EmbedBuilder()
    .setColor(0xFF6600)
    .setAuthor({ name: `🏎️ FORMULA 1 · ${season} SEASON · ROUND ${round}` })
    .setTitle(`🏃 ${cFlag} ${race.raceName.toUpperCase()} — SPRINT`)
    .setDescription(
      `🏆 **Winner:** ${winner.Driver.givenName} ${winner.Driver.familyName} *(${winner.Constructor.name})*`
    )
    .addFields({
      name: 'Results',
      value: `\`\`\`\n${rows.join('\n')}\n\`\`\``,
    })
    .setTimestamp()
    .setFooter({ text: `Round ${round} Sprint · ${season} Season` });

  await sendRoundMessage(client, channelId, `sprintResult_${season}_${round}`, { embeds: [embed] });
}

// ── Practice Result (placeholder — Ergast doesn't have FP timing) ─
async function postPracticeResult(client, channelId, session = 1) {
  if (!channelId) return;
  const ch = await fetchChannel(client, channelId);
  if (!ch) return;

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(`🔧 Free Practice ${session} — Completed`)
    .setDescription(`Practice ${session} has ended. Full timing available on the official F1 app.`)
    .setTimestamp();

  const { loadStore, saveStore } = require('../utils/messageStore');
  const store = loadStore();
  const key   = `fp${session}Result`;

  if (store[key]) {
    try {
      const existing = await ch.messages.fetch(store[key]);
      await existing.edit({ embeds: [embed] });
      return;
    } catch { delete store[key]; saveStore(store); }
  }

  const msg = await ch.send({ embeds: [embed] });
  store[key] = msg.id;
  saveStore(store);
}

module.exports = { postRaceResults, postQualifyingResult, postSprintResult, postPracticeResult };
