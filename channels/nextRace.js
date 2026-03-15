// ─────────────────────────────────────────────
//  CHANNEL: NEXT RACE
//  • Hourly on Fri / Sat / Sun only
//  • All info in ONE message
//  • Weather, circuit stats, history, track image
// ─────────────────────────────────────────────

const { EmbedBuilder } = require('discord.js');
const {
  ERGAST, get, fetchChannel, flag,
  wIcon, wDesc, getCircuitData, buildCountdown
} = require('../utils/helpers');
const updateMessage = require('../utils/updateMessage');

async function postNextRace(client, channelId) {

  const ch = await fetchChannel(client, channelId);
  if (!ch) return;

  const data = await get(`${ERGAST}/current/next.json`);
  const race = data?.MRData?.RaceTable?.Races?.[0];

  if (!race) return;

  const ts = t => Math.floor(new Date(t).getTime() / 1000);

  const raceTs   = ts(`${race.date}T${race.time ?? '00:00:00Z'}`);
  const qualTs   = race.Qualifying ? ts(`${race.Qualifying.date}T${race.Qualifying.time ?? '00:00:00Z'}`) : null;
  const sprintTs = race.Sprint ? ts(`${race.Sprint.date}T${race.Sprint.time ?? '00:00:00Z'}`) : null;

  const fp1Ts = race.FirstPractice ? ts(`${race.FirstPractice.date}T${race.FirstPractice.time ?? '00:00:00Z'}`) : null;
  const fp2Ts = race.SecondPractice ? ts(`${race.SecondPractice.date}T${race.SecondPractice.time ?? '00:00:00Z'}`) : null;
  const fp3Ts = race.ThirdPractice ? ts(`${race.ThirdPractice.date}T${race.ThirdPractice.time ?? '00:00:00Z'}`) : null;

  const diffMs = (raceTs * 1000) - Date.now();
  const cFlag = flag(race.Circuit.Location.country);

  const countdownStr =
    diffMs <= 0 ? '🏁 **RACE IS ON!**' : buildCountdown(diffMs);

  const fpLines = [
    fp1Ts ? `🔧 **FP1** → <t:${fp1Ts}:F>  <t:${fp1Ts}:R>` : null,
    fp2Ts ? `🔧 **FP2** → <t:${fp2Ts}:F>  <t:${fp2Ts}:R>` : null,
    fp3Ts ? `🔧 **FP3** → <t:${fp3Ts}:F>  <t:${fp3Ts}:R>` : null
  ].filter(Boolean).join('\n') || '`TBC`';

  // Weather
  let weatherText = '`Weather unavailable`';

  try {
    const lat = race.Circuit.Location.lat;
    const lng = race.Circuit.Location.long;

    const wx = await get(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
      `&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m` +
      `&wind_speed_unit=kmh&timezone=auto`
    );

    const c = wx?.current;

    if (c) {
      weatherText =
        `${wIcon(c.weather_code)} **${wDesc(c.weather_code)}**\n` +
        `> 🌡️ \`${c.temperature_2m}°C\` Feels \`${c.apparent_temperature}°C\`\n` +
        `> 💨 Wind \`${c.wind_speed_10m} km/h\` · 💧 Humidity \`${c.relative_humidity_2m}%\``;
    }
  } catch {}

  // Circuit data
  const circuit = getCircuitData(race.Circuit.circuitId);

  const circuitText = circuit
    ? `🔁 **${circuit.laps} laps** · 📏 \`${circuit.length}\` · 📊 \`${circuit.total}\`\n⚡ Lap Record: *${circuit.record}*`
    : '`Circuit data coming soon`';

  // History
  let historyText = '`No history data`';

  try {
    const hist = await get(`${ERGAST}/circuits/${race.Circuit.circuitId}/results/1.json?limit=100`);

    const winners = (hist?.MRData?.RaceTable?.Races ?? [])
      .sort((a, b) => parseInt(b.season) - parseInt(a.season))
      .slice(0, 5);

    historyText = winners.map(r => {
      const d = r.Results[0].Driver;
      const team = r.Results[0].Constructor.name;
      return `\`${r.season}\` ${flag(r.Circuit.Location.country)} **${d.givenName[0]}. ${d.familyName}** *(${team})*`;
    }).join('\n');

  } catch {}

  const embed = new EmbedBuilder()
    .setColor(0xFF1801)
    .setAuthor({
      name: `🏎️ FORMULA 1 · ${data.MRData.RaceTable.season} SEASON · ROUND ${race.round}`
    })
    .setTitle(`${cFlag} ${race.raceName.toUpperCase()} ${cFlag}`)
    .setDescription(
      `📍 **${race.Circuit.circuitName}**\n` +
      `🌍 ${race.Circuit.Location.locality}, **${race.Circuit.Location.country}**\n` +
      `🔢 Round **${race.round}** of the **${data.MRData.RaceTable.season}** Season\n\n` +
      `### ⏳ Race Starts In\n` +
      `## ${countdownStr}`
    )
    .addFields(
      { name: '🏁 RACE', value: `<t:${raceTs}:F>\n<t:${raceTs}:R>`, inline: true },
      { name: '⏱️ QUALIFYING', value: qualTs ? `<t:${qualTs}:F>\n<t:${qualTs}:R>` : '`TBC`', inline: true },
      { name: '🏃 SPRINT', value: sprintTs ? `<t:${sprintTs}:F>\n<t:${sprintTs}:R>` : '`—`', inline: true },
      { name: '🔧 FREE PRACTICE', value: fpLines },
      { name: '🌤️ WEATHER AT CIRCUIT', value: weatherText },
      { name: '🌐 CIRCUIT STATS', value: circuitText },
      { name: '📜 LAST 5 WINNERS HERE', value: historyText }
    )
    .setTimestamp()
    .setFooter({
      text: `🔄 Hourly on race weekends · Weather: Open-Meteo · Times: your local timezone`
    });

  if (circuit?.image) embed.setImage(circuit.image);

  await updateMessage(client, channelId, 'nextRace', { embeds: [embed] });
}

module.exports = { postNextRace };