// ─────────────────────────────────────────────
//  SLASH COMMANDS  (v5)
//  • /update <channel>  — run from ANY channel (including log channel)
//    provide the channel name as option → updates that specific channel
//    e.g. /update channel:#f1-standings  → updates standings only
//  • All other commands unchanged
// ─────────────────────────────────────────────

const { logCommand } = require('./logger');
const { EmbedBuilder } = require('discord.js');
const { fetchChannel } = require('../utils/helpers');

const { postDriverStandings }      = require('./driverStandings');
const { postConstructorStandings } = require('./constructorStandings');
const { postTimetable }            = require('./timetable');
const { postNextRace }             = require('./nextRace');
const { postBotStatus }            = require('./botStatus');
const { checkRaceWeekend }         = require('./raceWeekend');
const { checkSessionAlerts }       = require('./alerts');
const { postRaceResults }          = require('./raceResults');

let _pollF1Highlights = null;
try { _pollF1Highlights = require('./highlights').pollF1Highlights; } catch {}

// ── Channel name → update function map ───────────────────────────
function buildUpdateMap(client, CHANNELS, botStatus) {
  return {
    'standings':     { label: 'Driver Standings',     fn: () => postDriverStandings(client, CHANNELS.DRIVER_STANDINGS) },
    'constructors':  { label: 'Constructor Standings',fn: () => postConstructorStandings(client, CHANNELS.CONSTRUCTOR_STANDINGS) },
    'timetable':     { label: 'Timetable',            fn: () => postTimetable(client, CHANNELS.TIMETABLE) },
    'nextrace':      { label: 'Next Race',            fn: () => postNextRace(client, CHANNELS.NEXT_RACE) },
    'raceweekend':   { label: 'Race Weekend',         fn: () => checkRaceWeekend(client, CHANNELS.RACE_WEEKEND) },
    'results':       { label: 'Race Results',         fn: () => postRaceResults(client, CHANNELS.RACE_RESULTS) },
    'alerts':        { label: 'Session Alerts',       fn: () => checkSessionAlerts(client, CHANNELS.ALERTS) },
    'status':        { label: 'Bot Status',           fn: () => postBotStatus(client, CHANNELS.BOT_STATUS, botStatus) },
    'highlights':    { label: 'Highlights',           fn: () => _pollF1Highlights?.(client, CHANNELS.HIGHLIGHTS, process.env.YOUTUBE_API_KEY) },
  };
}

// ── Also support matching by actual channel ID ────────────────────
function buildChannelIdMap(client, CHANNELS, botStatus) {
  return [
    { id: CHANNELS.DRIVER_STANDINGS,      label: 'Driver Standings',     fn: () => postDriverStandings(client, CHANNELS.DRIVER_STANDINGS) },
    { id: CHANNELS.CONSTRUCTOR_STANDINGS, label: 'Constructor Standings',fn: () => postConstructorStandings(client, CHANNELS.CONSTRUCTOR_STANDINGS) },
    { id: CHANNELS.TIMETABLE,             label: 'Timetable',            fn: () => postTimetable(client, CHANNELS.TIMETABLE) },
    { id: CHANNELS.NEXT_RACE,             label: 'Next Race',            fn: () => postNextRace(client, CHANNELS.NEXT_RACE) },
    { id: CHANNELS.RACE_WEEKEND,          label: 'Race Weekend',         fn: () => checkRaceWeekend(client, CHANNELS.RACE_WEEKEND) },
    { id: CHANNELS.RACE_RESULTS,          label: 'Race Results',         fn: () => postRaceResults(client, CHANNELS.RACE_RESULTS) },
    { id: CHANNELS.BOT_STATUS,            label: 'Bot Status',           fn: () => postBotStatus(client, CHANNELS.BOT_STATUS, botStatus) },
    { id: CHANNELS.ALERTS,                label: 'Session Alerts',       fn: () => checkSessionAlerts(client, CHANNELS.ALERTS) },
  ];
}

