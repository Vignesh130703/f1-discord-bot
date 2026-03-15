// Run once: node register-commands.js
require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const commands = [
  new SlashCommandBuilder()
    .setName('update')
    .setDescription('🔄 Update a specific F1 channel')
    .addChannelOption(o =>
      o.setName('channel')
       .setDescription('Mention the channel to update (e.g. #f1-standings)')
       .setRequired(false)
    )
    .addStringOption(o =>
      o.setName('name')
       .setDescription('Channel keyword: standings, constructors, timetable, nextrace, results, raceweekend, alerts, status')
       .setRequired(false)
    ),
  new SlashCommandBuilder().setName('standings').setDescription('📊 Driver Championship standings'),
  new SlashCommandBuilder().setName('constructors').setDescription('🏗️ Constructor Championship standings'),
  new SlashCommandBuilder().setName('timetable').setDescription('📅 Full season race calendar'),
  new SlashCommandBuilder().setName('nextrace').setDescription('🏎️ Next race info with countdown & weather'),
  new SlashCommandBuilder().setName('highlights').setDescription('🎬 Check for new F1 YouTube videos'),
  new SlashCommandBuilder().setName('status').setDescription('🤖 Bot system status dashboard'),
  new SlashCommandBuilder().setName('test').setDescription('🧪 Test all channels'),
].map(c => c.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('Registering slash commands…');
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
    console.log('✅ Done! Commands registered.');
  } catch (e) {
    console.error(e);
  }
})();
