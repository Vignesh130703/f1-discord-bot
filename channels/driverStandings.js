// ─────────────────────────────────────────────
//  CHANNEL: DRIVER STANDINGS
//  • Single embed, FIA-style standings table
//  • Supports 20–24 drivers automatically
//  • Triggered when new race result detected
//  • Edits existing message (no spam)
// ─────────────────────────────────────────────

const { EmbedBuilder } = require('discord.js');
const { ERGAST, get, fetchChannel, flag, teamDot } = require('../utils/helpers');
const updateMessage = require('../utils/updateMessage');

async function postDriverStandings(client, channelId) {

  if (!channelId) return;

  const ch = await fetchChannel(client, channelId);
  if (!ch) return;

  const data = await get(`${ERGAST}/current/driverStandings.json`);

  const list =
    data?.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings ?? [];

  const season =
    data?.MRData?.StandingsTable?.season ?? new Date().getFullYear();

  const round =
    data?.MRData?.StandingsTable?.StandingsLists?.[0]?.round ?? '?';

  if (!list.length) {
    return ch.send('No standings data yet.');
  }

  const leader = list[0];
  const second = list[1];

  const leadPoints = parseFloat(leader.points) || 1;
  const gapToSecond = leader.points - second.points;

  const posIcon = p =>
    p === '1'
      ? '🥇'
      : p === '2'
      ? '🥈'
      : p === '3'
      ? '🥉'
      : `${p}.`;

  const rows = list.map((s, idx) => {

    const d = s.Driver;
    const c = s.Constructors?.[0];

    const pos = parseInt(s.position) || (idx + 1);
    const pts = parseInt(s.points);
    const wins = parseInt(s.wins);

    const nat = flag(d?.nationality);
    const dot = teamDot(c?.name);

    const name = `${d?.givenName} ${d?.familyName}`.padEnd(18);

    const gap =
      pos === 1
        ? 'LEADER'
        : `+${leadPoints - pts}`;

    return `${posIcon(String(pos)).padEnd(3)} ${nat} ${name} ${dot} ${String(pts).padStart(3)}  ${gap.padStart(7)}  ${wins || '-'}`;
  });

  const embed = new EmbedBuilder()
    .setColor(0xE10600)
    .setAuthor({
      name: `🏎️ FORMULA 1 · ${season} SEASON · ROUND ${round}`
    })
    .setTitle('🏆 DRIVERS CHAMPIONSHIP STANDINGS')
    .setDescription(
`🏁 **Championship Battle**

${flag(leader.Driver.nationality)} **${leader.Driver.givenName} ${leader.Driver.familyName}** leads ${flag(second.Driver.nationality)} **${second.Driver.givenName} ${second.Driver.familyName}** by **${gapToSecond} pts**

📊 **Standings**

\`\`\`
POS DRIVER              PTS   GAP    W
${rows.join('\n')}
\`\`\`

⏱ Updated <t:${Math.floor(Date.now() / 1000)}:R>
`
    )
    .setTimestamp()
    .setFooter({
      text: `Updates after each race • ${list.length} drivers • Jolpica API`
    });

  await updateMessage(client, channelId, 'driverStandings', { embeds: [embed] });
}

module.exports = { postDriverStandings };