function registerInteractions(client, CHANNELS, botStatus) {

  client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    try {
      await interaction.deferReply({ ephemeral: true });
      await logCommand(interaction);

      switch (interaction.commandName) {

        // ── /update <channel> ─────────────────────────────────────
        // Can be run from ANY channel including log channel
        // Accepts: channel mention OR channel name keyword
        case 'update': {
          const targetChannel = interaction.options.getChannel('channel');
          const targetName    = interaction.options.getString('name')?.toLowerCase().replace(/[^a-z]/g, '');

          const nameMap = buildUpdateMap(client, CHANNELS, botStatus);
          const idMap   = buildChannelIdMap(client, CHANNELS, botStatus);

          let match = null;

          // Priority 1: matched by channel mention
          if (targetChannel) {
            match = idMap.find(m => m.id === targetChannel.id);
          }

          // Priority 2: matched by name keyword
          if (!match && targetName) {
            match = nameMap[targetName];
          }

          // Priority 3: run from inside the channel itself
          if (!match) {
            match = idMap.find(m => m.id === interaction.channelId);
          }

          if (!match) {
            const available = Object.keys(nameMap).map(k => `\`${k}\``).join(', ');
            return interaction.editReply(
              `❌ Could not find a matching channel.\n\n` +
              `**Usage:**\n` +
              `• \`/update channel:#f1-standings\` — mention the channel\n` +
              `• \`/update name:standings\` — use keyword\n` +
              `• Run \`/update\` inside the channel itself\n\n` +
              `**Available keywords:** ${available}`
            );
          }

          await match.fn();
          const chId = match.id ?? targetChannel?.id ?? interaction.channelId;
          return interaction.editReply(`✅ **${match.label}** updated in <#${chId}>.`);
        }

        case 'standings':
          await postDriverStandings(client, CHANNELS.DRIVER_STANDINGS);
          return interaction.editReply('✅ Driver standings updated.');

        case 'constructors':
          await postConstructorStandings(client, CHANNELS.CONSTRUCTOR_STANDINGS);
          return interaction.editReply('✅ Constructor standings updated.');

        case 'timetable':
          await postTimetable(client, CHANNELS.TIMETABLE);
          return interaction.editReply('✅ Race calendar updated.');

        case 'nextrace':
          await postNextRace(client, CHANNELS.NEXT_RACE);
          return interaction.editReply('✅ Next race info updated.');

        case 'highlights':
          await _pollF1Highlights?.(client, CHANNELS.HIGHLIGHTS, process.env.YOUTUBE_API_KEY);
          return interaction.editReply('✅ Highlights checked.');

        case 'status':
          await postBotStatus(client, CHANNELS.BOT_STATUS, botStatus);
          return interaction.editReply('✅ Bot status updated.');

        case 'test':
          return testAllChannels(client, CHANNELS, msg => interaction.editReply(msg));

        default:
          return interaction.editReply('❓ Unknown command.');
      }

    } catch (err) {
      console.error('[SLASH ERROR]', err);
      if (interaction.deferred || interaction.replied)
        await interaction.editReply(`❌ Error: ${err.message}`).catch(() => {});
      else
        await interaction.reply(`❌ Error: ${err.message}`).catch(() => {});
    }
  });
}

module.exports = { registerInteractions };

// ── /test ─────────────────────────────────────────────────────────
async function testAllChannels(client, CHANNELS, replyFn) {
  const results = [];

  for (const [key, id] of Object.entries(CHANNELS)) {
    if (!id) { results.push(`⚪ **${key}** — not configured`); continue; }
    try {
      const ch = await fetchChannel(client, id);
      if (!ch) { results.push(`🔴 **${key}** — not found`); continue; }
      await ch.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0x00FF88)
            .setTitle('✅ Test Message')
            .setDescription(`Channel **${key}** is working.`)
            .setTimestamp()
        ]
      });
      results.push(`🟢 **${key}** — OK`);
    } catch (e) {
      results.push(`🔴 **${key}** — ${e.message.slice(0, 60)}`);
    }
  }

  await replyFn({
    embeds: [
      new EmbedBuilder()
        .setColor(0x00FF88)
        .setTitle('🤖 Channel Test Results')
        .setDescription(results.join('\n'))
        .setTimestamp()
    ]
  });
}

module.exports.testAllChannels = testAllChannels;
