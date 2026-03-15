// ─────────────────────────────────────────────
//  CHANNEL: CONSTRUCTOR STANDINGS
//  • Single embed, clean FIA-style layout
//  • Uses full constructor names
//  • Auto-detects all teams — works for 10, 11, 12+
//  • Triggered when new race result detected
//  • Edits existing message (no spam)
// ─────────────────────────────────────────────

const { EmbedBuilder } = require('discord.js');
const { ERGAST, get, fetchChannel, teamDot, refreshTeamDots } = require('../utils/helpers');
const updateMessage = require('../utils/updateMessage');

async function postConstructorStandings(client, channelId) {

  if (!channelId) return;

  const ch = await fetchChannel(client, channelId);
  if (!ch) return;

  await refreshTeamDots();

  const data = await get(`${ERGAST}/current/constructorStandings.json`);

  const list =
    data?.MRData?.StandingsTable?.StandingsLists?.[0]?.ConstructorStandings ?? [];

  const season =
    data?.MRData?.StandingsTable?.season ?? new Date().getFullYear();

  const round =
    data?.MRData?.StandingsTable?.StandingsLists?.[0]?.round ?? '?';

  if (!list.length) {
    return ch.send('No constructor standings available yet.');
  }

  const leader = list[0];
  const second = list[1];

  const leadPoints = parseInt(leader.points) || 0;
  const gapToSecond = second ? (leadPoints - parseInt(second.points)) : 0;

  const posIcon = p =>
    p === '1'
      ? '🥇'
      : p === '2'
      ? '🥈'
      : p === '3'
      ? '🥉'
      : `${p}.`;

  const rows = list.map(s => {

    const constructor = s.Constructor;
    const pts = parseInt(s.points) || 0;
    const wins = parseInt(s.wins) || 0;

    const gap =
      s.position === '1'
        ? 'LEADER'
        : `+${leadPoints - pts}`;

    const dot = teamDot(constructor.name);

    const teamName = constructor.name.padEnd(20);

    return `${posIcon(s.position).padEnd(3)} ${dot} ${teamName} ${String(pts).padStart(3)}  ${gap.padStart(7)}  ${wins ? `🏆${wins}` : '-'}`;
  });

  const embed = new EmbedBuilder()
    .setColor(0xE10600)
    .setAuthor({
      name: `🏎️ FORMULA 1 · ${season} SEASON · ROUND ${round}`
    })
    .setTitle('🏗️ CONSTRUCTORS CHAMPIONSHIP STANDINGS')
    .setDescription(
`🏁 **Championship Battle**

${teamDot(leader.Constructor.name)} **${leader.Constructor.name}** ${
second
? `leads ${teamDot(second.Constructor.name)} **${second.Constructor.name}** by **${gapToSecond} pts**`
: `leads the championship`
}

📊 **Standings**

\`\`\`
POS TEAM                   PTS   GAP    W
${rows.join('\n')}
\`\`\`

⏱ Updated <t:${Math.floor(Date.now() / 1000)}:R>
`
    )
    .setTimestamp()
    .setFooter({
      text: `Updates after each race • ${list.length} teams • Jolpica API`
    });

  await updateMessage(client, channelId, 'constructorStandings', { embeds: [embed] });
}

module.exports = { postConstructorStandings };