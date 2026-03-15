// ─────────────────────────────────────────────
//  CHANNEL: RACE RESULTS
//  • Shows current race + previous 2 in ONE message
//  • Edits same message on each update
//  • Link to next-race channel in footer
//  • Called on boot + after each race detected
// ─────────────────────────────────────────────

const { EmbedBuilder } = require('discord.js');
const { ERGAST, get, fetchChannel, flag, teamDot } = require('../utils/helpers');
const updateMessage = require('../utils/updateMessage');

async function fetchRoundResult(season, round) {
  try {
    const data = await get(`${ERGAST}/${season}/${round}/results.json`);
    return data?.MRData?.RaceTable?.Races?.[0] ?? null;
  } catch { return null; }
}

function buildResultBlock(race) {
  const cFlag = flag(race.Circuit.Location.country);

  const rows = race.Results.map(r => {
    const pos  = String(r.position).padStart(2);
    const code = (r.Driver.code ?? r.Driver.familyName.slice(0, 3).toUpperCase()).padEnd(4);
    const dot  = teamDot(r.Constructor.name);
    const pts  = String(r.points).padStart(3);
    const time = r.position === '1'
      ? (r.Time?.time ?? r.status ?? '—')
      : (r.Time?.time ? `+${r.Time.time}` : r.status ?? '—');
    return `${pos}  ${code} ${dot}  ${pts}pts  ${time}`;
  });

  const top    = rows.slice(0, 10).join('\n');
  const rest   = rows.slice(10).join('\n');
  const winner = race.Results[0];
  const fl     = race.Results.find(r => r.FastestLap?.rank === '1');

  return {
    name: `${cFlag}  Round ${race.round} — ${race.raceName}`,
    value:
      `🏆 **${winner.Driver.givenName} ${winner.Driver.familyName}** *(${winner.Constructor.name})*\n` +
      `⚡ FL: **${fl ? `${fl.Driver.familyName} — ${fl.FastestLap.Time.time}` : '—'}**\n` +
      `\`\`\`\n${top}\n\n${rest || '—'}\n\`\`\``,
    inline: false,
  };
}

async function postRaceResults(client, channelId) {
  if (!channelId) return;

  // Always fetch last race — works on boot and after race detection
  const latestData = await get(`${ERGAST}/current/last/results.json`);
  const latestRace = latestData?.MRData?.RaceTable?.Races?.[0];
  if (!latestRace || !latestRace.Results?.length) return;

  const season      = latestData.MRData.RaceTable.season;
  const latestRound = parseInt(latestRace.round);

  // Fetch prev 2 rounds in parallel
  const [prev1, prev2] = await Promise.all([
    latestRound >= 2 ? fetchRoundResult(season, latestRound - 1) : Promise.resolve(null),
    latestRound >= 3 ? fetchRoundResult(season, latestRound - 2) : Promise.resolve(null),
  ]);

  // Build fields oldest → newest
  const fields = [];
  if (prev2) fields.push(buildResultBlock(prev2));
  if (prev1) fields.push(buildResultBlock(prev1));
  fields.push(buildResultBlock(latestRace));

  const winner = latestRace.Results[0];
  const cFlag  = flag(latestRace.Circuit.Location.country);

  // Get next race for channel link
  let nextRaceLink = '';
  try {
    const nextData = await get(`${ERGAST}/current/next.json`);
    const nextRace = nextData?.MRData?.RaceTable?.Races?.[0];
    if (nextRace) {
      const nextTs = Math.floor(new Date(`${nextRace.date}T${nextRace.time ?? '00:00:00Z'}`).getTime() / 1000);
      const nextFlag = flag(nextRace.Circuit.Location.country);
      nextRaceLink = `\n\n**Next Race:** ${nextFlag} Round ${nextRace.round} — ${nextRace.raceName}\n` +
        `> <t:${nextTs}:F>  ·  <t:${nextTs}:R>`;
      if (process.env.CHANNEL_NEXT_RACE) {
        nextRaceLink += `\n> 📺 <#${process.env.CHANNEL_NEXT_RACE}>`;
      }
    }
  } catch {}

  const embed = new EmbedBuilder()
    .setColor(0xE10600)
    .setAuthor({ name: `🏎️ FORMULA 1 · ${season} SEASON` })
    .setTitle(`🏁 Race Results — Last ${fields.length} Round${fields.length > 1 ? 's' : ''}`)
    .setDescription(
      `**Latest:** ${cFlag} Round ${latestRace.round} — ${latestRace.raceName}\n` +
      `🏆 **Winner:** ${winner.Driver.givenName} ${winner.Driver.familyName} *(${winner.Constructor.name})*\n` +
      `📍 ${latestRace.Circuit.circuitName}` +
      nextRaceLink
    )
    .addFields(...fields)
    .setTimestamp()
    .setFooter({ text: `Last ${fields.length} races · Updates after each race · Jolpica API` });

  await updateMessage(client, channelId, 'raceResults', { embeds: [embed] });
}

