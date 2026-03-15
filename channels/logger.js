// ─────────────────────────────────────────────
//  CHANNEL: BOT LOG  (v5)
//  • logAction()     — only posts when an action actually happened
//  • logStartup()    — boot message
//  • logCommand()    — slash command used
//  • logChannelDown()— ONE message per dead channel, tags all
//                      members who have access to that channel
//  RULE: No message = no action. Zero spam.
// ─────────────────────────────────────────────

const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const { fetchChannel } = require('../utils/helpers');

let _client    = null;
let _channelId = null;

function initLogger(client, channelId) {
  _client    = client;
  _channelId = channelId;
}

async function getLogChannel() {
  if (!_client || !_channelId) return null;
  return await fetchChannel(_client, _channelId);
}

// ── Log an action — only called when something real happened ──────
// isError = true → red embed, sent immediately
// isError = false → green embed, sent immediately
async function logAction(action, details = '', isError = false) {
  const ch = await getLogChannel();
  if (!ch) return;

  const embed = new EmbedBuilder()
    .setColor(isError ? 0xFF0000 : 0x00FF88)
    .setTitle(isError ? '⚠️ Bot Error' : '🤖 Bot Action')
    .addFields(
      { name: '📋 Action', value: action,  inline: false },
      { name: '🕐 Time',   value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
      ...(details ? [{ name: isError ? '⚠️ Error' : '📄 Details', value: `\`${details}\``, inline: false }] : [])
    )
    .setTimestamp()
    .setFooter({ text: 'F1 Bot — Action Log' });

  await ch.send({ embeds: [embed] }).catch(() => {});
}

// ── Dead channel alert — tags ALL members with access ─────────────
async function logChannelDown(client, channelKey, deadChannelId, logChannelId) {
  const logCh = await fetchChannel(client, logChannelId);
  if (!logCh) return;

  // Try to find members who had access to the dead channel
  let mentions = '';
  try {
    const guild = logCh.guild;
    const members = await guild.members.fetch();

    // Tag members who can view the log channel (proxy for bot managers)
    const authorised = members.filter(m =>
      !m.user.bot &&
      logCh.permissionsFor(m)?.has(PermissionsBitField.Flags.ViewChannel)
    );

    mentions = authorised.map(m => `<@${m.id}>`).join(' ');
  } catch {}

  const embed = new EmbedBuilder()
    .setColor(0xFF0000)
    .setTitle('🔴 Channel Down Alert')
    .setDescription(
      `The **${channelKey}** channel (ID: \`${deadChannelId}\`) is unreachable.\n\n` +
      `The bot cannot post to this channel. Please check:\n` +
      `> • Channel still exists\n` +
      `> • Bot has **View Channel** + **Send Messages** permissions\n` +
      `> • Channel ID in \`.env\` is correct`
    )
    .setTimestamp()
    .setFooter({ text: 'F1 Bot — Channel Monitor' });

  await logCh.send({
    content: mentions || undefined,
    embeds: [embed],
  }).catch(() => {});
}

// ── Log slash command used ────────────────────────────────────────
async function logCommand(interaction) {
  const ch = await getLogChannel();
  if (!ch) return;

  const opts = interaction.options?.data?.length
    ? interaction.options.data.map(o => `\`${o.name}: ${o.value}\``).join('  ')
    : '—';

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
    .setTitle(`⌨️  /${interaction.commandName}`)
    .addFields(
      { name: '👤 User',    value: interaction.user.username,       inline: true },
      { name: '📺 Channel', value: `<#${interaction.channelId}>`,  inline: true },
      { name: '🕐 Time',    value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
      { name: '⚙️ Options', value: opts }
    )
    .setTimestamp()
    .setFooter({ text: `User ID: ${interaction.user.id}` });

  await ch.send({ embeds: [embed] }).catch(() => {});
}

// ── Log startup ───────────────────────────────────────────────────
async function logStartup(client) {
  const ch = await getLogChannel();
  if (!ch) return;

  const embed = new EmbedBuilder()
    .setColor(0x00FF88)
    .setTitle('🚀  Bot Started')
    .setDescription(`**${client.user.tag}** is now online and ready.`)
    .addFields(
      { name: '🕐 Started At', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
      { name: '📡 Ping',       value: `\`${client.ws.ping}ms\``,                inline: true }
    )
    .setTimestamp()
    .setFooter({ text: 'F1 Bot — Startup Log' });

  await ch.send({ embeds: [embed] }).catch(() => {});
}

// ── Backwards compat shim ─────────────────────────────────────────
async function logCron(taskName, success = true, errorMsg = null) {
  if (!success) await logAction(`❌ **${taskName}** failed`, errorMsg ?? '', true);
}

async function logBatch(entries) {
  for (const e of entries) {
    if (e.dead) {
      // handled separately via logChannelDown
      continue;
    }
    if (!e.success) {
      await logAction(`❌ **${e.name}** failed`, e.error ?? '', true);
    }
  }
}

module.exports = { initLogger, logAction, logCron, logBatch, logCommand, logStartup, logChannelDown };
