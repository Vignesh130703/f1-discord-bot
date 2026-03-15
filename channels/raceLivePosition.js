// ─────────────────────────────────────────────
// CHANNEL: RACE LIVE POSITION
// Shows live race positions and converts to
// final classification after race.
// Uses OpenF1 telemetry API
// ─────────────────────────────────────────────

const { EmbedBuilder } = require("discord.js");

let liveMessage = null;
let lastPositions = "";
let raceFinished = false;

const DRIVER_CODES = {
  1: "VER", 11: "PER",
  4: "NOR", 81: "PIA",
  16: "LEC", 55: "SAI",
  44: "HAM", 63: "RUS",
  14: "ALO", 18: "STR",
  22: "TSU", 3: "RIC",
  10: "GAS", 31: "OCO",
  27: "HUL", 20: "MAG",
  23: "ALB", 2: "SAR",
  77: "BOT", 24: "ZHO"
};

async function fetchPositions() {
  try {
    const res = await fetch("https://api.openf1.org/v1/position?session_key=latest");
    const data = await res.json();

    const latest = {};

    data.forEach(d => {
      latest[d.driver_number] = d.position;
    });

    const sorted = Object.entries(latest)
      .sort((a, b) => a[1] - b[1])
      .map(([num, pos]) => ({
        code: DRIVER_CODES[num] || num,
        pos
      }));

    return sorted;
  } catch (err) {
    console.error("Live timing API error:", err.message);
    return null;
  }
}

function buildTable(drivers) {
  return drivers
    .map((d, i) => {
      if (i === 0) return `1  ${d.code}   Leader`;
      return `${d.pos}  ${d.code}`;
    })
    .join("\n");
}

async function updateRaceLivePosition(client, channelId) {

  if (raceFinished) return;

  const channel = await client.channels.fetch(channelId);
  const drivers = await fetchPositions();

  if (!drivers) return;

  const table = buildTable(drivers);

  if (table === lastPositions) return;

  lastPositions = table;

  const embed = new EmbedBuilder()
    .setTitle("🏁 Live Race Positions")
    .setDescription("```" + table + "```")
    .setFooter({ text: "🔴 LIVE • updating every 10s" })
    .setColor(0xff0000);

  if (!liveMessage) {
    liveMessage = await channel.send({ embeds: [embed] });
  } else {
    await liveMessage.edit({ embeds: [embed] });
  }
}

function finalizeRace() {
  raceFinished = true;
}

module.exports = {
  updateRaceLivePosition,
  finalizeRace
};