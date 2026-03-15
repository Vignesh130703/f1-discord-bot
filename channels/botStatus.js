// ─────────────────────────────────────────────
//  CHANNEL: BOT STATUS DASHBOARD
//  • Updates every 30 min
//  • Edits the same message (no spam)
// ─────────────────────────────────────────────

const { EmbedBuilder } = require('discord.js');
const { fetchChannel, buildCountdown, ERGAST, get } = require('../utils/helpers');
const updateMessage = require('../utils/updateMessage');

async function checkApiHealth() {
  try {
    await get(`${ERGAST}/current.json`);
    return true;
  } catch {
    return false;
  }
}

async function postBotStatus(client, channelId, botStatus) {
  if (!channelId) return;

  const ch = await fetchChannel(client, channelId);
  if (!ch) return;

  const apiHealthy = await checkApiHealth();

  const tasks = [
    { name: '🏆  Driver Standings',      key: 'Driver Standings',      schedule: 'After race finishes' },
    { name: '🏗️  Constructor Standings', key: 'Constructor Standings', schedule: 'After race finishes' },
    { name: '📅  Race Calendar',         key: 'Timetable',             schedule: 'After race finishes' },
    { name: '🏎️  Next Race Info',        key: 'Next Race',             schedule: 'Hourly on race weekends' },
    { name: '📻  Session Alerts',        key: 'Alerts',                schedule: '1 hr before each session' },
    { name: '🏟️  Race Weekend Mode',     key: 'Race Weekend',          schedule: 'Race week start' },
    { name: '🎬  Highlights',            key: 'Highlights',            schedule: 'Every 30 min' },
    { name: '🤖  Bot Status',            key: 'Bot Status',            schedule: 'Every 30 min' },
  ];

  const errorCount = Object.keys(botStatus.errors ?? {}).length;
  const statusIcon = errorCount === 0 ? '🟢' : errorCount < 3 ? '🟡' : '🔴';
  const statusText = errorCount === 0
    ? 'ALL SYSTEMS OPERATIONAL'
    : `${errorCount} ISSUE(S) DETECTED`;

  const rows = tasks.map(t => {
    const last = botStatus.lastRun?.[t.key];
    const err  = botStatus.errors?.[t.key];

    const icon = err ? '🔴' : last ? '🟢' : '⚪';

    const lastStr = last
      ? `<t:${Math.floor(last / 1000)}:R>`
      : '`Not run yet`';

    const errStr = err
      ? `\n> ⚠️ \`${err.slice(0, 60)}\``
      : '';

    return `${icon} **${t.name}**\n> ${t.schedule}  ·  Last: ${lastStr}${errStr}`;
  });

  const half  = Math.ceil(rows.length / 2);
  const left  = rows.slice(0, half).join('\n\n');
  const right = rows.slice(half).join('\n\n');

  const embed = new EmbedBuilder()
    .setColor(errorCount === 0 ? 0x00FF88 : 0xFFD700)
    .setAuthor({ name: '🤖  F1 BOT  ·  SYSTEM STATUS DASHBOARD' })
    .setTitle(`${statusIcon}  ${statusText}`)
    .setDescription(
      `> 🕐 **Uptime:** ${buildCountdown(Date.now() - botStatus.startTime)}\n` +
      `> 🚀 **Online since:** <t:${Math.floor(botStatus.startTime / 1000)}:F>\n` +
      `> 📡 **WebSocket Ping:** \`${client.ws.ping}ms\`\n` +
      `> 🌐 **ERGAST API:** ${apiHealthy ? '🟢 Online' : '🔴 Offline'}\n` +
      `> 💬 **Discord Connection:** ${client.ws.status === 0 ? '🟢 Connected' : '🔴 Issue'}\n` +
      `> ⚠️ **Active errors:** \`${errorCount}\`\n\u200B`
    )
    .addFields(
      { name: '── Task Status ──', value: left, inline: true },
      { name: '\u200B', value: '\u200B', inline: true },
      { name: '── Schedules ──', value: right, inline: true },
    )
    .setTimestamp()
    .setFooter({ text: 'Refreshes every 30 min  ·  F1 Bot System Monitor' });

  await updateMessage(client, channelId, 'botStatus', { embeds: [embed] });
}

module.exports = { postBotStatus };