async function postQualifyingResult(client, channelId) {
  if (!channelId) return;

  const data = await get(`${ERGAST}/current/last/qualifying.json`);
  const race = data?.MRData?.RaceTable?.Races?.[0];
  if (!race || !race.QualifyingResults?.length) return;

  const season = data.MRData.RaceTable.season;
  const round  = race.round;
  const cFlag  = flag(race.Circuit.Location.country);

  const rows = race.QualifyingResults.map(r => {
    const pos  = String(r.position).padStart(2);
    const code = (r.Driver.code ?? r.Driver.familyName.slice(0, 3).toUpperCase()).padEnd(4);
    const dot  = teamDot(r.Constructor.name);
    const q1   = r.Q1 ?? '—';
    const q2   = r.Q2 ? `  Q2:${r.Q2}` : '';
    const q3   = r.Q3 ? `  Q3:${r.Q3}` : '';
    const best = (r.Q3 ?? r.Q2 ?? r.Q1 ?? '—').padEnd(10);
    return `${pos}  ${code} ${dot}  ${best}  Q1:${q1}${q2}${q3}`;
  });

  const pole = race.QualifyingResults[0];

  const embed = new EmbedBuilder()
    .setColor(0xFFD700)
    .setAuthor({ name: `🏎️ FORMULA 1 · ${season} SEASON · ROUND ${round}` })
    .setTitle(`⏱️ ${cFlag} ${race.raceName.toUpperCase()} — QUALIFYING`)
    .setDescription(
      `📍 **${race.Circuit.circuitName}**\n\n` +
      `🥇 **Pole:** ${pole.Driver.givenName} ${pole.Driver.familyName} *(${pole.Constructor.name})* — ${pole.Q3 ?? pole.Q2 ?? pole.Q1}`
    )
    .addFields({ name: 'Full Grid', value: `\`\`\`\n${rows.join('\n')}\n\`\`\`` })
    .setTimestamp()
    .setFooter({ text: `Round ${round} Qualifying · ${season} Season` });

  await updateMessage(client, channelId, `quali_${season}_${round}`, { embeds: [embed] });
}

async function postSprintResult(client, channelId) {
  if (!channelId) return;

  const data = await get(`${ERGAST}/current/last/sprint.json`);
  const race = data?.MRData?.RaceTable?.Races?.[0];
  if (!race || !race.SprintResults?.length) return;

  const season = data.MRData.RaceTable.season;
  const round  = race.round;
  const cFlag  = flag(race.Circuit.Location.country);

  const rows = race.SprintResults.map(r => {
    const pos    = String(r.position).padStart(2);
    const code   = (r.Driver.code ?? r.Driver.familyName.slice(0, 3).toUpperCase()).padEnd(4);
    const dot    = teamDot(r.Constructor.name);
    const pts    = String(r.points).padStart(2);
    const status = r.Time?.time ? `+${r.Time.time}` : r.status ?? '—';
    return `${pos}  ${code} ${dot}  ${pts}pts  ${status}`;
  });

  const winner = race.SprintResults[0];

  const embed = new EmbedBuilder()
    .setColor(0xFF6600)
    .setAuthor({ name: `🏎️ FORMULA 1 · ${season} SEASON · ROUND ${round}` })
    .setTitle(`🏃 ${cFlag} ${race.raceName.toUpperCase()} — SPRINT`)
    .setDescription(`🏆 **Winner:** ${winner.Driver.givenName} ${winner.Driver.familyName} *(${winner.Constructor.name})*`)
    .addFields({ name: 'Results', value: `\`\`\`\n${rows.join('\n')}\n\`\`\`` })
    .setTimestamp()
    .setFooter({ text: `Round ${round} Sprint · ${season} Season` });

  await updateMessage(client, channelId, `sprint_${season}_${round}`, { embeds: [embed] });
}

async function postPracticeResult(client, channelId, session = 1) {
  if (!channelId) return;
  const ch = await fetchChannel(client, channelId);
  if (!ch) return;
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(`🔧 Free Practice ${session} — Completed`)
    .setDescription(`Practice ${session} has ended. Full timing on the F1 app.`)
    .setTimestamp();
  await updateMessage(client, channelId, `fp${session}`, { embeds: [embed] });
}

module.exports = { postRaceResults, postQualifyingResult, postSprintResult, postPracticeResult };