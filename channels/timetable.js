// ─────────────────────────────────────────────
//  CHANNEL: RACE CALENDAR / TIMETABLE
//  • Triggered when new race result detected
//  • Edits same message instead of spamming
// ─────────────────────────────────────────────

const { EmbedBuilder } = require('discord.js');
const { ERGAST, get, fetchChannel, flag } = require('../utils/helpers');
const updateMessage = require('../utils/updateMessage');

async function postTimetable(client, channelId) {

  const ch = await fetchChannel(client, channelId);
  if (!ch) return;

  const data = await get(`${ERGAST}/current.json`);

  const races =
    data?.MRData?.RaceTable?.Races ?? [];

  const season =
    data?.MRData?.RaceTable?.season ?? new Date().getFullYear();

  const now = new Date();

  const nextIdx = races.findIndex(r =>
    new Date(`${r.date}T${r.time ?? '00:00:00Z'}`) > now
  );

  const doneCount =
    nextIdx === -1 ? races.length : nextIdx;

  const rows = races.map((r, i) => {

    const raceDate = new Date(`${r.date}T${r.time ?? '00:00:00Z'}`);

    const past = raceDate < now;
    const isNext = i === nextIdx;

    const raceTs =
      Math.floor(raceDate.getTime() / 1000);

    const cFlag =
      flag(r.Circuit.Location.country);

    let badge;

    if (past) badge = '`✅`';
    else if (isNext) badge = '`🔜`';
    else badge = '`⏳`';

    if (isNext) {
      return `${badge} ${cFlag} **R${r.round}** · **${r.raceName}**\n` +
        `> 📍 ${r.Circuit.circuitName}  ·  <t:${raceTs}:D>  (<t:${raceTs}:R>)`;
    }

    return `${badge} ${cFlag} **R${r.round}** · ${r.raceName}\n` +
      `> 📍 ${r.Circuit.circuitName}  ·  \`${r.date}\``;

  });

  // chunk rows to avoid discord limits
  const chunkRows = (arr, size) => {
    const out = [];
    for (let i = 0; i < arr.length; i += size)
      out.push(arr.slice(i, i + size));
    return out;
  };

  const chunks = chunkRows(rows, 8);

  const embed = new EmbedBuilder()
    .setColor(0x00D2FF)
    .setAuthor({
      name: `🏎️  FORMULA 1  ·  ${season} SEASON`
    })
    .setTitle(`📅  ${season} FIA FORMULA 1 WORLD CHAMPIONSHIP — RACE CALENDAR`)
    .setDescription(
      `> 🏁 **${doneCount}** races completed  ·  **${races.length - doneCount}** remaining\n` +
      `> \`✅\` Done  \`🔜\` Next  \`⏳\` Upcoming\n\u200B`
    );

  chunks.forEach((chunk, i) => {

    const startRound =
      (i * 8) + 1;

    const endRound =
      startRound + chunk.length - 1;

    embed.addFields({
      name: i === 0
        ? '── Rounds ──'
        : `── R${startRound} – R${endRound} ──`,
      value: chunk.join('\n\n'),
      inline: false
    });

  });

  embed
    .setTimestamp()
    .setFooter({
      text: `${races.length} rounds total  ·  Updates after each race  ·  Jolpica API`
    });

  await updateMessage(client, channelId, 'timetable', { embeds: [embed] });

}

module.exports = { postTimetable };